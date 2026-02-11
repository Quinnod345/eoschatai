import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import { pinnedMessage, message, chat } from '@/lib/db/schema';
import { and, eq, desc } from 'drizzle-orm';

export async function POST(request: Request) {
  const session = await auth();

  if (!session || !session.user || !session.user.id) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Check entitlements for message pinning
    const { getAccessContext } = await import('@/lib/entitlements');
    const accessContext = await getAccessContext(session.user.id);

    if (!accessContext.entitlements.features.message_features.pin) {
      return new Response(
        JSON.stringify({
          error: 'Message pinning is a Pro feature',
          code: 'FEATURE_LOCKED',
          requiredPlan: 'pro',
          feature: 'message_features.pin',
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    const body = await request.json();
    const { messageId, chatId } = body;

    if (!messageId || !chatId) {
      return new Response(
        JSON.stringify({ error: 'messageId and chatId are required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    const [ownedMessage] = await db
      .select({ id: message.id })
      .from(message)
      .innerJoin(chat, eq(chat.id, message.chatId))
      .where(
        and(
          eq(message.id, messageId),
          eq(message.chatId, chatId),
          eq(chat.userId, session.user.id),
        ),
      )
      .limit(1);

    if (!ownedMessage) {
      return new Response(JSON.stringify({ error: 'Message not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check if already pinned
    const existing = await db
      .select()
      .from(pinnedMessage)
      .where(
        and(
          eq(pinnedMessage.userId, session.user.id),
          eq(pinnedMessage.messageId, messageId),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      // Already pinned, so unpin
      await db
        .delete(pinnedMessage)
        .where(
          and(
            eq(pinnedMessage.userId, session.user.id),
            eq(pinnedMessage.messageId, messageId),
          ),
        );

      return new Response(
        JSON.stringify({
          pinned: false,
          messageId,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    } else {
      // Pin the message
      const [newPinnedMessage] = await db
        .insert(pinnedMessage)
        .values({
          userId: session.user.id,
          messageId,
          chatId,
        })
        .returning();

      return new Response(
        JSON.stringify({
          pinned: true,
          id: newPinnedMessage.id,
          userId: newPinnedMessage.userId,
          messageId,
          chatId,
          pinnedAt: newPinnedMessage.pinnedAt,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }
  } catch (error) {
    console.error('Error pinning/unpinning message:', error);
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

  const { searchParams } = new URL(request.url);
  const chatId = searchParams.get('chatId');
  const scope = searchParams.get('scope');

  try {
    if (scope === 'global') {
      const globalPins = await db
        .select({
          id: pinnedMessage.id,
          messageId: pinnedMessage.messageId,
          chatId: pinnedMessage.chatId,
          pinnedAt: pinnedMessage.pinnedAt,
          chatTitle: chat.title,
          parts: message.parts,
          role: message.role,
        })
        .from(pinnedMessage)
        .innerJoin(message, eq(message.id, pinnedMessage.messageId))
        .innerJoin(chat, eq(chat.id, pinnedMessage.chatId))
        .where(eq(pinnedMessage.userId, session.user.id))
        .orderBy(desc(pinnedMessage.pinnedAt));

      const transformedPins = globalPins.map((pin) => {
        let content = '';
        if (pin.parts && Array.isArray(pin.parts)) {
          const textParts = pin.parts.filter(
            (part: any) => part.type === 'text',
          );
          content = textParts
            .map((part: any) => part.text)
            .join(' ')
            .trim();
        }
        return {
          ...pin,
          content,
          parts: undefined,
        };
      });

      return new Response(JSON.stringify(transformedPins), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } else if (chatId) {
      const pinned = await db
        .select({
          id: pinnedMessage.id,
          userId: pinnedMessage.userId,
          messageId: pinnedMessage.messageId,
          chatId: pinnedMessage.chatId,
          pinnedAt: pinnedMessage.pinnedAt,
        })
        .from(pinnedMessage)
        .where(
          and(
            eq(pinnedMessage.userId, session.user.id),
            eq(pinnedMessage.chatId, chatId),
          ),
        )
        .orderBy(desc(pinnedMessage.pinnedAt));

      return new Response(JSON.stringify(pinned), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } else {
      return new Response(
        JSON.stringify({ error: 'chatId or scope=global required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }
  } catch (error) {
    console.error('Error fetching pinned messages:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch pinned messages' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}
