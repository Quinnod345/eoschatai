import 'server-only';

import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNull,
  lt,
  type SQL,
  sql,
} from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import {
  user,
  chat,
  type User,
  document,
  type Suggestion,
  suggestion,
  message,
  vote,
  feedback,
  type DBMessage,
  type Chat,
  stream,
  type Stream,
  type StreamStatus,
  userSettings,
  pinnedMessage,
} from './schema';
import type { ComposerKind } from '@/components/composer';
import { generateUUID } from '../utils';
import { generateHashedPassword } from './utils';
import type { VisibilityType } from '@/components/visibility-selector';
import { processDocument } from '../ai/embeddings';

// Type for chat metadata
export interface ChatMetadata {
  isVoiceChat?: boolean;
  isRecording?: boolean;
}

// Type for feedback categories
export type FeedbackCategory =
  | 'accuracy'
  | 'helpfulness'
  | 'tone'
  | 'length'
  | 'clarity'
  | 'other';

// Type for user settings update
export interface UserSettingsUpdate {
  notificationsEnabled?: boolean;
  language?: string;
  fontSize?: string;
  displayName?: string;
  companyName?: string;
  companyType?: string;
  companyDescription?: string;
  lastFeaturesVersion?: string;
  selectedChatModel?: string;
  selectedProvider?: string;
  selectedVisibilityType?: string;
  selectedPersonaId?: string;
  selectedProfileId?: string;
  selectedResearchMode?: string;
  primaryAccountabilityId?: string | null;
  primaryVtoId?: string | null;
  primaryScorecardId?: string | null;
  currentBundleId?: string | null;
  companyIndustry?: string | null;
  companySize?: string | null;
  companyWebsite?: string | null;
  companyCountry?: string | null;
  companyState?: string | null;
  autocompleteEnabled?: boolean;
  profilePicture?: string;
  disableGlassEffects?: boolean;
  disableEosGradient?: boolean;
  contextDocumentIds?: unknown;
  contextComposerDocumentIds?: unknown;
  contextRecordingIds?: unknown;
  usePrimaryDocsForContext?: boolean;
  usePrimaryDocsForPersona?: boolean;
  personaContextDocumentIds?: unknown;
}

// Get the database URL from either POSTGRES_URL or DATABASE_URL
const getDatabaseUrl = () => {
  const postgresUrl = process.env.POSTGRES_URL;
  const databaseUrl = process.env.DATABASE_URL;

  // Return the first available URL
  const url = postgresUrl || databaseUrl;

  if (!url) {
    console.warn('[db] Database URL not configured; using stub client.');
    return null;
  }

  return url;
};

const createStubDb = () =>
  new Proxy(
    {},
    {
      get() {
        throw new Error('Database client is not configured.');
      },
    },
  ) as ReturnType<typeof drizzle>;

const url = getDatabaseUrl();
let dbInstance: ReturnType<typeof drizzle> | null = null;
if (url) {
  const client = postgres(url);
  dbInstance = drizzle(client);
}

export const db = dbInstance ?? createStubDb();

export async function getUser(email: string): Promise<Array<User>> {
  try {
    return await db.select().from(user).where(eq(user.email, email));
  } catch (error) {
    console.error('Failed to get user from database');
    throw error;
  }
}

export async function getOrCreateGoogleUser(email: string): Promise<User> {
  try {
    const users = await db.select().from(user).where(eq(user.email, email));

    if (users.length > 0) {
      return users[0];
    }

    // Create a new user for Google sign in
    const [newUser] = await db
      .insert(user)
      .values({ email, providerId: 'google' })
      .returning();

    return newUser;
  } catch (error) {
    console.error('Failed to get or create Google user');
    throw error;
  }
}

export async function createUser(email: string, password: string) {
  const hashedPassword = generateHashedPassword(password);

  try {
    return await db.insert(user).values({ email, password: hashedPassword });
  } catch (error) {
    console.error('Failed to create user in database');
    throw error;
  }
}

export async function createGuestUser() {
  const email = `guest-${Date.now()}`;
  const password = generateHashedPassword(generateUUID());

  try {
    return await db.insert(user).values({ email, password }).returning({
      id: user.id,
      email: user.email,
    });
  } catch (error) {
    console.error('Failed to create guest user in database');
    throw error;
  }
}

