import { auth } from '@/app/(auth)/auth';
import type { ArtifactKind } from '@/components/composer';
import {
  deleteDocumentsByIdAfterTimestamp,
  getDocumentsById,
  saveDocument,
} from '@/lib/db/queries';
import { db } from '@/lib/db/queries';
import { document as documentTable } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return new Response('Missing id', { status: 400 });
  }

  const session = await auth();

  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

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
  }: { content: string; title: string; kind: ArtifactKind } =
    await request.json();

  const documents = await getDocumentsById({ id });

  if (documents.length > 0) {
    const [document] = documents;

    if (document.userId !== session.user.id) {
      return new Response('Forbidden', { status: 403 });
    }
  }

  // Validate VTO content to avoid overwriting with invalid/empty state
  if (kind === 'vto') {
    // Allow empty content for initial creation
    if (content === '' || content === null) {
      // This is fine for initial creation
    } else if (content) {
      // Only validate if there's actual content
      const isValidVto = (() => {
        try {
          const hasBegin = content.includes('VTO_DATA_BEGIN');
          const hasEnd = content.includes('VTO_DATA_END');
          let jsonStr = content;
          if (hasBegin && hasEnd) {
            const start =
              content.indexOf('VTO_DATA_BEGIN') + 'VTO_DATA_BEGIN'.length;
            const end = content.indexOf('VTO_DATA_END');
            jsonStr = content.substring(start, end).trim();
          }
          const parsed = JSON.parse(jsonStr);
          return !!(parsed?.coreValues && parsed?.coreFocus);
        } catch {
          return false;
        }
      })();

      if (!isValidVto) {
        // Return existing documents without modifying the DB
        const existing = await getDocumentsById({ id });
        return Response.json(existing, { status: 200 });
      }
    }
  }

  const document = await saveDocument({
    id,
    content,
    title,
    kind,
    userId: session.user.id,
  });

  return Response.json(document, { status: 200 });
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
