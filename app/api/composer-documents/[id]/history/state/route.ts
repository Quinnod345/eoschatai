import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { getUndoRedoState } from '@/lib/db/document-history';
import { db } from '@/lib/db';
import { document } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// GET /api/composer-documents/[id]/history/state - Get undo/redo state
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const userId = session.user.id;
    const [doc] = await db
      .select({ id: document.id, userId: document.userId })
      .from(document)
      .where(eq(document.id, id));

    if (!doc || doc.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const state = await getUndoRedoState(id, userId);

    return NextResponse.json(state);
  } catch (error) {
    console.error('Error fetching undo/redo state:', error);
    return NextResponse.json(
      { error: 'Failed to fetch undo/redo state' },
      { status: 500 },
    );
  }
}