export async function saveChat({
  id,
  userId,
  title,
  visibility,
  personaId,
  profileId,
  metadata,
}: {
  id: string;
  userId: string;
  title: string;
  visibility: VisibilityType;
  personaId?: string;
  profileId?: string;
  metadata?: ChatMetadata;
}) {
  try {
    console.log('[saveChat] Saving chat START:', {
      id,
      userId,
      title,
      visibility,
      personaId,
      profileId,
      metadata,
      timestamp: new Date().toISOString(),
    });

    // Use raw SQL to ensure immediate commit
    const result = await db.execute(sql`
      INSERT INTO "Chat" (id, "createdAt", "userId", title, visibility, "personaId", "profileId", metadata)
      VALUES (${id}, ${new Date().toISOString()}, ${userId}, ${title}, ${visibility}, ${personaId || null}, ${profileId || null}, ${metadata ? JSON.stringify(metadata) : null})
      RETURNING *
    `);

    const insertedChat = result[0];

    console.log('[saveChat] INSERT result:', insertedChat);

    if (!insertedChat) {
      console.error('[saveChat] saveChat returned null/undefined');
      throw new Error('Chat insert failed - no data returned');
    }

    // Double verify the chat was saved
    const verifyResult = await db.execute(sql`
      SELECT * FROM "Chat" WHERE id = ${id}
    `);
    const verifiedChat = verifyResult[0];

    console.log('[saveChat] Verification query result:', verifiedChat);

    console.log('[saveChat] Chat saved successfully END:', {
      id,
      timestamp: new Date().toISOString(),
      insertedChatId: insertedChat.id || id,
      verified: !!verifiedChat,
    });

    return insertedChat;
  } catch (error) {
    console.error('[saveChat] Failed to save chat in database:', error);
    throw error;
  }
}

export async function deleteChatById({ id }: { id: string }) {
  try {
    await db.delete(vote).where(eq(vote.chatId, id));
    await db.delete(message).where(eq(message.chatId, id));
    await db.delete(stream).where(eq(stream.chatId, id));

    const [chatsDeleted] = await db
      .delete(chat)
      .where(eq(chat.id, id))
      .returning();
    return chatsDeleted;
  } catch (error) {
    console.error('Failed to delete chat by id from database');
    throw error;
  }
}

export async function getChatsByUserId({
  id,
  limit,
  startingAfter,
  endingBefore,
}: {
  id: string;
  limit: number;
  startingAfter: string | null;
  endingBefore: string | null;
}) {
  try {
    const extendedLimit = limit + 1;

    const query = (whereCondition?: SQL<any>) =>
      db
        .select()
        .from(chat)
        .where(
          whereCondition
            ? and(whereCondition, eq(chat.userId, id))
            : eq(chat.userId, id),
        )
        .orderBy(desc(chat.createdAt))
        .limit(extendedLimit);

    let filteredChats: Array<Chat> = [];

    if (startingAfter) {
      const [selectedChat] = await db
        .select()
        .from(chat)
        .where(eq(chat.id, startingAfter))
        .limit(1);

      if (!selectedChat) {
        throw new Error(`Chat with id ${startingAfter} not found`);
      }

      filteredChats = await query(gt(chat.createdAt, selectedChat.createdAt));
    } else if (endingBefore) {
      const [selectedChat] = await db
        .select()
        .from(chat)
        .where(eq(chat.id, endingBefore))
        .limit(1);

      if (!selectedChat) {
        throw new Error(`Chat with id ${endingBefore} not found`);
      }

      filteredChats = await query(lt(chat.createdAt, selectedChat.createdAt));
    } else {
      filteredChats = await query();
    }

    const hasMore = filteredChats.length > limit;

    return {
      chats: hasMore ? filteredChats.slice(0, limit) : filteredChats,
      hasMore,
    };
  } catch (error) {
    console.error('Failed to get chats by user from database');
    throw error;
  }
}

export async function getChatById({ id }: { id: string }) {
  try {
    console.log('[getChatById] Fetching chat with ID:', id);
    const [selectedChat] = await db.select().from(chat).where(eq(chat.id, id));

    console.log('[getChatById] Result for ID', id, ':', selectedChat);
    return selectedChat;
  } catch (error) {
    console.error('Failed to get chat by id from database');
    throw error;
  }
}

