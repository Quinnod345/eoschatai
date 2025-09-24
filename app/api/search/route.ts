import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import { getDisplayTitle } from '@/lib/utils/chat-utils';
import {
  chat,
  message,
  userDocuments,
  document,
  persona,
  pinnedMessage,
  bookmarkedChat,
} from '@/lib/db/schema';
import { desc, eq, and, or, gte, sql, inArray } from 'drizzle-orm';

// Fuzzy search function with better scoring
function calculateRelevanceScore(text: string, query: string): number {
  if (!text || !query) return 0;

  const textLower = text.toLowerCase();
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/);

  let score = 0;

  // Exact match gets highest score
  if (textLower === queryLower) return 1.0;

  // Contains exact query
  if (textLower.includes(queryLower)) {
    score += 0.8;
  }

  // All words present (in any order)
  const allWordsPresent = queryWords.every((word) => textLower.includes(word));
  if (allWordsPresent) {
    score += 0.6;
  }

  // Individual word matches
  const wordMatchCount = queryWords.filter((word) =>
    textLower.includes(word),
  ).length;
  score += (wordMatchCount / queryWords.length) * 0.4;

  // Fuzzy match for typos (simple Levenshtein distance approximation)
  for (const word of queryWords) {
    if (word.length > 3) {
      // Check for words that are similar (1-2 character difference)
      const textWords = textLower.split(/\s+/);
      for (const textWord of textWords) {
        if (Math.abs(textWord.length - word.length) <= 2) {
          let differences = 0;
          for (let i = 0; i < Math.min(word.length, textWord.length); i++) {
            if (word[i] !== textWord[i]) differences++;
          }
          if (differences <= 2) {
            score += 0.2;
            break;
          }
        }
      }
    }
  }

  return Math.min(score, 1.0);
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session || !session.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log(`=== SEARCH DEBUG START ===`);
  console.log(`Authenticated user ID: ${session.user.id}`);
  console.log(`User email: ${session.user.email}`);

  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q') || '';
  const dateRange = searchParams.get('dateRange') || 'all';
  const types = (
    searchParams.get('types') || 'chat,message,document,composer'
  ).split(',');
  const personas =
    searchParams.get('personas')?.split(',').filter(Boolean) || [];
  const documentTypes =
    searchParams.get('documentTypes')?.split(',').filter(Boolean) || [];
  const limitParam = Number.parseInt(searchParams.get('limit') || '200', 10);
  const offsetParam = Number.parseInt(searchParams.get('offset') || '0', 10);
  const hasBookmarks = searchParams.get('hasBookmarks');
  const hasPins = searchParams.get('hasPins');

  console.log(`Search query: "${query}"`);
  console.log(`Search types: ${types.join(', ')}`);
  console.log(`Personas: ${personas.join(', ')}`);
  console.log(`Document Types: ${documentTypes.join(', ')}`);
  console.log(`Has Bookmarks: ${hasBookmarks}`);
  console.log(`Has Pins: ${hasPins}`);

  try {
    const results: any[] = [];
    const searchQuery = `%${query}%`;

    // First, let's check how many chats this user has total
    const totalUserChats = await db
      .select({ count: sql`count(*)` })
      .from(chat)
      .where(eq(chat.userId, session.user.id));

    console.log(`Total chats for user: ${totalUserChats[0]?.count || 0}`);

    // Get a sample of user's chats to see what we're working with
    const sampleChats = await db
      .select({
        id: chat.id,
        title: chat.title,
        userId: chat.userId,
        createdAt: chat.createdAt,
      })
      .from(chat)
      .where(eq(chat.userId, session.user.id))
      .orderBy(desc(chat.createdAt))
      .limit(10);

    console.log(`Sample of user's chats:`);
    sampleChats.forEach((c, i) => {
      console.log(
        `  ${i + 1}. "${getDisplayTitle(c.title)}" (ID: ${c.id}, UserID: ${c.userId})`,
      );
    });

    // Date filter
    let dateFilter: Date | null = null;
    switch (dateRange) {
      case 'today':
        dateFilter = new Date();
        dateFilter.setHours(0, 0, 0, 0);
        break;
      case 'week':
        dateFilter = new Date();
        dateFilter.setDate(dateFilter.getDate() - 7);
        break;
      case 'month':
        dateFilter = new Date();
        dateFilter.setMonth(dateFilter.getMonth() - 1);
        break;
    }

    // Get chats with bookmarks/pins if needed
    let bookmarkedChatIds: string[] = [];
    let pinnedChatIds: string[] = [];

    if (hasBookmarks === 'true') {
      const bookmarkedChats = await db
        .select({ chatId: bookmarkedChat.chatId })
        .from(bookmarkedChat)
        .where(eq(bookmarkedChat.userId, session.user.id));
      bookmarkedChatIds = bookmarkedChats.map((b) => b.chatId);
      console.log(`Found ${bookmarkedChatIds.length} bookmarked chats`);
    }

    if (hasPins === 'true') {
      const pinnedChats = await db
        .selectDistinct({ chatId: pinnedMessage.chatId })
        .from(pinnedMessage)
        .where(eq(pinnedMessage.userId, session.user.id));
      pinnedChatIds = [...new Set(pinnedChats.map((p) => p.chatId))];
      console.log(`Found ${pinnedChatIds.length} chats with pins`);
    }

    // Filter chat IDs based on bookmarks/pins
    let filteredChatIds: string[] | null = null;
    if (hasBookmarks === 'true' && hasPins === 'true') {
      // Intersection of both
      filteredChatIds = bookmarkedChatIds.filter((id) =>
        pinnedChatIds.includes(id),
      );
    } else if (hasBookmarks === 'true') {
      filteredChatIds = bookmarkedChatIds;
    } else if (hasPins === 'true') {
      filteredChatIds = pinnedChatIds;
    }

    // Search Chats - Enhanced to include message-matched chats and robust filtering
    if (types.includes('chat')) {
      console.log(
        `Search: Looking for chats with query "${query}" for user ${session.user.id}`,
      );

      let chats: Array<{
        id: string;
        title: string;
        createdAt: Date;
        personaId: string | null;
      }> = [];

      if (query.trim()) {
        const searchQuery = `%${query.trim()}%`;
        console.log(`Search: Using search pattern "${searchQuery}"`);

        try {
          // First get chatIds from message matches (distinct), respecting user and optional filters
          const messageChatConditions = [
            sql`${message.chatId} IN (SELECT id FROM "Chat" WHERE "userId" = ${session.user.id})`,
            sql`${message.parts}::text ILIKE ${searchQuery}`,
          ];
          if (dateFilter) {
            messageChatConditions.push(gte(message.createdAt, dateFilter));
          }
          if (filteredChatIds !== null) {
            if (filteredChatIds.length === 0) {
              // No chats will match
            } else {
              messageChatConditions.push(
                inArray(message.chatId, filteredChatIds),
              );
            }
          }

          const messageMatchedChatRows = await db
            .selectDistinct({ chatId: message.chatId })
            .from(message)
            .where(and(...messageChatConditions));
          const messageMatchedChatIds = messageMatchedChatRows.map(
            (r) => r.chatId,
          );

          // Build chat conditions: user, optional persona/date filters, and title OR message match
          const chatConditions: any[] = [eq(chat.userId, session.user.id)];
          if (dateFilter) {
            chatConditions.push(gte(chat.createdAt, dateFilter));
          }
          if (personas.length > 0) {
            const personaRecords = await db
              .select({ id: persona.id })
              .from(persona)
              .where(
                and(
                  eq(persona.userId, session.user.id),
                  inArray(persona.name, personas),
                ),
              );
            if (personaRecords.length > 0) {
              const personaIds = personaRecords.map((p) => p.id);
              chatConditions.push(inArray(chat.personaId, personaIds));
            }
          }
          if (filteredChatIds !== null) {
            if (filteredChatIds.length === 0) {
              // force no results
              chatConditions.push(sql`false`);
            } else {
              chatConditions.push(inArray(chat.id, filteredChatIds));
            }
          }

          const titleMatch = sql`${chat.title} ILIKE ${searchQuery}`;
          const messageIdMatch =
            messageMatchedChatIds.length > 0
              ? inArray(chat.id, messageMatchedChatIds)
              : sql`false`;

          chats = await db
            .select({
              id: chat.id,
              title: chat.title,
              createdAt: chat.createdAt,
              personaId: chat.personaId,
            })
            .from(chat)
            .where(and(...chatConditions, or(titleMatch, messageIdMatch)))
            .orderBy(desc(chat.createdAt))
            .limit(Math.max(50, limitParam));

          console.log(
            `Search: Title/message union found ${chats.length} chats (title OR message matches)`,
          );
        } catch (searchError) {
          console.error('Search: Error in chat search:', searchError);
          chats = [];
        }
      } else {
        // No query - get recent chats
        console.log(`Search: No query provided, getting recent chats`);

        const conditions = [eq(chat.userId, session.user.id)];

        if (dateFilter) {
          conditions.push(gte(chat.createdAt, dateFilter));
        }

        if (personas.length > 0) {
          // Get persona IDs from names
          const personaRecords = await db
            .select({ id: persona.id })
            .from(persona)
            .where(
              and(
                eq(persona.userId, session.user.id),
                inArray(persona.name, personas),
              ),
            );

          if (personaRecords.length > 0) {
            const personaIds = personaRecords.map((p) => p.id);
            conditions.push(inArray(chat.personaId, personaIds));
          }
        }

        // Apply bookmark/pin filtering at SQL-level to avoid truncation before limit
        if (filteredChatIds !== null) {
          if (filteredChatIds.length === 0) {
            conditions.push(sql`false`);
          } else {
            conditions.push(inArray(chat.id, filteredChatIds));
          }
        }

        chats = await db
          .select({
            id: chat.id,
            title: chat.title,
            createdAt: chat.createdAt,
            personaId: chat.personaId,
          })
          .from(chat)
          .where(conditions.length > 1 ? and(...conditions) : conditions[0])
          .orderBy(desc(chat.createdAt))
          .limit(Math.max(50, limitParam));
      }

      console.log(`Search: Found ${chats.length} chats total`);

      // Log first few chat titles for debugging
      chats.slice(0, 3).forEach((c, i) => {
        const displayTitle = getDisplayTitle(c.title);
        console.log(`Search: Chat ${i + 1}: "${displayTitle}" (ID: ${c.id})`);
        if (query.trim()) {
          const matches = displayTitle
            .toLowerCase()
            .includes(query.toLowerCase());
          console.log(
            `Search: Title "${displayTitle}" contains "${query}": ${matches}`,
          );
        }
      });

      // Get persona names for the chats
      const personaIds = [
        ...new Set(chats.map((c) => c.personaId).filter(Boolean)),
      ] as string[];
      const personaMap = new Map();

      if (personaIds.length > 0) {
        const personaRecords = await db
          .select({ id: persona.id, name: persona.name })
          .from(persona)
          .where(inArray(persona.id, personaIds));

        personaRecords.forEach((p) => personaMap.set(p.id, p.name));
      }

      // Check which chats have bookmarks/pins for indicators
      const chatIds = chats.map((c) => c.id);
      const bookmarkedSet = new Set<string>();
      const pinnedSet = new Set<string>();

      if (chatIds.length > 0) {
        // Get bookmarked chats
        const bookmarked = await db
          .select({ chatId: bookmarkedChat.chatId })
          .from(bookmarkedChat)
          .where(
            and(
              eq(bookmarkedChat.userId, session.user.id),
              inArray(bookmarkedChat.chatId, chatIds),
            ),
          );
        bookmarked.forEach((b) => bookmarkedSet.add(b.chatId));

        // Get chats with pinned messages
        const pinned = await db
          .selectDistinct({ chatId: pinnedMessage.chatId })
          .from(pinnedMessage)
          .where(
            and(
              eq(pinnedMessage.userId, session.user.id),
              inArray(pinnedMessage.chatId, chatIds),
            ),
          );
        pinned.forEach((p) => pinnedSet.add(p.chatId));
      }

      const chatResults = chats.map((c) => ({
        id: c.id,
        type: 'chat' as const,
        title: getDisplayTitle(c.title),
        preview: `Chat conversation${personaMap.get(c.personaId) ? ` with ${personaMap.get(c.personaId)}` : ''}`,
        createdAt: c.createdAt,
        personaName: personaMap.get(c.personaId),
        matches: query.trim() ? [query] : [],
        hasBookmarkedMessages: bookmarkedSet.has(c.id),
        hasPinnedMessages: pinnedSet.has(c.id),
      }));

      console.log(
        `Search: Adding ${chatResults.length} chat results to search results`,
      );
      results.push(...chatResults);
    }

    // Include pinned messages when pins filter is active (regardless of query)
    if (types.includes('message') && hasPins === 'true') {
      console.log(
        `Search: Fetching pinned messages${query ? ` with query "${query}"` : ''}`,
      );

      const pinConditions = [eq(pinnedMessage.userId, session.user.id)];
      if (filteredChatIds && filteredChatIds.length > 0) {
        pinConditions.push(inArray(pinnedMessage.chatId, filteredChatIds));
      }

      const pinnedMsgs = await db
        .select({
          id: message.id,
          chatId: message.chatId,
          parts: message.parts,
          createdAt: message.createdAt,
          pinnedAt: pinnedMessage.pinnedAt,
        })
        .from(pinnedMessage)
        .innerJoin(message, eq(message.id, pinnedMessage.messageId))
        .where(
          query.trim()
            ? and(
                ...pinConditions,
                sql`${message.parts}::text ILIKE ${searchQuery}`,
              )
            : and(...pinConditions),
        )
        .orderBy(desc(pinnedMessage.pinnedAt))
        .limit(100);

      const pinnedResults = pinnedMsgs.map((m) => {
        let textContent = '';
        try {
          const parts = m.parts as any[];
          parts.forEach((part) => {
            if (part.type === 'text' && part.text) {
              textContent += `${part.text} `;
            }
          });
        } catch (e) {
          textContent = JSON.stringify(m.parts);
        }

        const normalized = textContent.trim();
        const idx = query
          ? normalized.toLowerCase().indexOf(query.toLowerCase())
          : -1;
        let preview =
          idx >= 0
            ? normalized.substring(
                Math.max(0, idx - 50),
                Math.min(normalized.length, idx + query.length + 50),
              )
            : normalized.substring(0, 150);
        if (idx > 50) preview = `...${preview}`;
        if (idx >= 0 && idx + query.length + 50 < normalized.length)
          preview = `${preview}...`;

        return {
          id: m.id,
          type: 'message' as const,
          title: 'Pinned message',
          preview: (preview || normalized || 'Pinned message').trim(),
          createdAt: m.createdAt,
          chatId: m.chatId,
          matches: query ? [query] : [],
        };
      });

      console.log(`Search: Returning ${pinnedResults.length} pinned messages`);
      results.push(...pinnedResults);
    }

    // Search Messages (general) when not restricted to pins
    if (types.includes('message') && query && hasPins !== 'true') {
      console.log(`Search: Looking for messages with query "${query}"`);

      const messageConditions = [
        sql`${message.chatId} IN (SELECT id FROM "Chat" WHERE "userId" = ${session.user.id})`,
      ];

      // If filtering by bookmarked/pinned chats, narrow at SQL level
      if (filteredChatIds !== null) {
        if (filteredChatIds.length === 0) {
          console.log(
            'Search: Skipping message query due to empty filteredChatIds',
          );
        } else {
          messageConditions.push(inArray(message.chatId, filteredChatIds));
        }
      }

      if (dateFilter) {
        messageConditions.push(gte(message.createdAt, dateFilter));
      }

      console.log(
        `Search: Message conditions count: ${messageConditions.length}`,
      );

      // Search in message parts JSON using ILIKE on serialized parts
      const messages = await db
        .select({
          id: message.id,
          chatId: message.chatId,
          parts: message.parts,
          createdAt: message.createdAt,
        })
        .from(message)
        .where(
          and(
            ...messageConditions,
            sql`${message.parts}::text ILIKE ${searchQuery}`,
          ),
        )
        .orderBy(desc(message.createdAt))
        .limit(100);

      console.log(
        `Search: Found ${messages.length} messages from user's chats`,
      );

      // Filter messages that contain the search query in their parts
      const messageResults = messages.map((m) => {
        // Extract text from parts
        let textContent = '';
        try {
          const parts = m.parts as any[];
          parts.forEach((part) => {
            if (part.type === 'text' && part.text) {
              textContent += `${part.text} `;
            }
          });
        } catch (e) {
          textContent = JSON.stringify(m.parts);
        }

        // Create preview
        const queryIndex = textContent
          .toLowerCase()
          .indexOf(query.toLowerCase());
        let preview = textContent.substring(
          Math.max(0, queryIndex - 50),
          Math.min(textContent.length, queryIndex + query.length + 50),
        );

        if (queryIndex > 50) preview = `...${preview}`;
        if (queryIndex + query.length + 50 < textContent.length)
          preview = `${preview}...`;

        return {
          id: m.id,
          type: 'message' as const,
          title: 'Message',
          preview: preview.trim(),
          createdAt: m.createdAt,
          chatId: m.chatId,
          matches: [query],
        };
      });

      console.log(
        `Search: Filtered to ${messageResults.length} matching messages`,
      );
      results.push(...messageResults);
    }

    // Search Composers
    if (types.includes('composer')) {
      console.log(`Search: Looking for composers with query "${query}"`);

      const composerConditions = [eq(document.userId, session.user.id)];

      if (query) {
        const composerSearchQuery = `%${query}%`;
        const searchCondition = or(
          sql`${document.title} ILIKE ${composerSearchQuery}`,
          sql`${document.content} ILIKE ${composerSearchQuery}`,
        );
        if (searchCondition) {
          composerConditions.push(searchCondition);
        }
      }

      if (dateFilter) {
        composerConditions.push(gte(document.createdAt, dateFilter));
      }

      // Filter by composer types if specified
      const composerTypes =
        searchParams.get('composerTypes')?.split(',').filter(Boolean) || [];
      if (composerTypes.length > 0) {
        composerConditions.push(inArray(document.kind, composerTypes as any));
      }

      const composers = await db
        .select({
          id: document.id,
          title: document.title,
          content: document.content,
          kind: document.kind,
          createdAt: document.createdAt,
        })
        .from(document)
        .where(
          and(
            ...(composerConditions.length > 1
              ? composerConditions
              : [composerConditions[0]]),
            // Filter out RAG user notes
            sql`NOT "title" LIKE 'User Note:%'`,
          ),
        )
        .orderBy(desc(document.createdAt))
        .limit(100);

      const composerResults = composers.map((c) => {
        // Create preview from content
        let preview =
          c.content?.substring(0, 150) || 'No content preview available';
        if (c.content && c.content.length > 150) preview = `${preview}...`;

        if (query && c.content) {
          const queryIndex = c.content
            .toLowerCase()
            .indexOf(query.toLowerCase());
          if (queryIndex !== -1) {
            preview = c.content.substring(
              Math.max(0, queryIndex - 50),
              Math.min(c.content.length, queryIndex + query.length + 50),
            );

            if (queryIndex > 50) preview = `...${preview}`;
            if (queryIndex + query.length + 50 < c.content.length)
              preview = `${preview}...`;
          }
        }

        return {
          id: c.id,
          type: 'composer' as const,
          title: c.title,
          preview: preview.trim(),
          createdAt: c.createdAt,
          composerType: c.kind,
          matches: query ? [query] : [],
        };
      });

      console.log(`Search: Found ${composerResults.length} composers`);
      results.push(...composerResults);
    }

    // Search Documents - Enhanced with RAG search
    if (types.includes('document') && query) {
      // Search regular user documents
      const docConditions = [eq(userDocuments.userId, session.user.id)];

      if (query) {
        const docSearchQuery = `%${query}%`;
        const searchCondition = or(
          sql`${userDocuments.fileName} ILIKE ${docSearchQuery}`,
          sql`${userDocuments.content} ILIKE ${docSearchQuery}`,
        );
        if (searchCondition) {
          docConditions.push(searchCondition);
        }
      }

      if (dateFilter) {
        docConditions.push(gte(userDocuments.createdAt, dateFilter));
      }

      if (documentTypes.length > 0) {
        docConditions.push(
          inArray(userDocuments.category, documentTypes as any),
        );
      }

      const documents = await db
        .select({
          id: userDocuments.id,
          fileName: userDocuments.fileName,
          content: userDocuments.content,
          category: userDocuments.category,
          createdAt: userDocuments.createdAt,
        })
        .from(userDocuments)
        .where(
          docConditions.length > 1 ? and(...docConditions) : docConditions[0],
        )
        .orderBy(desc(userDocuments.createdAt))
        .limit(100);

      const docResults = documents.map((d) => {
        // Create preview from content
        let preview = d.content.substring(0, 150);
        if (d.content.length > 150) preview = `${preview}...`;

        if (query) {
          const queryIndex = d.content
            .toLowerCase()
            .indexOf(query.toLowerCase());
          if (queryIndex !== -1) {
            preview = d.content.substring(
              Math.max(0, queryIndex - 50),
              Math.min(d.content.length, queryIndex + query.length + 50),
            );

            if (queryIndex > 50) preview = `...${preview}`;
            if (queryIndex + query.length + 50 < d.content.length)
              preview = `${preview}...`;
          }
        }

        return {
          id: d.id,
          type: 'document' as const,
          title: d.fileName,
          preview: preview.trim(),
          createdAt: d.createdAt,
          documentType: d.category,
          matches: query ? [query] : [],
          source: 'user' as const,
        };
      });

      results.push(...docResults);

      // Add RAG search for user documents
      try {
        const ragResults = await searchRAGDocuments(
          session.user.id,
          query,
          personas,
        );
        results.push(...ragResults);
      } catch (error) {
        console.error('RAG search error:', error);
        // Continue without RAG results if there's an error
      }
    }

    // Calculate relevance scores for all results if there's a query
    if (query.trim()) {
      results.forEach((result) => {
        const titleScore = calculateRelevanceScore(result.title, query) * 2; // Title matches are more important
        const previewScore = calculateRelevanceScore(result.preview, query);
        result.score = Math.min((titleScore + previewScore) / 2, 1.0);
      });
    }

    // Sort results by relevance score (if query exists) or by date
    results.sort((a, b) => {
      if (query.trim() && a.score !== undefined && b.score !== undefined) {
        // Sort by relevance score first
        if (Math.abs(a.score - b.score) > 0.1) {
          return b.score - a.score;
        }
      }
      // Fall back to date sorting
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    // Generate suggestions based on recent searches and popular terms
    const suggestions = await generateSearchSuggestions(session.user.id);

    console.log(`=== SEARCH DEBUG END ===`);
    console.log(`Total results found: ${results.length}`);
    console.log(`Results by type:`);
    const resultsByType = results.reduce(
      (acc, r) => {
        acc[r.type] = (acc[r.type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
    console.log(resultsByType);
    console.log(
      `First 3 results:`,
      results.slice(0, 3).map((r) => ({ type: r.type, title: r.title })),
    );

    const limit = Math.min(Math.max(1, limitParam), 500);
    const offset = Math.max(0, offsetParam);
    const pagedResults = results.slice(offset, offset + limit);
    const nextOffset = offset + pagedResults.length;
    const hasMore = nextOffset < results.length;

    return NextResponse.json({
      results: pagedResults,
      suggestions,
      nextOffset,
      hasMore,
      total: results.length,
    });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}

// New function to search RAG documents
async function searchRAGDocuments(
  userId: string,
  query: string,
  personas: string[] = [],
) {
  const ragResults: any[] = [];

  try {
    // Import RAG functions with error handling
    const { findRelevantUserContent } = await import('@/lib/ai/user-rag');

    // Search user RAG documents
    try {
      const userRagResults = await findRelevantUserContent(
        userId,
        query,
        10,
        0.7,
      );

      userRagResults.forEach((result, index) => {
        ragResults.push({
          id: `user-rag-${userId}-${index}`,
          type: 'document' as const,
          title: `📄 ${result.metadata?.fileName || 'User Document'}`,
          preview:
            result.content.substring(0, 200) +
            (result.content.length > 200 ? '...' : ''),
          createdAt: new Date(result.metadata?.createdAt || Date.now()),
          documentType: result.metadata?.category || 'Document',
          matches: [query],
          source: 'user-rag' as const,
          score: result.relevance,
        });
      });
    } catch (userRagError) {
      console.error('Error searching user RAG documents:', userRagError);
    }

    // Search persona RAG documents if personas are specified
    if (personas.length > 0) {
      // Get persona IDs
      const personaRecords = await db
        .select({ id: persona.id, name: persona.name })
        .from(persona)
        .where(
          and(eq(persona.userId, userId), inArray(persona.name, personas)),
        );

      for (const personaRecord of personaRecords) {
        try {
          // Search persona-specific RAG documents using persona namespace
          const personaRagResults = await findRelevantUserContent(
            `persona-${personaRecord.id}`,
            query,
            5,
            0.7,
          );

          personaRagResults.forEach((result, index) => {
            ragResults.push({
              id: `persona-rag-${personaRecord.id}-${index}`,
              type: 'document' as const,
              title: `🤖 ${result.metadata?.fileName || 'Persona Document'} (${personaRecord.name})`,
              preview:
                result.content.substring(0, 200) +
                (result.content.length > 200 ? '...' : ''),
              createdAt: new Date(result.metadata?.createdAt || Date.now()),
              documentType: result.metadata?.category || 'Persona Document',
              matches: [query],
              source: 'persona-rag' as const,
              personaName: personaRecord.name,
              score: result.relevance,
            });
          });
        } catch (error) {
          console.error(
            `Error searching persona ${personaRecord.name} RAG:`,
            error,
          );
        }
      }
    }
  } catch (importError) {
    console.error('Error importing user-rag module:', importError);
    // Continue without RAG results if the module is not available
  }

  return ragResults;
}

async function generateSearchSuggestions(userId: string): Promise<string[]> {
  try {
    // Get recent chat titles
    const recentChats = await db
      .select({ title: chat.title })
      .from(chat)
      .where(eq(chat.userId, userId))
      .orderBy(desc(chat.createdAt))
      .limit(5);

    // Get document categories in use
    const categories = await db
      .selectDistinct({ category: userDocuments.category })
      .from(userDocuments)
      .where(eq(userDocuments.userId, userId));

    // Common search terms for EOS
    const commonTerms = [
      'scorecard',
      'rocks',
      'VTO',
      'core process',
      'quarterly',
    ];

    const suggestions = [
      ...recentChats.map((c) => c.title.split(' ').slice(0, 3).join(' ')),
      ...categories.map((c) => c.category),
      ...commonTerms,
    ];

    // Remove duplicates and limit
    return [...new Set(suggestions)].slice(0, 5);
  } catch (error) {
    console.error('Error generating suggestions:', error);
    return [];
  }
}
