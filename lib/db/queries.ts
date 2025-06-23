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
  type DBMessage,
  type Chat,
  stream,
  userSettings,
  pinnedMessage,
} from './schema';
import type { ArtifactKind } from '@/components/artifact';
import { generateUUID } from '../utils';
import { generateHashedPassword } from './utils';
import type { VisibilityType } from '@/components/visibility-selector';
import { processDocument } from '../ai/embeddings';

// Get the database URL from either POSTGRES_URL or DATABASE_URL
const getDatabaseUrl = () => {
  const postgresUrl = process.env.POSTGRES_URL;
  const databaseUrl = process.env.DATABASE_URL;

  // Return the first available URL
  const url = postgresUrl || databaseUrl;

  if (!url) {
    throw new Error(
      'Neither POSTGRES_URL nor DATABASE_URL environment variable is defined',
    );
  }

  return url;
};

const client = postgres(getDatabaseUrl());
export const db = drizzle(client);

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
  metadata?: any;
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
    return await db.insert(message).values(messages);
  } catch (error) {
    console.error('Failed to save messages in database', error);
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
    console.error('Failed to get votes by chat id from database', error);
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
  kind: ArtifactKind;
  content: string;
  userId: string;
}) {
  try {
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

    console.log(`Document saved/updated with ID: ${id}`);
    const documentsResult = Array.isArray(documents)
      ? documents
      : (documents as any).rows;

    // Process the document for embeddings (only for text kind)
    if (kind === 'text' && content) {
      await processDocument(id, content);
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

export async function createStreamId({
  streamId,
  chatId,
}: {
  streamId: string;
  chatId: string;
}) {
  try {
    await db
      .insert(stream)
      .values({ id: streamId, chatId, createdAt: new Date() });
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

      // Get the user's lastFeaturesVersion separately
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
    profilePicture?: string;
    lastFeaturesVersion?: string;
    selectedChatModel?: string;
    selectedProvider?: string;
    selectedVisibilityType?: string;
    selectedPersonaId?: string;
    selectedProfileId?: string;
    selectedResearchMode?: string;
  };
}) {
  try {
    // Extract lastFeaturesVersion from settings
    const { lastFeaturesVersion, ...userSettingsData } = settings;

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

    if (existingSettings.length === 0) {
      // Create new settings
      const [newSettings] = await db
        .insert(userSettings)
        .values({
          userId,
          ...userSettingsData,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      return {
        ...newSettings,
        lastFeaturesVersion: lastFeaturesVersion
          ? new Date(lastFeaturesVersion)
          : null,
      };
    } else {
      // Update existing settings
      const [updatedSettings] = await db
        .update(userSettings)
        .set({
          ...userSettingsData,
          updatedAt: new Date(),
        })
        .where(eq(userSettings.userId, userId))
        .returning();

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
