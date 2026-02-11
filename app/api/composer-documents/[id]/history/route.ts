import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import {
  createDocumentVersion,
  getDocumentHistory,
  getOrCreateEditSession,
  updateEditSession,
} from '@/lib/db/document-history';
import { db } from '@/lib/db';
import { document, documentEditSession } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod/v3';

const DOCUMENT_KINDS = [
  'text',
  'code',
  'image',
  'sheet',
  'chart',
  'vto',
  'accountability',
] as const;
type DocumentKind = (typeof DOCUMENT_KINDS)[number];

const postHistoryBodySchema = z.object({
  title: z.string().trim().min(1).max(255),
  content: z.string().max(5_000_000),
  kind: z.enum(DOCUMENT_KINDS),
  sessionId: z.string().uuid().optional(),
});

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
    const parsedLimit = Number.parseInt(searchParams.get('limit') || '50', 10);
    const parsedOffset = Number.parseInt(searchParams.get('offset') || '0', 10);
    const limit = Number.isFinite(parsedLimit)
      ? Math.min(Math.max(parsedLimit, 1), 100)
      : 50;
    const offset = Number.isFinite(parsedOffset)
      ? Math.max(parsedOffset, 0)
      : 0;

    const { id } = await params;
    const [doc] = await db
      .select({ id: document.id, userId: document.userId })
      .from(document)
      .where(eq(document.id, id));

    if (!doc || doc.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

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

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch (error) {
      if (error instanceof SyntaxError) {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
      }
      throw error;
    }

    const parsedBody = postHistoryBodySchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: parsedBody.error.errors[0]?.message || 'Validation failed' },
        { status: 400 },
      );
    }

    const { title, content, kind, sessionId } = parsedBody.data as {
      title: string;
      content: string;
      kind: DocumentKind;
      sessionId?: string;
    };
    const userId = session.user.id;

    const { id } = await params;
    // Verify user owns the document or has access
    const [doc] = await db
      .select({ id: document.id, userId: document.userId })
      .from(document)
      .where(eq(document.id, id));

    if (!doc || doc.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get or create edit session
    let editSession: { id: string };
    if (sessionId) {
      const [existingSession] = await db
        .select({ id: documentEditSession.id })
        .from(documentEditSession)
        .where(
          and(
            eq(documentEditSession.id, sessionId),
            eq(documentEditSession.documentId, id),
            eq(documentEditSession.userId, userId),
          ),
        );

      if (!existingSession) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      editSession = { id: existingSession.id };
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
