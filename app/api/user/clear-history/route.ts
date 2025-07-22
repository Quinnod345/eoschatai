import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import { eq } from 'drizzle-orm';
import * as schema from '@/lib/db/schema';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Delete all messages for the user's chats first (due to foreign key constraints)
    await db
      .delete(schema.message)
      .where(
        eq(
          schema.message.chatId,
          db
            .select({ id: schema.chat.id })
            .from(schema.chat)
            .where(eq(schema.chat.userId, userId)),
        ),
      );

    // Then delete all chats for the user
    const result = await db
      .delete(schema.chat)
      .where(eq(schema.chat.userId, userId));

    return NextResponse.json({
      success: true,
      message: 'Chat history cleared successfully',
    });
  } catch (error) {
    console.error('Error clearing chat history:', error);
    return NextResponse.json(
      { error: 'Failed to clear chat history' },
      { status: 500 },
    );
  }
}
