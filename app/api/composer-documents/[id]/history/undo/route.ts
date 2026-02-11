import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { undoDocumentChange } from '@/lib/db/document-history';
import { db } from '@/lib/db';
import { document } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// POST /api/composer-documents/[id]/history/undo - Undo to previous version
export async function POST(
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

    const version = await undoDocumentChange(id, userId);

    return NextResponse.json(version);
  } catch (error) {
    console.error('Error performing undo:', error);
    return NextResponse.json(
      { error: 'Failed to undo' },
      { status: 400 },
    );
  }
}
