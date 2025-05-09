import { db } from '@/lib/db';
import { document } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { processDocument } from '../embeddings';
import { tool } from 'ai';
import { z } from 'zod';
import type { DataStreamWriter } from 'ai';

interface IndexDocumentsProps {
  dataStream: DataStreamWriter;
}

export const indexDocumentsTool = ({ dataStream }: IndexDocumentsProps) =>
  tool({
    description:
      'Index existing documents to make them searchable through the EOS knowledge base',
    parameters: z.object({
      documentId: z
        .string()
        .optional()
        .describe(
          'Specific document ID to index, leave empty to index all text documents',
        ),
      reindex: z
        .boolean()
        .default(false)
        .describe('Whether to reindex documents that already have embeddings'),
    }),
    execute: async ({ documentId, reindex = false }) => {
      try {
        // Log that we're indexing documents
        dataStream.writeData('Indexing documents...');

        // Build query
        const query = documentId
          ? db.select().from(document).where(eq(document.id, documentId))
          : db.select().from(document).where(eq(document.kind, 'text'));

        // Fetch documents
        const docs = await query;

        if (docs.length === 0) {
          return {
            success: false,
            message: documentId
              ? `No document found with ID: ${documentId}`
              : 'No text documents found to index',
          };
        }

        // Process each document
        let indexed = 0;
        let skipped = 0;

        for (const doc of docs) {
          // Skip documents with no content
          if (!doc.content) {
            skipped++;
            continue;
          }

          try {
            // Process the document - will be stored in Upstash Vector
            await processDocument(doc.id, doc.content);
            indexed++;

            // Provide progress updates
            if (docs.length > 1) {
              dataStream.writeData(
                `Indexed ${indexed} of ${docs.length} documents...`,
              );
            }
          } catch (error) {
            console.error(`Error indexing document ${doc.id}:`, error);
            skipped++;
          }
        }

        return {
          success: true,
          message: `Successfully indexed ${indexed} documents. ${skipped} documents were skipped.`,
          indexed,
          skipped,
        };
      } catch (error) {
        console.error('Error indexing documents:', error);
        return {
          success: false,
          message: 'Error indexing documents.',
        };
      }
    },
  });
