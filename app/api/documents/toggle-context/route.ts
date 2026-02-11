import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import { userDocuments, document } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { processUserDocument, deleteUserDocument } from '@/lib/ai/user-rag';
import { validateUuidField } from '@/lib/api/validation';

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch (jsonError) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 },
      );
    }

    const { documentId, isContext, documentType } = body as {
      documentId?: string;
      isContext: boolean;
      documentType: 'user-document' | 'composer-document';
    };

    const validatedDocumentId = validateUuidField(documentId, 'documentId');
    if (!validatedDocumentId.ok || typeof isContext !== 'boolean' || !documentType) {
      return NextResponse.json(
        {
          error: 'Missing required fields: documentId, isContext, documentType',
        },
        { status: 400 },
      );
    }

    console.log(
      `Toggle context for ${documentType} ${validatedDocumentId.value}: ${isContext}`,
    );

    if (documentType === 'user-document') {
      // Handle user documents (uploaded files)
      // Verify ownership
      const docs = await db
        .select()
        .from(userDocuments)
        .where(
          and(
            eq(userDocuments.id, validatedDocumentId.value),
            eq(userDocuments.userId, session.user.id),
          ),
        );

      if (docs.length === 0) {
        return NextResponse.json(
          { error: 'Document not found or access denied' },
          { status: 404 },
        );
      }

      const doc = docs[0];

      // Update the isContext field
      await db
        .update(userDocuments)
        .set({ isContext, updatedAt: new Date() })
        .where(eq(userDocuments.id, validatedDocumentId.value));

      // Handle embeddings
      if (isContext) {
        // Generate and store embeddings
        console.log(
          `Generating embeddings for document ${validatedDocumentId.value}`,
        );
        try {
          await processUserDocument(
            session.user.id,
            validatedDocumentId.value,
            doc.content,
            {
              fileName: doc.fileName,
              category: doc.category,
              fileType: doc.fileType,
            },
          );
          console.log(
            `Successfully generated embeddings for ${validatedDocumentId.value}`,
          );
        } catch (error) {
          console.error('Error generating embeddings:', error);
          return NextResponse.json(
            {
              error: 'Failed to generate embeddings',
              details: error instanceof Error ? error.message : String(error),
            },
            { status: 500 },
          );
        }
      } else {
        // Delete embeddings
        console.log(`Deleting embeddings for document ${validatedDocumentId.value}`);
        try {
          await deleteUserDocument(session.user.id, validatedDocumentId.value);
          console.log(
            `Successfully deleted embeddings for ${validatedDocumentId.value}`,
          );
        } catch (error) {
          console.error('Error deleting embeddings:', error);
          return NextResponse.json(
            {
              error: 'Failed to delete embeddings',
              details: error instanceof Error ? error.message : String(error),
            },
            { status: 500 },
          );
        }
      }

      return NextResponse.json({
        success: true,
        message: isContext
          ? 'Document enabled as context with embeddings'
          : 'Document disabled from context and embeddings removed',
        documentId: validatedDocumentId.value,
        isContext,
      });
    } else if (documentType === 'composer-document') {
      // Handle composer documents
      // Verify ownership
      const docs = await db
        .select()
        .from(document)
        .where(
          and(
            eq(document.id, validatedDocumentId.value),
            eq(document.userId, session.user.id),
          ),
        );

      if (docs.length === 0) {
        return NextResponse.json(
          { error: 'Composer document not found or access denied' },
          { status: 404 },
        );
      }

      const doc = docs[0];

      // Update the isContext field
      await db
        .update(document)
        .set({ isContext })
        .where(eq(document.id, validatedDocumentId.value));

      // Handle embeddings for composer documents
      if (isContext && doc.content) {
        // Generate and store embeddings
        console.log(
          `Generating embeddings for composer document ${validatedDocumentId.value}`,
        );
        try {
          await processUserDocument(
            session.user.id,
            validatedDocumentId.value,
            doc.content,
            {
              fileName: doc.title || 'Composer Document',
              category: doc.kind as any,
              fileType: doc.kind || 'text',
            },
          );
          console.log(
            `Successfully generated embeddings for composer ${validatedDocumentId.value}`,
          );
        } catch (error) {
          console.error('Error generating embeddings for composer:', error);
          return NextResponse.json(
            {
              error: 'Failed to generate embeddings for composer document',
              details: error instanceof Error ? error.message : String(error),
            },
            { status: 500 },
          );
        }
      } else if (!isContext) {
        // Delete embeddings
        console.log(
          `Deleting embeddings for composer document ${validatedDocumentId.value}`,
        );
        try {
          await deleteUserDocument(session.user.id, validatedDocumentId.value);
          console.log(
            `Successfully deleted embeddings for composer ${validatedDocumentId.value}`,
          );
        } catch (error) {
          console.error('Error deleting embeddings from composer:', error);
          return NextResponse.json(
            {
              error: 'Failed to delete embeddings for composer document',
              details: error instanceof Error ? error.message : String(error),
            },
            { status: 500 },
          );
        }
      }

      return NextResponse.json({
        success: true,
        message: isContext
          ? 'Composer document enabled as context with embeddings'
          : 'Composer document disabled from context and embeddings removed',
        documentId: validatedDocumentId.value,
        isContext,
      });
    } else {
      return NextResponse.json(
        { error: 'Invalid document type' },
        { status: 400 },
      );
    }
  } catch (error) {
    console.error('Error toggling document context:', error);
    return NextResponse.json(
      {
        error: 'Failed to toggle document context',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
