import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import { eq } from 'drizzle-orm';
import * as schema from '@/lib/db/schema';

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Delete user data in the correct order (respecting foreign key constraints)

    // 1. Delete messages first
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

    // 2. Delete chats
    await db.delete(schema.chat).where(eq(schema.chat.userId, userId));

    // 3. Delete documents
    await db.delete(schema.document).where(eq(schema.document.userId, userId));
    await db
      .delete(schema.userDocuments)
      .where(eq(schema.userDocuments.userId, userId));

    // 4. Delete calendar tokens
    await db
      .delete(schema.googleCalendarToken)
      .where(eq(schema.googleCalendarToken.userId, userId));

    // 5. Finally delete the user
    await db.delete(schema.user).where(eq(schema.user.id, userId));

    return NextResponse.json({
      success: true,
      message: 'Account deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting account:', error);
    return NextResponse.json(
      { error: 'Failed to delete account' },
      { status: 500 },
    );
  }
}
