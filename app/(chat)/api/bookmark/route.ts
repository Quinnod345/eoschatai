import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import { bookmarkedChat, chat, message } from '@/lib/db/schema';
import { getDisplayTitle } from '@/lib/utils/chat-utils';
import { and, eq, desc, sql } from 'drizzle-orm';

export async function POST(request: Request) {
  const session = await auth();

  if (!session || !session.user || !session.user.id) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Check entitlements for chat bookmarking
    const { getAccessContext } = await import('@/lib/entitlements');
    const accessContext = await getAccessContext(session.user.id);

    if (!accessContext.entitlements.features.message_features.bookmark) {
      return new Response(
        JSON.stringify({
          error: 'Chat bookmarking is a Pro feature',
          code: 'FEATURE_LOCKED',
          requiredPlan: 'pro',
          feature: 'message_features.bookmark',
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    const body = await request.json();
    const { chatId, note } = body;

    if (!chatId) {
      return new Response(JSON.stringify({ error: 'chatId is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const [ownedChat] = await db
      .select({ id: chat.id })
      .from(chat)
      .where(and(eq(chat.id, chatId), eq(chat.userId, session.user.id)))
      .limit(1);

    if (!ownedChat) {
      return new Response(JSON.stringify({ error: 'Chat not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check if already bookmarked
    const existing = await db
      .select()
      .from(bookmarkedChat)
      .where(
        and(
          eq(bookmarkedChat.userId, session.user.id),
          eq(bookmarkedChat.chatId, chatId),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      // Already bookmarked, so unbookmark
      await db
        .delete(bookmarkedChat)
        .where(
          and(
            eq(bookmarkedChat.userId, session.user.id),
            eq(bookmarkedChat.chatId, chatId),
          ),
        );

      return new Response(
        JSON.stringify({
          bookmarked: false,
          chatId,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    } else {
      // Bookmark the chat
      const [newBookmarkedChat] = await db
        .insert(bookmarkedChat)
        .values({
          userId: session.user.id,
          chatId,
          note: note || null,
        })
        .returning();

      return new Response(
        JSON.stringify({
          bookmarked: true,
          bookmark: {
            id: newBookmarkedChat.id,
            userId: newBookmarkedChat.userId,
            chatId,
            note: newBookmarkedChat.note,
            bookmarkedAt: newBookmarkedChat.bookmarkedAt,
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }
  } catch (error) {
    console.error('Error bookmarking/unbookmarking chat:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function GET(request: Request) {
  const session = await auth();

  if (!session || !session.user || !session.user.id) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const bookmarks = await db
      .select({
        id: bookmarkedChat.id,
        chatId: bookmarkedChat.chatId,
        bookmarkedAt: bookmarkedChat.bookmarkedAt,
        note: bookmarkedChat.note,
        title: chat.title,
        createdAt: chat.createdAt,
        messageCount: sql<number>`count(${message.id})`,
        lastMessageAt: sql<Date>`max(${message.createdAt})`,
      })
      .from(bookmarkedChat)
      .innerJoin(chat, eq(chat.id, bookmarkedChat.chatId))
      .leftJoin(message, eq(message.chatId, chat.id))
      .where(eq(bookmarkedChat.userId, session.user.id))
      .groupBy(bookmarkedChat.id, chat.id)
      .orderBy(desc(bookmarkedChat.bookmarkedAt));

    // Clean chat titles before returning
    const cleanedBookmarks = bookmarks.map((bookmark) => ({
      ...bookmark,
      title: getDisplayTitle(bookmark.title),
    }));

    return new Response(JSON.stringify(cleanedBookmarks), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching bookmarked chats:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch bookmarks' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}

export async function PUT(request: Request) {
  const session = await auth();

  if (!session || !session.user || !session.user.id) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await request.json();
    const { chatId, note } = body;

    if (!chatId) {
      return new Response(JSON.stringify({ error: 'chatId is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const [ownedChat] = await db
      .select({ id: chat.id })
      .from(chat)
      .where(and(eq(chat.id, chatId), eq(chat.userId, session.user.id)))
      .limit(1);

    if (!ownedChat) {
      return new Response(JSON.stringify({ error: 'Chat not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Update existing bookmark note
    const [updatedBookmark] = await db
      .update(bookmarkedChat)
      .set({
        note: note || null,
        bookmarkedAt: new Date(), // Update timestamp
      })
      .where(
        and(
          eq(bookmarkedChat.userId, session.user.id),
          eq(bookmarkedChat.chatId, chatId),
        ),
      )
      .returning();

    if (!updatedBookmark) {
      return new Response(JSON.stringify({ error: 'Bookmark not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        bookmark: updatedBookmark,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error('Error updating bookmark:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
