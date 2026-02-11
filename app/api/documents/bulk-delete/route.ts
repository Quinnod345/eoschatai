import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import { userDocuments } from '@/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { del } from '@vercel/blob';
import { deleteUserDocument } from '@/lib/ai/user-rag';
import { updateUserStorage } from '@/lib/storage/tracking';
import { uuidArraySchema } from '@/lib/api/validation';

interface BulkDeleteResult {
  success: string[];
  failed: Array<{ id: string; error: string }>;
  totalDeleted: number;
  totalFailed: number;
  storageFreed: number;
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch (jsonError) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 },
      );
    }
    const { documentIds } = body as { documentIds: string[] };

    if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
      return NextResponse.json(
        { error: 'documentIds array is required' },
        { status: 400 },
      );
    }

    const validatedDocumentIds = uuidArraySchema.safeParse(documentIds);
    if (!validatedDocumentIds.success) {
      return NextResponse.json(
        { error: 'documentIds must be an array of UUIDs' },
        { status: 400 },
      );
    }
    const uniqueDocumentIds = Array.from(new Set(validatedDocumentIds.data));

    // Limit bulk operations to prevent abuse
    if (uniqueDocumentIds.length > 100) {
      return NextResponse.json(
        { error: 'Cannot delete more than 100 documents at once' },
        { status: 400 },
      );
    }

    // Fetch all documents to verify ownership
    const documents = await db
      .select()
      .from(userDocuments)
      .where(
        and(
          inArray(userDocuments.id, uniqueDocumentIds),
          eq(userDocuments.userId, session.user.id),
        ),
      );

    if (documents.length === 0) {
      return NextResponse.json(
        { error: 'No documents found or you do not own these documents' },
        { status: 404 },
      );
    }

    const result: BulkDeleteResult = {
      success: [],
      failed: [],
      totalDeleted: 0,
      totalFailed: 0,
      storageFreed: 0,
    };

    // Process each document
    for (const doc of documents) {
      try {
        // 1. Delete from vector database (RAG embeddings)
        try {
          await deleteUserDocument(session.user.id, doc.id);
          console.log(`Deleted embeddings for document ${doc.id}`);
        } catch (ragError) {
          console.error(`Error deleting RAG embeddings for ${doc.id}:`, ragError);
          // Continue with deletion even if RAG cleanup fails
        }

        // 2. Delete blob file from Vercel Blob
        try {
          await del(doc.fileUrl);
          console.log(`Deleted blob file for document ${doc.id}`);
        } catch (blobError) {
          console.error(`Error deleting blob for ${doc.id}:`, blobError);
          // Continue with deletion even if blob cleanup fails
        }

        // 3. Delete from database
        await db
          .delete(userDocuments)
          .where(eq(userDocuments.id, doc.id));

        result.success.push(doc.id);
        result.totalDeleted++;
        result.storageFreed += doc.fileSize;
      } catch (error) {
        console.error(`Error deleting document ${doc.id}:`, error);
        result.failed.push({
          id: doc.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        result.totalFailed++;
      }
    }

    // 4. Update user's storage counter
    if (result.storageFreed > 0) {
      try {
        await updateUserStorage(session.user.id, -result.storageFreed);
        console.log(
          `Updated storage for user ${session.user.id}: freed ${result.storageFreed} bytes`,
        );
      } catch (storageError) {
        console.error('Error updating user storage:', storageError);
        // Don't fail the request if storage update fails
      }
    }

    return NextResponse.json({
      message: `Successfully deleted ${result.totalDeleted} document(s)`,
      result,
    });
  } catch (error) {
    console.error('Error in bulk delete:', error);
    return NextResponse.json(
      { error: 'Failed to delete documents' },
      { status: 500 },
    );
  }
}


