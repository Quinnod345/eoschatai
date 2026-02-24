import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import { eq, count, asc } from 'drizzle-orm';
import * as schema from '@/lib/db/schema';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Get earliest chat for account age calculation
    const earliestChat = await db
      .select({ createdAt: schema.chat.createdAt })
      .from(schema.chat)
      .where(eq(schema.chat.userId, userId))
      .orderBy(asc(schema.chat.createdAt))
      .limit(1);

    // Get counts in parallel
    const [chatCount, messageCount, documentCount, userDocumentCount] =
      await Promise.all([
        db
          .select({ count: count() })
          .from(schema.chat)
          .where(eq(schema.chat.userId, userId)),
        db
          .select({ count: count() })
          .from(schema.message)
          .innerJoin(schema.chat, eq(schema.chat.id, schema.message.chatId))
          .where(eq(schema.chat.userId, userId)),
        db
          .select({ count: count() })
          .from(schema.document)
          .where(eq(schema.document.userId, userId)),
        db
          .select({ count: count() })
          .from(schema.userDocuments)
          .where(eq(schema.userDocuments.userId, userId)),
      ]);

    const accountAge = earliestChat[0]
      ? Math.floor(
          (Date.now() - new Date(earliestChat[0].createdAt).getTime()) /
            (1000 * 60 * 60 * 24),
        )
      : 0;

    const stats = {
      totalChats: chatCount[0]?.count || 0,
      totalMessages: messageCount[0]?.count || 0,
      totalDocuments:
        (documentCount[0]?.count || 0) + (userDocumentCount[0]?.count || 0),
      accountAge,
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching data stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch data statistics' },
      { status: 500 },
    );
  }
}
