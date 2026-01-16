import { auth } from '@/app/(auth)/auth';
import type { ComposerKind } from '@/components/composer';
import {
  deleteDocumentsByIdAfterTimestamp,
  getDocumentsById,
} from '@/lib/db/queries';
import { db } from '@/lib/db/queries';
import { document as documentTable } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import {
  saveDocumentWithVersion,
  getDocumentVersionsAsDocuments,
} from '@/lib/db/document-service';
import { isValidVtoContent } from '@/lib/composer/content-parsers';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const includeVersions = searchParams.get('versions') === 'true';

  if (!id) {
    return new Response('Missing id', { status: 400 });
  }

  const session = await auth();

  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Use new version-aware query if versions are requested
  if (includeVersions) {
    const documents = await getDocumentVersionsAsDocuments(id);
    if (documents.length === 0) {
      return new Response('Not found', { status: 404 });
    }
    if (documents[0].userId !== session.user.id) {
      return new Response('Forbidden', { status: 403 });
    }
    return Response.json(documents, { status: 200 });
  }

  // Default: use existing query for backwards compatibility
  const documents = await getDocumentsById({ id });

  const [document] = documents;

  if (!document) {
    return new Response('Not found', { status: 404 });
  }

  if (document.userId !== session.user.id) {
    return new Response('Forbidden', { status: 403 });
  }

  return Response.json(documents, { status: 200 });
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const skipVersion = searchParams.get('skipVersion') === 'true';

  if (!id) {
    return new Response('Missing id', { status: 400 });
  }

  const session = await auth();

  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const {
    content,
    title,
    kind,
    source,
  }: {
    content: string;
    title: string;
    kind: ComposerKind;
    source?: 'user' | 'ai' | 'system';
  } = await request.json();

  // Check ownership for existing documents
  const existingDocs = await getDocumentsById({ id });
  if (existingDocs.length > 0) {
    const [existingDoc] = existingDocs;
    if (existingDoc.userId !== session.user.id) {
      return new Response('Forbidden', { status: 403 });
    }
  }

  // Validate VTO content to avoid overwriting with invalid/empty state
  if (kind === 'vto') {
    // Allow empty content for initial creation
    if (content && content.trim().length > 0) {
      // Only validate if there's actual content
      if (!isValidVtoContent(content)) {
        // Return existing documents without modifying the DB
        return Response.json(existingDocs, { status: 200 });
      }
    }
  }

  // Use unified service that creates versions atomically
  const isNewDocument = existingDocs.length === 0;
  const result = await saveDocumentWithVersion({
    id,
    content,
    title,
    kind,
    userId: session.user.id,
    // Create version for updates, not for initial creates (unless explicitly requested)
    createVersion: !skipVersion && !isNewDocument,
    source: source || 'user',
  });

  // Return version history for compatibility
  const versionHistory = await getDocumentVersionsAsDocuments(id);
  return Response.json(versionHistory, { status: 200 });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const timestamp = searchParams.get('timestamp');
  const deleteAll = searchParams.get('all') === 'true';

  if (!id) {
    return new Response('Missing id', { status: 400 });
  }

  if (!deleteAll && !timestamp) {
    return new Response('Missing timestamp', { status: 400 });
  }

  const session = await auth();

  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const documents = await getDocumentsById({ id });

  const [document] = documents;

  if (document.userId !== session.user.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  if (deleteAll) {
    await db.delete(documentTable).where(eq(documentTable.id, id));
    return Response.json({ deleted: 'all' }, { status: 200 });
  }

  const documentsDeleted = await deleteDocumentsByIdAfterTimestamp({
    id,
    timestamp: new Date(timestamp as string),
  });

  return Response.json(documentsDeleted, { status: 200 });
}

// Rename a document title (non-versioned metadata update)
export async function PATCH(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return new Response('Missing id', { status: 400 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { title }: { title: string } = await request.json();
  if (!title || title.trim().length === 0) {
    return new Response('Invalid title', { status: 400 });
  }

  // Ensure ownership
  const documents = await getDocumentsById({ id });
  const [doc] = documents;
  if (!doc) return new Response('Not found', { status: 404 });
  if (doc.userId !== session.user.id)
    return new Response('Forbidden', { status: 403 });

  await db
    .update(documentTable)
    .set({ title })
    .where(
      and(eq(documentTable.id, id), eq(documentTable.userId, session.user.id)),
    );

  return Response.json({ id, title }, { status: 200 });
}
