import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import { userDocuments, persona } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { personaId, documentId, fileName, category } = body;

    if (!personaId || !documentId) {
      return NextResponse.json(
        { error: 'Persona ID and document ID are required' },
        { status: 400 },
      );
    }

    console.log('PERSONA_DOCUMENT_API: Processing document for persona', {
      personaId,
      documentId,
      fileName,
      userId: session.user.id,
    });

    // Verify the persona belongs to the user
    const [personaData] = await db
      .select()
      .from(persona)
      .where(
        and(eq(persona.id, personaId), eq(persona.userId, session.user.id)),
      );

    if (!personaData) {
      return NextResponse.json(
        { error: 'Persona not found or unauthorized' },
        { status: 403 },
      );
    }

    // Get the document content
    const [document] = await db
      .select()
      .from(userDocuments)
      .where(
        and(
          eq(userDocuments.id, documentId),
          eq(userDocuments.userId, session.user.id),
        ),
      );

    if (!document || !document.content) {
      return NextResponse.json(
        { error: 'Document not found or has no content' },
        { status: 404 },
      );
    }

    // Process the document into the persona's namespace
    const { processUserDocument } = await import('@/lib/ai/user-rag');

    await processUserDocument(
      personaId, // Use persona ID as namespace
      documentId,
      document.content,
      {
        fileName: fileName || document.fileName,
        category: category || document.category,
        fileType: document.fileType || 'unknown',
      },
    );

    console.log('PERSONA_DOCUMENT_API: Successfully processed document', {
      personaId,
      documentId,
      namespace: personaId,
    });

    return NextResponse.json({
      success: true,
      message: 'Document processed successfully',
      documentId,
      personaId,
    });
  } catch (error) {
    console.error('PERSONA_DOCUMENT_API: Error processing document:', error);
    return NextResponse.json(
      { error: 'Failed to process document' },
      { status: 500 },
    );
  }
}
