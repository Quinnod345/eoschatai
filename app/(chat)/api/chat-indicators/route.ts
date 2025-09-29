import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import { pinnedMessage, bookmarkedChat } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';

export async function GET(request: Request) {
  const session = await auth();

  if (!session || !session.user || !session.user.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    // Get counts of pinned messages per chat
    const pinnedCounts = await db
      .select({
        chatId: pinnedMessage.chatId,
        count: sql<number>`count(*)::int`,
      })
      .from(pinnedMessage)
      .where(eq(pinnedMessage.userId, session.user.id))
      .groupBy(pinnedMessage.chatId);

    // Get bookmarked chats (1 or 0 for each chat)
    const bookmarkedChats = await db
      .select({
        chatId: bookmarkedChat.chatId,
      })
      .from(bookmarkedChat)
      .where(eq(bookmarkedChat.userId, session.user.id));

    // Convert to maps for easier lookup
    const indicators = {
      pinned: pinnedCounts.reduce(
        (acc, { chatId, count }) => {
          acc[chatId] = count;
          return acc;
        },
        {} as Record<string, number>,
      ),
      bookmarked: bookmarkedChats.reduce(
        (acc, { chatId }) => {
          acc[chatId] = 1; // Chat is bookmarked
          return acc;
        },
        {} as Record<string, number>,
      ),
    };

    return new Response(JSON.stringify(indicators), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching chat indicators:', error);
    // Fail soft with empty indicators to avoid UI errors
    const empty = { pinned: {}, bookmarked: {} } as const;
    return new Response(JSON.stringify(empty), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
