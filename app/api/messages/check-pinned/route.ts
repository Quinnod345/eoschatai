import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import { message, pinnedMessage } from '@/lib/db/schema';
import { and, eq, gte, inArray } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { messageId } = await request.json();

    if (!messageId) {
      return NextResponse.json(
        { error: 'Message ID is required' },
        { status: 400 },
      );
    }

    // Get the message to find its timestamp and chatId
    const [targetMessage] = await db
      .select()
      .from(message)
      .where(eq(message.id, messageId))
      .limit(1);

    if (!targetMessage) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    // Get all messages that would be deleted (after this timestamp in the same chat)
    const messagesToDelete = await db
      .select({ id: message.id })
      .from(message)
      .where(
        and(
          eq(message.chatId, targetMessage.chatId),
          gte(message.createdAt, targetMessage.createdAt),
        ),
      );

    const messageIds = messagesToDelete.map((msg) => msg.id);

    if (messageIds.length === 0) {
      return NextResponse.json({
        hasPinnedMessages: false,
        messageCount: 0,
        pinnedCount: 0,
      });
    }

    // Check if any of these messages are pinned
    const pinnedMessages = await db
      .select({ id: pinnedMessage.id })
      .from(pinnedMessage)
      .where(
        and(
          eq(pinnedMessage.chatId, targetMessage.chatId),
          inArray(pinnedMessage.messageId, messageIds),
        ),
      );

    return NextResponse.json({
      hasPinnedMessages: pinnedMessages.length > 0,
      messageCount: messageIds.length - 1, // Exclude the message being edited
      pinnedCount: pinnedMessages.length,
    });
  } catch (error) {
    console.error('Error checking pinned messages:', error);
    return NextResponse.json(
      { error: 'Failed to check pinned messages' },
      { status: 500 },
    );
  }
}
