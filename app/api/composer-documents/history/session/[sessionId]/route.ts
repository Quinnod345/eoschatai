import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { endEditSession } from '@/lib/db/document-history';
import { db } from '@/lib/db';
import { documentEditSession } from '@/lib/db/schema';
import { validateUuidField } from '@/lib/api/validation';
import { eq } from 'drizzle-orm';

// DELETE /api/composer-documents/history/session/[sessionId] - End edit session
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId } = await params;
    const validatedSessionId = validateUuidField(sessionId, 'sessionId');
    if (!validatedSessionId.ok) {
      return NextResponse.json({ error: validatedSessionId.error }, { status: 400 });
    }

    const [editSession] = await db
      .select({ id: documentEditSession.id, userId: documentEditSession.userId })
      .from(documentEditSession)
      .where(eq(documentEditSession.id, validatedSessionId.value));

    if (!editSession || editSession.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await endEditSession(validatedSessionId.value);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error ending edit session:', error);
    return NextResponse.json(
      { error: 'Failed to end edit session' },
      { status: 500 },
    );
  }
}
