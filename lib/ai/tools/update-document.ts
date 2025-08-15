import type { DataStreamWriter } from 'ai';
import { tool } from 'ai';
import type { Session } from 'next-auth';
import { z } from 'zod';
import { getDocumentById } from '@/lib/db/queries';
import { documentHandlersByArtifactKind } from '@/lib/composer/server';

interface UpdateDocumentProps {
  session: Session;
  dataStream: DataStreamWriter;
}

export const updateDocument = ({ session, dataStream }: UpdateDocumentProps) =>
  tool({
    description:
      'Update an existing document or artifact with the given description. MANDATORY: Use this tool WHENEVER the user asks to edit, modify, extend, improve, fix, change, expand, shorten, rewrite, polish, wordsmith, add to, remove from, or update existing content in ANY way. NEVER output edited text in the chat - always use this tool instead.',
    parameters: z.object({
      id: z.string().describe('The ID of the document to update'),
      description: z
        .string()
        .describe(
          'DETAILED description of the EXACT changes that need to be made. Be specific about what sections to modify, what content to add/remove/change, and how to preserve existing content. The more detailed this description, the better the edit will be.',
        ),
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
