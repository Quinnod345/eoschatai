import type { UIMessageStreamWriter } from 'ai';
import { generateId, tool } from 'ai';
import type { Session } from 'next-auth';
import { z } from 'zod/v3';
import { getDocumentById } from '@/lib/db/queries';
import { documentHandlersByComposerKind } from '@/lib/composer/server';

interface UpdateDocumentProps {
  session: Session;
  dataStream: UIMessageStreamWriter;
  artifactMaxTokens?: number;
}

export const updateDocument = ({
  session,
  dataStream,
  artifactMaxTokens,
}: UpdateDocumentProps) =>
  tool({
    description:
      'Update an existing document or composer with the given description. MANDATORY: Use this tool WHENEVER the user asks to edit, modify, extend, improve, fix, change, expand, shorten, rewrite, polish, wordsmith, add to, remove from, or update existing content in ANY way. NEVER output edited text in the chat - always use this tool instead.',
    inputSchema: z.object({
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

      dataStream.write({
        type: 'data-tool',
        id: generateId(),
        data: {
          type: 'clear',
          content: document.title,
        },
      });

      // Send AI edit metadata to the frontend
      dataStream.write({
        type: 'data-tool',
        id: generateId(),
        data: {
          type: 'ai-edit-start',
          content: JSON.stringify({
            documentId: id,
            description,
            originalContent: document.content,
            timestamp: new Date().toISOString(),
          }),
        },
      });

      const documentHandler = documentHandlersByComposerKind.find(
        (documentHandlerByComposerKind) =>
          documentHandlerByComposerKind.kind === document.kind,
      );

      if (!documentHandler) {
        throw new Error(`No document handler found for kind: ${document.kind}`);
      }

      await documentHandler.onUpdateDocument({
        document,
        description,
        dataStream,
        session,
        maxOutputTokens: artifactMaxTokens,
      });

      // Send completion signal with AI edit metadata
      dataStream.write({
        type: 'data-tool',
        id: generateId(),
        data: {
          type: 'ai-edit-complete',
          content: JSON.stringify({
            documentId: id,
            description,
            timestamp: new Date().toISOString(),
          }),
        },
      });

      dataStream.write({
        type: 'data-tool',
        id: generateId(),
        data: { type: 'finish', content: '' },
      });

      return {
        id,
        title: document.title,
        kind: document.kind,
        content: 'The document has been updated successfully.',
      };
    },
  });
