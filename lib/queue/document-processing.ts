import 'server-only';

import { db } from '@/lib/db';
import { userDocuments } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { processUserDocument } from '@/lib/ai/user-rag';

/**
 * Process a document for RAG embedding with retry logic
 */
export async function processDocumentForRAG(
  userId: string,
  documentId: string,
  content: string,
  metadata: {
    fileName: string;
    category: string;
    fileType: string;
  },
  maxRetries = 3,
): Promise<void> {
  let attempt = 0;
  let lastError: Error | null = null;

  while (attempt < maxRetries) {
    try {
      // Update status to processing
      await db
        .update(userDocuments)
        .set({ processingStatus: 'processing' })
        .where(eq(userDocuments.id, documentId));

      // Process the document
      await processUserDocument(userId, documentId, content, metadata);

      // Update status to ready
      await db
        .update(userDocuments)
        .set({
          processingStatus: 'ready',
          processingError: null,
        })
        .where(eq(userDocuments.id, documentId));

      console.log(
        `Successfully processed document ${documentId} (${metadata.fileName})`,
      );
      return; // Success - exit
    } catch (error) {
      attempt++;
      lastError = error instanceof Error ? error : new Error('Unknown error');

      console.error(
        `Error processing document ${documentId} (attempt ${attempt}/${maxRetries}):`,
        error,
      );

      // Wait before retrying (exponential backoff)
      if (attempt < maxRetries) {
        await new Promise((resolve) =>
          setTimeout(resolve, 1000 * 2 ** attempt),
        );
      }
    }
  }

  // All retries failed
  await db
    .update(userDocuments)
    .set({
      processingStatus: 'failed',
      processingError: lastError?.message || 'Processing failed after retries',
    })
    .where(eq(userDocuments.id, documentId));

  console.error(
    `Failed to process document ${documentId} after ${maxRetries} attempts`,
  );
}

/**
 * Reprocess a failed document
 */
export async function retryDocumentProcessing(
  documentId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const [document] = await db
      .select()
      .from(userDocuments)
      .where(eq(userDocuments.id, documentId));

    if (!document) {
      return { success: false, error: 'Document not found' };
    }

    if (!document.content) {
      return { success: false, error: 'Document has no content' };
    }

    // Start processing
    await processDocumentForRAG(
      document.userId,
      document.id,
      document.content,
      {
        fileName: document.fileName,
        category: document.category,
        fileType: document.fileType,
      },
    );

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get processing statistics for a user
 */
export async function getProcessingStats(userId: string): Promise<{
  total: number;
  pending: number;
  processing: number;
  ready: number;
  failed: number;
}> {
  const documents = await db
    .select({ processingStatus: userDocuments.processingStatus })
    .from(userDocuments)
    .where(eq(userDocuments.userId, userId));

  const stats = {
    total: documents.length,
    pending: 0,
    processing: 0,
    ready: 0,
    failed: 0,
  };

  for (const doc of documents) {
    const status = doc.processingStatus || 'ready';
    if (status in stats) {
      stats[status as keyof typeof stats]++;
    }
  }

  return stats;
}


