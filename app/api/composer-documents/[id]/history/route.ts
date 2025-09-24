import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import {
  createDocumentVersion,
  getDocumentHistory,
  getOrCreateEditSession,
  updateEditSession,
} from '@/lib/db/document-history';
import { db } from '@/lib/db';
import { document } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// GET /api/composer-documents/[id]/history - Get document history
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const { id } = await params;
    const history = await getDocumentHistory(id, limit, offset);

    return NextResponse.json(history);
  } catch (error) {
    console.error('Error fetching document history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch document history' },
      { status: 500 },
    );
  }
}

// POST /api/composer-documents/[id]/history - Create new version
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { userId, title, content, kind, sessionId } = body;

    const { id } = await params;
    // Verify user owns the document or has access
    const [doc] = await db.select().from(document).where(eq(document.id, id));

    if (!doc || doc.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get or create edit session
    let editSession;
    if (sessionId) {
      editSession = { id: sessionId };
      await updateEditSession(sessionId);
    } else {
      editSession = await getOrCreateEditSession(id, userId);
    }

    // Create new version
    const result = await createDocumentVersion(
      id,
      userId,
      title,
      content,
      kind,
      'update',
      { sessionId: editSession.id },
    );

    return NextResponse.json({
      ...result,
      sessionId: editSession.id,
    });
  } catch (error) {
    console.error('Error creating document version:', error);
    return NextResponse.json(
      { error: 'Failed to create document version' },
      { status: 500 },
    );
  }
}
