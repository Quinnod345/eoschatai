import { generateUUID } from '@/lib/utils';
import { generateId, tool } from 'ai';
import type { UIMessageStreamWriter } from 'ai';
import { z } from 'zod/v3';
import type { Session } from 'next-auth';
import {
  composerKinds,
  documentHandlersByComposerKind,
} from '@/lib/composer/server';

interface CreateDocumentProps {
  session: Session;
  dataStream: UIMessageStreamWriter;
  artifactMaxTokens?: number;
  // Optional: original user query/context to guide artifact generation
  context?: string;
}

export const createDocument = ({
  session,
  dataStream,
  artifactMaxTokens,
  context,
}: CreateDocumentProps) =>
  tool({
    description:
      'Create a document, artifact, or composer for content creation. ' +
      'MANDATORY: Use this tool WHENEVER the user asks to create, build, generate, ' +
      'draft, or make any document, template, chart, spreadsheet, V/TO, accountability chart, ' +
      'scorecard, or structured content. NEVER say you created a document without calling this tool. ' +
      'The tool call is what opens the composer for the user.',
    inputSchema: z.object({
      title: z.string(),
      kind: z.enum(composerKinds),
    }),
    execute: async ({ title, kind }) => {
      try {
        const id = generateUUID();

        console.log(`[createDocument] Starting document creation with kind: ${kind}, title: ${title}`);

        console.log(`[createDocument] Writing kind to dataStream: ${kind}`);
        dataStream.write({
          type: 'data-tool',
          id: generateId(),
          data: {
            type: 'kind',
            content: kind,
          },
        });

        dataStream.write({
          type: 'data-tool',
          id: generateId(),
          data: {
            type: 'id',
            content: id,
          },
        });

        dataStream.write({
          type: 'data-tool',
          id: generateId(),
          data: {
            type: 'title',
            content: title,
          },
        });

        dataStream.write({
          type: 'data-tool',
          id: generateId(),
          data: {
            type: 'clear',
            content: '',
          },
        });

        const documentHandler = documentHandlersByComposerKind.find(
          (documentHandlerByComposerKind) =>
            documentHandlerByComposerKind.kind === kind,
        );

        if (!documentHandler) {
          throw new Error(`No document handler found for kind: ${kind}`);
        }

        console.log(`Document handler found for kind: ${kind}, executing...`);

        await documentHandler.onCreateDocument({
          id,
          title,
          dataStream,
          session,
          maxOutputTokens: artifactMaxTokens,
          // Pass through chat context so the handler can respect explicit user instructions
          context,
        });

        console.log(`Document creation complete for kind: ${kind}`);

        dataStream.write({
          type: 'data-tool',
          id: generateId(),
          data: { type: 'finish', content: '' },
        });

        return {
          id,
          title,
          kind,
          content: `A document titled "${title}" has been created.`,
        };
      } catch (error) {
        console.error(
          `[createDocument] FAILED for kind=${kind}, title=${title}:`,
          error,
        );
        return {
          id: '',
          title,
          kind,
          content: `Failed to create document: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    },
  });