export async function saveMessages({
  messages,
}: {
  messages: Array<DBMessage>;
}) {
  try {
    const { executeWithRetry } = await import('./helpers/retry');

    return await executeWithRetry(
      () =>
        db
          .insert(message)
          .values(messages)
          .onConflictDoUpdate({
            target: message.id,
            set: {
              role: sql`excluded.role`,
              parts: sql`excluded.parts`,
              attachments: sql`excluded.attachments`,
              provider: sql`excluded.provider`,
              createdAt: sql`excluded."createdAt"`,
              reasoning: sql`excluded.reasoning`,
            },
          }),
      { operation: 'Save messages', retries: 3 },
    );
  } catch (error) {
    console.error('[DB Error] Failed to save messages:', {
      messageCount: messages.length,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function getMessagesByChatId({ id }: { id: string }) {
  try {
    return await db
      .select()
      .from(message)
      .where(eq(message.chatId, id))
      .orderBy(asc(message.createdAt));
  } catch (error) {
    console.error('Failed to get messages by chat id from database', error);
    throw error;
  }
}

/**
 * Get recent messages from a chat with sliding window limit
 * @param chatId - Chat ID
 * @param limit - Maximum number of recent messages to return (default: 50)
 * @returns Array of recent messages in chronological order with total count
 */
export async function getRecentMessagesByChatId({
  chatId,
  limit = 50,
}: {
  chatId: string;
  limit?: number;
}): Promise<{ messages: DBMessage[]; totalCount: number }> {
  try {
    // Get total message count
    const countResult = await db
      .select({ count: count() })
      .from(message)
      .where(eq(message.chatId, chatId));

    const totalCount = countResult[0]?.count || 0;

    // Get recent messages in descending order, then reverse for chronological
    const recentMessages = await db
      .select()
      .from(message)
      .where(eq(message.chatId, chatId))
      .orderBy(desc(message.createdAt))
      .limit(limit);

    // Reverse to get chronological order (oldest first)
    const chronologicalMessages = recentMessages.reverse();

    console.log(
      `Message Retrieval: Loaded ${chronologicalMessages.length} of ${totalCount} total messages for chat ${chatId}`,
    );

    return {
      messages: chronologicalMessages,
      totalCount: totalCount as number,
    };
  } catch (error) {
    console.error(
      'Failed to get recent messages by chat id from database',
      error,
    );
    throw error;
  }
}

export async function voteMessage({
  chatId,
  messageId,
  type,
}: {
  chatId: string;
  messageId: string;
  type: 'up' | 'down';
}) {
  try {
    const [existingVote] = await db
      .select()
      .from(vote)
      .where(and(eq(vote.messageId, messageId)));

    if (existingVote) {
      return await db
        .update(vote)
        .set({ isUpvoted: type === 'up' })
        .where(and(eq(vote.messageId, messageId), eq(vote.chatId, chatId)));
    }
    return await db.insert(vote).values({
      chatId,
      messageId,
      isUpvoted: type === 'up',
    });
  } catch (error) {
    console.error('Failed to upvote message in database', error);
    throw error;
  }
}

export async function getVotesByChatId({ id }: { id: string }) {
  try {
    return await db.select().from(vote).where(eq(vote.chatId, id));
  } catch (error) {
    console.error('Failed to get votes by chat id from database');
    throw error;
  }
}

export async function saveFeedback({
  chatId,
  messageId,
  userId,
  isPositive,
  category,
  description,
}: {
  chatId: string;
  messageId: string;
  userId: string;
  isPositive: boolean;
  category?: FeedbackCategory;
  description?: string;
}) {
  try {
    return await db.insert(feedback).values({
      chatId,
      messageId,
      userId,
      isPositive,
      category,
      description,
    });
  } catch (error) {
    console.error('Failed to save feedback', error);
    throw error;
  }
}

export async function getUserFeedback({ userId }: { userId: string }) {
  try {
    return await db
      .select()
      .from(feedback)
      .where(eq(feedback.userId, userId))
      .orderBy(desc(feedback.createdAt))
      .limit(100);
  } catch (error) {
    console.error('Failed to get user feedback', error);
    throw error;
  }
}

export async function saveDocument({
  id,
  title,
  kind,
  content,
  userId,
}: {
  id: string;
  title: string;
  kind: ComposerKind;
  content: string;
  userId: string;
}) {
  try {
    console.log(`[saveDocument] Saving document ${id}:`, {
      title,
      kind,
      contentLength: content?.length || 0,
      contentPreview: content?.substring(0, 100) || '[EMPTY]',
      userId,
    });

    // Use PostgreSQL's ON CONFLICT for upsert behavior
    const documents = await db.execute(sql`
      INSERT INTO "Document" (id, title, kind, content, "userId", "createdAt")
      VALUES (${id}, ${title}, ${kind}, ${content}, ${userId}, ${new Date().toISOString()})
      ON CONFLICT (id) 
      DO UPDATE SET 
        title = ${title},
        kind = ${kind}, 
        content = ${content}
      RETURNING *
    `);

    console.log(
      `[saveDocument] Document saved/updated with ID: ${id}, content length in DB: ${content?.length || 0}`,
    );
    // Handle different postgres driver response formats
    const documentsResult = Array.isArray(documents)
      ? documents
      : (documents as { rows: unknown[] }).rows;

    // Process the document for embeddings (only for text kind)
    if (kind === 'text' && content) {
      await processDocument(id, content, {
        useSummary: true,
        documentKind: kind,
        documentTitle: title,
      });
    }

    return documentsResult;
  } catch (error) {
    console.error('Failed to save document in database:', error);
    throw error;
  }
}

export async function getDocumentsById({ id }: { id: string }) {
  try {
    const documents = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(asc(document.createdAt));

    return documents;
  } catch (error) {
    console.error('Failed to get document by id from database');
    throw error;
  }
}

export async function getDocumentById({ id }: { id: string }) {
  try {
    const [selectedDocument] = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(desc(document.createdAt));

    return selectedDocument;
  } catch (error) {
    console.error('Failed to get document by id from database');
    throw error;
  }
}

export async function getDocumentCountByUserId({
  userId,
}: {
  userId: string;
}): Promise<number> {
  try {
    const result = await db
      .select({ count: count() })
      .from(document)
      .where(eq(document.userId, userId));

    return result[0]?.count || 0;
  } catch (error) {
    console.error('Failed to get document count from database');
    throw error;
  }
}

export async function deleteDocumentsByIdAfterTimestamp({
  id,
  timestamp,
}: {
  id: string;
  timestamp: Date;
}) {
  try {
    await db
      .delete(suggestion)
      .where(
        and(
          eq(suggestion.documentId, id),
          gt(suggestion.documentCreatedAt, timestamp),
        ),
      );

    return await db
      .delete(document)
      .where(and(eq(document.id, id), gt(document.createdAt, timestamp)))
      .returning();
  } catch (error) {
    console.error(
      'Failed to delete documents by id after timestamp from database',
    );
    throw error;
  }
}

export async function saveSuggestions({
  suggestions,
}: {
  suggestions: Array<Suggestion>;
}) {
  try {
    return await db.insert(suggestion).values(suggestions);
  } catch (error) {
    console.error('Failed to save suggestions in database');
    throw error;
  }
}

export async function getSuggestionsByDocumentId({
  documentId,
}: {
  documentId: string;
}) {
  try {
    return await db
      .select()
      .from(suggestion)
      .where(and(eq(suggestion.documentId, documentId)));
  } catch (error) {
    console.error(
      'Failed to get suggestions by document version from database',
    );
    throw error;
  }
}

export async function getMessageById({ id }: { id: string }) {
  try {
    return await db.select().from(message).where(eq(message.id, id));
  } catch (error) {
    console.error('Failed to get message by id from database');
    throw error;
  }
}

export async function deleteMessagesByChatIdAfterTimestamp({
  chatId,
  timestamp,
}: {
  chatId: string;
  timestamp: Date;
}) {
  try {
    const messagesToDelete = await db
      .select({ id: message.id })
      .from(message)
      .where(
        and(eq(message.chatId, chatId), gte(message.createdAt, timestamp)),
      );

    const messageIds = messagesToDelete.map((message) => message.id);

    if (messageIds.length > 0) {
      // First delete any pinned messages
      await db
        .delete(pinnedMessage)
        .where(
          and(
            eq(pinnedMessage.chatId, chatId),
            inArray(pinnedMessage.messageId, messageIds),
          ),
        );

      // Then delete votes
      await db
        .delete(vote)
        .where(
          and(eq(vote.chatId, chatId), inArray(vote.messageId, messageIds)),
        );

      // Finally delete the messages
      return await db
        .delete(message)
        .where(
          and(eq(message.chatId, chatId), inArray(message.id, messageIds)),
        );
    }
  } catch (error) {
    console.error(
      'Failed to delete messages by id after timestamp from database',
    );
    throw error;
  }
}

export async function updateChatVisiblityById({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: 'private' | 'public';
}) {
  try {
    return await db.update(chat).set({ visibility }).where(eq(chat.id, chatId));
  } catch (error) {
    console.error('Failed to update chat visibility in database');
    throw error;
  }
}

export async function getMessageCountByUserId({
  id,
  differenceInHours,
}: { id: string; differenceInHours: number }) {
  try {
    const twentyFourHoursAgo = new Date(
      Date.now() - differenceInHours * 60 * 60 * 1000,
    );

    const [stats] = await db
      .select({ count: count(message.id) })
      .from(message)
      .innerJoin(chat, eq(message.chatId, chat.id))
      .where(
        and(
          eq(chat.userId, id),
          gte(message.createdAt, twentyFourHoursAgo),
          eq(message.role, 'user'),
          // Exclude messages that were stopped mid-generation
          // These don't count toward the daily message limit
          isNull(message.stoppedAt),
        ),
      )
      .execute();

    return stats?.count ?? 0;
  } catch (error) {
    console.error(
      'Failed to get message count by user id for the last 24 hours from database',
    );
    throw error;
  }
}

/**
 * Mark the latest user message in a chat as stopped
 * This is called when a user stops generation mid-stream
 * Messages marked as stopped don't count toward the daily message limit
 */
export async function markLatestUserMessageAsStopped({
  chatId,
}: {
  chatId: string;
}) {
  try {
    // Find and update the most recent user message in this chat
    const latestUserMessage = await db
      .select({ id: message.id })
      .from(message)
      .where(and(eq(message.chatId, chatId), eq(message.role, 'user')))
      .orderBy(desc(message.createdAt))
      .limit(1)
      .execute();

    if (latestUserMessage.length > 0) {
      await db
        .update(message)
        .set({ stoppedAt: new Date() })
        .where(eq(message.id, latestUserMessage[0].id))
        .execute();

      console.log(`[DB] Marked message ${latestUserMessage[0].id} as stopped`);
      return latestUserMessage[0].id;
    }

    return null;
  } catch (error) {
    console.error('Failed to mark message as stopped:', error);
    throw error;
  }
}

// Stream metadata type for additional state
export interface StreamMetadata {
  researchMode?: string;
  partialContent?: string;
  composerKind?: string;
  composerTitle?: string;
  error?: string;
}

export async function createStreamId({
  streamId,
  chatId,
  messageId,
  composerDocumentId,
  metadata,
}: {
  streamId: string;
  chatId: string;
  messageId?: string;
  composerDocumentId?: string;
  metadata?: StreamMetadata;
}) {
  try {
    const now = new Date();
    await db.insert(stream).values({
      id: streamId,
      chatId,
      createdAt: now,
      status: 'active',
      lastActiveAt: now,
      messageId,
      composerDocumentId,
      metadata,
    });
  } catch (error) {
    console.error('Failed to create stream id in database');
    throw error;
  }
}

export async function getStreamIdsByChatId({ chatId }: { chatId: string }) {
  try {
    const streamIds = await db
      .select({ id: stream.id })
      .from(stream)
      .where(eq(stream.chatId, chatId))
      .orderBy(desc(stream.createdAt))
      .execute();

    return streamIds.map(({ id }) => id);
  } catch (error) {
    console.error('Failed to get stream ids by chat id from database');
    throw error;
  }
}

export async function getActiveStreamByChatId({
  chatId,
}: {
  chatId: string;
}): Promise<Stream | null> {
  try {
    const activeStreams = await db
      .select()
      .from(stream)
      .where(and(eq(stream.chatId, chatId), eq(stream.status, 'active')))
      .orderBy(desc(stream.createdAt))
      .limit(1)
      .execute();

    return activeStreams[0] || null;
  } catch (error) {
    console.error('Failed to get active stream by chat id from database');
    throw error;
  }
}

export async function getStreamById({
  streamId,
}: {
  streamId: string;
}): Promise<Stream | null> {
  try {
    const streams = await db
      .select()
      .from(stream)
      .where(eq(stream.id, streamId))
      .limit(1)
      .execute();

    return streams[0] || null;
  } catch (error) {
    console.error('Failed to get stream by id from database');
    throw error;
  }
}

export async function updateStreamStatus({
  streamId,
  status,
  metadata,
}: {
  streamId: string;
  status: StreamStatus;
  metadata?: StreamMetadata;
}) {
  try {
    const updateData: Partial<Stream> = {
      status,
      lastActiveAt: new Date(),
    };

    if (metadata !== undefined) {
      updateData.metadata = metadata;
    }

    await db.update(stream).set(updateData).where(eq(stream.id, streamId));
  } catch (error) {
    console.error('Failed to update stream status in database');
    throw error;
  }
}

export async function updateStreamLastActive({
  streamId,
  metadata,
}: {
  streamId: string;
  metadata?: StreamMetadata;
}) {
  try {
    const updateData: Partial<Stream> = {
      lastActiveAt: new Date(),
    };

    if (metadata !== undefined) {
      updateData.metadata = metadata;
    }

    await db.update(stream).set(updateData).where(eq(stream.id, streamId));
  } catch (error) {
    console.error('Failed to update stream last active in database');
    throw error;
  }
}

export async function updateStreamMessageId({
  streamId,
  messageId,
}: {
  streamId: string;
  messageId: string;
}) {
  try {
    await db
      .update(stream)
      .set({
        messageId,
        lastActiveAt: new Date(),
      })
      .where(eq(stream.id, streamId));
  } catch (error) {
    console.error('Failed to update stream messageId in database');
    throw error;
  }
}

export async function markStreamCompleted({ streamId }: { streamId: string }) {
  try {
    await db
      .update(stream)
      .set({
        status: 'completed',
        lastActiveAt: new Date(),
      })
      .where(eq(stream.id, streamId));
  } catch (error) {
    console.error('Failed to mark stream as completed in database');
    throw error;
  }
}

export async function markStreamInterrupted({
  streamId,
  metadata,
}: {
  streamId: string;
  metadata?: StreamMetadata;
}) {
  try {
    await db
      .update(stream)
      .set({
        status: 'interrupted',
        lastActiveAt: new Date(),
        ...(metadata && { metadata }),
      })
      .where(eq(stream.id, streamId));
  } catch (error) {
    console.error('Failed to mark stream as interrupted in database');
    throw error;
  }
}

export async function markStreamErrored({
  streamId,
  error,
}: {
  streamId: string;
  error?: string;
}) {
  try {
    await db
      .update(stream)
      .set({
        status: 'errored',
        lastActiveAt: new Date(),
        metadata: error ? { error } : undefined,
      })
      .where(eq(stream.id, streamId));
  } catch (error: any) {
    console.error('Failed to mark stream as errored in database');
    throw error;
  }
}

export async function deleteStreamIdsByChatId({ chatId }: { chatId: string }) {
  try {
    return await db.delete(stream).where(eq(stream.chatId, chatId));
  } catch (error) {
    console.error('Failed to delete stream ids by chat id from database');
    throw error;
  }
}

export async function deleteStreamId({ streamId }: { streamId: string }) {
  try {
    return await db.delete(stream).where(eq(stream.id, streamId));
  } catch (error) {
    console.error('Failed to delete stream id from database');
    throw error;
  }
}

export async function cleanupStaleStreams({
  maxAgeMinutes = 30,
}: {
  maxAgeMinutes?: number;
}) {
  try {
    const cutoffTime = new Date(Date.now() - maxAgeMinutes * 60 * 1000);

    // Mark stale active streams as interrupted
    await db
      .update(stream)
      .set({ status: 'interrupted' })
      .where(
        and(eq(stream.status, 'active'), lt(stream.lastActiveAt, cutoffTime)),
      );

    console.log(`Cleaned up stale streams older than ${maxAgeMinutes} minutes`);
  } catch (error) {
    console.error('Failed to cleanup stale streams');
    throw error;
  }
}

export async function getUserSettings({ userId }: { userId: string }) {
  try {
    // First, try to get existing settings
    const existingSettings = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId));

    if (existingSettings.length === 0) {
      // Create default settings if none exist
      const [newSettings] = await db
        .insert(userSettings)
        .values({
          userId,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      const userData = await db
        .select({ lastFeaturesVersion: user.lastFeaturesVersion })
        .from(user)
        .where(eq(user.id, userId));

      return {
        ...newSettings,
        lastFeaturesVersion: userData[0]?.lastFeaturesVersion,
      };
    }

    // If settings exist, get them with the user's lastFeaturesVersion
    const settingsWithUser = await db
      .select({
        id: userSettings.id,
        userId: userSettings.userId,
        notificationsEnabled: userSettings.notificationsEnabled,
        language: userSettings.language,
        fontSize: userSettings.fontSize,
        displayName: userSettings.displayName,
        companyName: userSettings.companyName,
        companyType: userSettings.companyType,
        companyDescription: userSettings.companyDescription,
        companyIndustry: userSettings.companyIndustry,
        companySize: userSettings.companySize,
        companyWebsite: userSettings.companyWebsite,
        companyCountry: userSettings.companyCountry,
        companyState: userSettings.companyState,
        profilePicture: userSettings.profilePicture,
        dailyMessageCount: userSettings.dailyMessageCount,
        lastMessageCountReset: userSettings.lastMessageCountReset,
        createdAt: userSettings.createdAt,
        updatedAt: userSettings.updatedAt,
        selectedChatModel: userSettings.selectedChatModel,
        selectedProvider: userSettings.selectedProvider,
        selectedVisibilityType: userSettings.selectedVisibilityType,
        selectedPersonaId: userSettings.selectedPersonaId,
        selectedProfileId: userSettings.selectedProfileId,
        selectedResearchMode: userSettings.selectedResearchMode,
        primaryAccountabilityId: userSettings.primaryAccountabilityId,
        primaryVtoId: userSettings.primaryVtoId,
        primaryScorecardId: userSettings.primaryScorecardId,
        currentBundleId: userSettings.currentBundleId,
        contextDocumentIds: userSettings.contextDocumentIds,
        contextComposerDocumentIds: userSettings.contextComposerDocumentIds,
        contextRecordingIds: userSettings.contextRecordingIds,
        usePrimaryDocsForContext: userSettings.usePrimaryDocsForContext,
        usePrimaryDocsForPersona: userSettings.usePrimaryDocsForPersona,
        personaContextDocumentIds: userSettings.personaContextDocumentIds,
        autocompleteEnabled: userSettings.autocompleteEnabled,
        disableGlassEffects: userSettings.disableGlassEffects,
        disableEosGradient: userSettings.disableEosGradient,
        lastFeaturesVersion: user.lastFeaturesVersion,
      })
      .from(userSettings)
      .leftJoin(user, eq(userSettings.userId, user.id))
      .where(eq(userSettings.userId, userId));

    const result = settingsWithUser[0];
    if (!result) {
      throw new Error('Failed to fetch user settings');
    }

    return result;
  } catch (error) {
    console.error('Failed to get user settings from database', error);
    throw error;
  }
}

export async function updateUserSettings({
  userId,
  settings,
}: {
  userId: string;
  settings: {
    notificationsEnabled?: boolean;
    language?: string;
    fontSize?: string;
    displayName?: string;
    companyName?: string;
    companyType?: string;
    companyDescription?: string;
    lastFeaturesVersion?: string;
    selectedChatModel?: string;
    selectedProvider?: string;
    selectedVisibilityType?: string;
    selectedPersonaId?: string;
    selectedProfileId?: string;
    selectedResearchMode?: string;
    primaryAccountabilityId?: string | null;
    primaryVtoId?: string | null;
    primaryScorecardId?: string | null;
    currentBundleId?: string | null;
    // personalization extras
    companyIndustry?: string | null;
    companySize?: string | null;
    companyWebsite?: string | null;
    companyCountry?: string | null;
    companyState?: string | null;
    autocompleteEnabled?: boolean;
    profilePicture?: string;
    disableGlassEffects?: boolean;
    disableEosGradient?: boolean;
    // context document settings
    contextDocumentIds?: unknown;
    contextComposerDocumentIds?: unknown;
    contextRecordingIds?: unknown;
    usePrimaryDocsForContext?: boolean;
    usePrimaryDocsForPersona?: boolean;
    personaContextDocumentIds?: unknown;
  };
}) {
  try {
    console.log(
      '[updateUserSettings] Input settings:',
      JSON.stringify(settings, null, 2),
    );

    // Extract lastFeaturesVersion from settings
    const { lastFeaturesVersion, ...incoming } = settings;

    // Whitelist allowed columns only to avoid SQL errors
    const allowed: Partial<UserSettingsUpdate> = {};
    const allow = <K extends keyof UserSettingsUpdate>(
      key: K,
      value: UserSettingsUpdate[K] | undefined,
    ) => {
      if (value !== undefined) {
        // Convert empty strings to null for optional fields
        if (
          value === '' &&
          key !== 'displayName' &&
          key !== 'language' &&
          key !== 'fontSize'
        ) {
          (allowed as Record<string, unknown>)[key] = null;
          console.log(
            `[updateUserSettings] Allowing (empty->null): ${key} = null`,
          );
        } else {
          allowed[key] = value;
          console.log(
            `[updateUserSettings] Allowing: ${key} = ${String(value)}`,
          );
        }
      }
    };

    allow('notificationsEnabled', incoming.notificationsEnabled);
    allow('language', incoming.language);
    allow('fontSize', incoming.fontSize);
    allow('displayName', incoming.displayName);
    allow('companyName', incoming.companyName);
    allow('companyType', incoming.companyType);
    allow('companyDescription', incoming.companyDescription);
    allow('companyIndustry', incoming.companyIndustry);
    allow('companySize', incoming.companySize);
    allow('companyWebsite', incoming.companyWebsite);
    allow('companyCountry', incoming.companyCountry);
    allow('companyState', incoming.companyState);
    allow('profilePicture', incoming.profilePicture);
    allow('selectedChatModel', incoming.selectedChatModel);
    allow('selectedProvider', incoming.selectedProvider);
    allow('selectedVisibilityType', incoming.selectedVisibilityType);
    allow('selectedPersonaId', incoming.selectedPersonaId);
    allow('selectedProfileId', incoming.selectedProfileId);
    allow('selectedResearchMode', incoming.selectedResearchMode);
    allow('primaryAccountabilityId', incoming.primaryAccountabilityId);
    allow('primaryVtoId', incoming.primaryVtoId);
    allow('primaryScorecardId', incoming.primaryScorecardId);
    allow('currentBundleId', incoming.currentBundleId);
    allow('contextDocumentIds', incoming.contextDocumentIds);
    allow('contextComposerDocumentIds', incoming.contextComposerDocumentIds);
    allow('contextRecordingIds', incoming.contextRecordingIds);
    allow('usePrimaryDocsForContext', incoming.usePrimaryDocsForContext);
    allow('usePrimaryDocsForPersona', incoming.usePrimaryDocsForPersona);
    allow('personaContextDocumentIds', incoming.personaContextDocumentIds);
    allow('autocompleteEnabled', incoming.autocompleteEnabled);
    allow('disableGlassEffects', incoming.disableGlassEffects);
    allow('disableEosGradient', incoming.disableEosGradient);

    // Update user table if lastFeaturesVersion is provided
    if (lastFeaturesVersion !== undefined) {
      await db
        .update(user)
        .set({
          lastFeaturesVersion: new Date(lastFeaturesVersion),
        })
        .where(eq(user.id, userId));
    }

    // Check if settings exist for this user
    const existingSettings = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId));

    console.log(
      '[updateUserSettings] Existing settings count:',
      existingSettings.length,
    );
    console.log('[updateUserSettings] Allowed fields:', allowed);

    if (existingSettings.length === 0) {
      // Create new settings
      console.log('[updateUserSettings] Creating new settings...');
      const [newSettings] = await db
        .insert(userSettings)
        .values({
          userId,
          ...allowed,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      console.log('[updateUserSettings] Created settings:', newSettings);

      return {
        ...newSettings,
        lastFeaturesVersion: lastFeaturesVersion
          ? new Date(lastFeaturesVersion)
          : null,
      };
    } else {
      // Update existing settings
      console.log('[updateUserSettings] Updating existing settings...');
      const [updatedSettings] = await db
        .update(userSettings)
        .set({
          ...allowed,
          updatedAt: new Date(),
        })
        .where(eq(userSettings.userId, userId))
        .returning();

      console.log('[updateUserSettings] Updated settings:', updatedSettings);

      return {
        ...updatedSettings,
        lastFeaturesVersion: lastFeaturesVersion
          ? new Date(lastFeaturesVersion)
          : null,
      };
    }
  } catch (error) {
    console.error('Failed to update user settings in database', error);
    throw error;
  }
}

// Add optimized batch loading functions
export async function getChatsByUserIdWithMessages({
  userId,
  limit = 10,
}: {
  userId: string;
  limit: number;
}) {
  try {
    // Get chats with message counts in a single query
    const chatsWithCounts = await db
      .select({
        chat: chat,
        messageCount: sql<number>`count(${message.id})`,
        lastMessageAt: sql<Date>`max(${message.createdAt})`,
      })
      .from(chat)
      .leftJoin(message, eq(chat.id, message.chatId))
      .where(eq(chat.userId, userId))
      .groupBy(chat.id)
      .orderBy(desc(chat.createdAt))
      .limit(limit);

    return chatsWithCounts;
  } catch (error) {
    console.error('Failed to get chats with messages from database');
    throw error;
  }
}

// Batch load messages for multiple chats
export async function getMessagesByMultipleChatIds({
  chatIds,
}: {
  chatIds: string[];
}) {
  try {
    if (chatIds.length === 0) return [];

    const messages = await db
      .select()
      .from(message)
      .where(inArray(message.chatId, chatIds))
      .orderBy(asc(message.createdAt));

    // Group messages by chatId for easier consumption
    const messagesByChatId = messages.reduce(
      (acc, msg) => {
        if (!acc[msg.chatId]) {
          acc[msg.chatId] = [];
        }
        acc[msg.chatId].push(msg);
        return acc;
      },
      {} as Record<string, typeof messages>,
    );

    return messagesByChatId;
  } catch (error) {
    console.error('Failed to batch load messages from database', error);
    throw error;
  }
}

export async function getPersonaProfileById({ id }: { id: string }) {
  try {
    const { personaProfile } = await import('./schema');

    const [profile] = await db
      .select()
      .from(personaProfile)
      .where(eq(personaProfile.id, id))
      .limit(1);

    return profile;
  } catch (error) {
    console.error('Failed to get persona profile by id from database', error);
    throw error;
  }
}

export async function getPersonaProfilesByPersonaId({
  personaId,
}: { personaId: string }) {
  try {
    const { personaProfile } = await import('./schema');

    const profiles = await db
      .select()
      .from(personaProfile)
      .where(eq(personaProfile.personaId, personaId))
      .orderBy(asc(personaProfile.name));

    return profiles;
  } catch (error) {
    console.error(
      'Failed to get persona profiles by persona id from database',
      error,
    );
    throw error;
  }
}

export async function getPersonaProfileWithDocuments({ id }: { id: string }) {
  try {
    const { personaProfile, profileDocument } = await import('./schema');

    // Get the profile
    const [profile] = await db
      .select()
      .from(personaProfile)
      .where(eq(personaProfile.id, id))
      .limit(1);

    if (!profile) {
      return null;
    }

    // Get associated document IDs
    const documents = await db
      .select({ documentId: profileDocument.documentId })
      .from(profileDocument)
      .where(eq(profileDocument.profileId, id));

    return {
      ...profile,
      documentIds: documents.map((d) => d.documentId),
    };
  } catch (error) {
    console.error(
      'Failed to get persona profile with documents from database',
      error,
    );
    throw error;
  }
}
