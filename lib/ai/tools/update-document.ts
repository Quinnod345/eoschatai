import type { DataStreamWriter } from 'ai';
import { tool } from 'ai';
import type { Session } from 'next-auth';
import { z } from 'zod';
import { getDocumentById, } from '@/lib/db/queries';
import { documentHandlersByArtifactKind } from '@/lib/artifacts/server';

interface UpdateDocumentProps {
  session: Session;
  dataStream: DataStreamWriter;
}

export const updateDocument = ({ session, dataStream }: UpdateDocumentProps) =>
  tool({
    description:
      'Update an existing document or artifact with the given description. Use this tool when the user wants to modify, extend, improve, or fix existing content.',
    parameters: z.object({
      id: z.string().describe('The ID of the document to update'),
      description: z
        .string()
        .describe('The description of changes that need to be made'),
    }),
    execute: async ({ id, description }) => {
      const document = await getDocumentById({ id });

      if (!document) {
        return {
          error: 'Document not found',
        };
      }

      dataStream.writeData({
        type: 'clear',
        content: document.title,
      });

      // Send AI edit metadata to the frontend
      dataStream.writeData({
        type: 'ai-edit-start',
        content: JSON.stringify({
          documentId: id,
          description,
          originalContent: document.content,
          timestamp: new Date().toISOString(),
        }),
      });

      const documentHandler = documentHandlersByArtifactKind.find(
        (documentHandlerByArtifactKind) =>
          documentHandlerByArtifactKind.kind === document.kind,
      );

      if (!documentHandler) {
        throw new Error(`No document handler found for kind: ${document.kind}`);
      }

      await documentHandler.onUpdateDocument({
        document,
        description,
        dataStream,
        session,
      });

      // Send completion signal with AI edit metadata
      dataStream.writeData({
        type: 'ai-edit-complete',
        content: JSON.stringify({
          documentId: id,
          description,
          timestamp: new Date().toISOString(),
        }),
      });

      dataStream.writeData({ type: 'finish', content: '' });

      return {
        id,
        title: document.title,
        kind: document.kind,
        content: 'The document has been updated successfully.',
      };
    },
  });
