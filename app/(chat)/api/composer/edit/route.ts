import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import type { ComposerKind } from '@/components/composer';
import { documentHandlersByComposerKind } from '@/lib/composer/server';
import { getDocumentById } from '@/lib/db/queries';
import type { UIMessageStreamWriter } from 'ai';

// UUID validation regex
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Max content length: 10MB
const MAX_CONTENT_LENGTH = 10 * 1024 * 1024;

// No-op DataStreamWriter used for non-streaming API
function createNoopStream(): UIMessageStreamWriter {
  return {
    write: () => Promise.resolve(),
    writeData: () => Promise.resolve(),
    writeMessageAnnotation: () => Promise.resolve(),
    writeSource: () => Promise.resolve(),
    merge: () => {},
    onError: (error: unknown) => `Error: ${String(error)}`,
  };
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      mode,
      id,
      title,
      kind,
      description,
    }: {
      mode: 'create' | 'update';
      id: string;
      title?: string;
      kind: ComposerKind;
      description?: string;
    } = body;

    // Validate document ID format
    if (!id || !UUID_REGEX.test(id)) {
      return NextResponse.json(
        { error: 'Invalid document ID format' },
        { status: 400 },
      );
    }

    // Validate title length
    if (title && title.length > 500) {
      return NextResponse.json(
        { error: 'Title too long (max 500 characters)' },
        { status: 400 },
      );
    }

    const handler = documentHandlersByComposerKind.find((h) => h.kind === kind);
    if (!handler) {
      return NextResponse.json({ error: 'Unsupported kind' }, { status: 400 });
    }

    const dataStream = createNoopStream();

    if (mode === 'create') {
      if (!title) {
        return NextResponse.json({ error: 'Title required' }, { status: 400 });
      }

      // Call composer create handler (it will return draft content and we persist via saveDocument)
      // Note: TypeScript doesn't allow direct calls due to type system limitations,
      // but we've verified the handler exists and matches the expected interface
      const createHandler = handler.onCreateDocument as (args: {
        id: string;
        title: string;
        dataStream: UIMessageStreamWriter;
        session: any;
      }) => Promise<void>;

      await createHandler({
        id,
        title,
        dataStream,
        session,
      });

      // Content will be saved by the handler, so we just need to return it
      const savedDocs = await getDocumentById({ id });
      const draftContentResult = savedDocs?.content || '';

      // Validate content length
      const contentLength = new Blob([draftContentResult || '']).size;
      if (contentLength > MAX_CONTENT_LENGTH) {
        return NextResponse.json(
          { error: 'Content too large (max 10MB)' },
          { status: 413 },
        );
      }

      // Handler already saved the document, no need to save again

      return NextResponse.json({
        id,
        title,
        kind,
        content: draftContentResult || '',
      });
    }

    // update
    const doc = await getDocumentById({ id });
    if (!doc || doc.userId !== session.user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Note: TypeScript doesn't allow direct calls due to type system limitations,
    // but we've verified the handler exists and matches the expected interface
    const updateHandler = handler.onUpdateDocument as (args: {
      document: any;
      description: string;
      dataStream: UIMessageStreamWriter;
      session: any;
    }) => Promise<void>;

    await updateHandler({
      document: doc,
      description: description || '',
      dataStream,
      session,
    });

    // Content will be saved by the handler, so we just need to return it
    const updatedDoc = await getDocumentById({ id });
    const newContent = updatedDoc?.content || '';

    // Validate content length
    const contentLength = new Blob([newContent || '']).size;
    if (contentLength > MAX_CONTENT_LENGTH) {
      return NextResponse.json(
        { error: 'Content too large (max 10MB)' },
        { status: 413 },
      );
    }

    // Handler already saved the document, no need to save again

    return NextResponse.json({
      id: doc.id,
      title: doc.title,
      kind,
      content: newContent || '',
    });
  } catch (error) {
    console.error('[composer-edit] Error processing request:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      {
        error: 'Failed to process composer request',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
