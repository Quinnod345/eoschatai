import { generateUUID } from '@/lib/utils';
import { tool } from 'ai';
import type { DataStreamWriter } from 'ai';
import { z } from 'zod';
import type { Session } from 'next-auth';
import {
  composerKinds,
  documentHandlersByComposerKind,
} from '@/lib/composer/server';

interface CreateDocumentProps {
  session: Session;
  dataStream: DataStreamWriter;
}

export const createDocument = ({ session, dataStream }: CreateDocumentProps) =>
  tool({
    description:
      'Create a document for a writing or content creation activities. This tool will call other functions that will generate the contents of the document based on the title and kind.',
    parameters: z.object({
      title: z.string(),
      kind: z.enum(composerKinds),
    }),
    execute: async ({ title, kind }) => {
      const id = generateUUID();

      console.log(`Creating document with kind: ${kind}, title: ${title}`);

      dataStream.writeData({
        type: 'kind',
        content: kind,
      });

      dataStream.writeData({
        type: 'id',
        content: id,
      });

      dataStream.writeData({
        type: 'title',
        content: title,
      });

      dataStream.writeData({
        type: 'clear',
        content: '',
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
      });

      console.log(`Document creation complete for kind: ${kind}`);

      dataStream.writeData({ type: 'finish', content: '' });

      return {
        id,
        title,
        kind,
        content: `I've created a document titled "${title}" for you in the right panel. You can review and interact with it there.`,
      };
    },
  });
