import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import { chat } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';

export async function GET(
  _request: Request,
  props: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const params = await props.params;

  try {
    const [ownedChat] = await db
      .select({ id: chat.id })
      .from(chat)
      .where(and(eq(chat.id, params.id), eq(chat.userId, session.user.id)))
      .limit(1);

    if (!ownedChat) {
      return NextResponse.json({ exists: false }, { status: 404 });
    }

    return NextResponse.json({ exists: true });
  } catch (error) {
    console.error('[Chat Verify] Error:', error);
    return NextResponse.json(
      { exists: false, error: 'Failed to verify chat' },
      { status: 500 },
    );
  }
}
