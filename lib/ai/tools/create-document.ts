import { generateUUID } from '@/lib/utils';
import { tool } from 'ai';
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
      'Create a document for a writing or content creation activities. This tool will call other functions that will generate the contents of the document based on the title and kind.',
    inputSchema: z.object({
      title: z.string(),
      kind: z.enum(composerKinds),
    }),
    execute: async ({ title, kind }) => {
      const id = generateUUID();

      console.log(`Creating document with kind: ${kind}, title: ${title}`);

      dataStream.write({
        'type': 'data',

        'value': [{
          type: 'kind',
          content: kind,
        }]
      });

      dataStream.write({
        'type': 'data',

        'value': [{
          type: 'id',
          content: id,
        }]
      });

      dataStream.write({
        'type': 'data',

        'value': [{
          type: 'title',
          content: title,
        }]
      });

      dataStream.write({
        'type': 'data',

        'value': [{
          type: 'clear',
          content: '',
        }]
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
        'type': 'data',
        'value': [{ type: 'finish', content: '' }]
      });

      return {
        id,
        title,
        kind,
        content: `I've created a document titled "${title}" for you in the right panel. You can review and interact with it there.`,
      };
    },
  });
