import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import type { ArtifactKind } from '@/components/composer';
import { documentHandlersByArtifactKind } from '@/lib/composer/server';
import { getDocumentById, saveDocument } from '@/lib/db/queries';
import type { DataStreamWriter } from 'ai';

// No-op DataStreamWriter used for non-streaming API
function createNoopStream(): DataStreamWriter {
  return {
    writeData: () => {},
    writeMessageAnnotation: () => {},
    writeText: () => {},
    close: () => {},
  } as unknown as DataStreamWriter;
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
      kind: ArtifactKind;
      description?: string;
    } = body;

    const handler = documentHandlersByArtifactKind.find((h) => h.kind === kind);
    if (!handler) {
      return NextResponse.json({ error: 'Unsupported kind' }, { status: 400 });
    }

    const dataStream = createNoopStream();

    if (mode === 'create') {
      if (!title) {
        return NextResponse.json({ error: 'Title required' }, { status: 400 });
      }

      // Call artifact create handler (it will return draft content and we persist via saveDocument)
      const draftContentResult = await (async () => {
        // Use handler through a shim similar to createDocumentHandler
        const content = await (handler as any).onCreateDocument({
          id,
          title,
          dataStream,
          session,
        });
        return content as string;
      })();

      await saveDocument({
        id,
        title,
        kind,
        content: draftContentResult || '',
        userId: session.user.id,
      });

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

    const newContent = await (handler as any).onUpdateDocument({
      document: doc,
      description: description || '',
      dataStream,
      session,
    });

    await saveDocument({
      id: doc.id,
      title: doc.title,
      kind,
      content: newContent || '',
      userId: session.user.id,
    });

    return NextResponse.json({
      id: doc.id,
      title: doc.title,
      kind,
      content: newContent || '',
    });
  } catch (error) {
    console.error('[artifact-edit] error', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
