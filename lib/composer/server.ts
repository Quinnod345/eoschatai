import { codeDocumentHandler } from '@/composer/code/server';
import { imageDocumentHandler } from '@/composer/image/server';
import { sheetDocumentHandler } from '@/composer/sheet/server';
import { textDocumentHandler } from '@/composer/text/server';
import { chartDocumentHandler } from '@/composer/chart/server';
import { vtoDocumentHandler } from '@/composer/vto/server';
import type { ComposerKind } from '@/components/composer';
import type { DataStreamWriter } from 'ai';
import type { Session } from 'next-auth';
import type { Document } from '@/lib/db/schema';
import { saveDocument } from '@/lib/db/queries';

export interface SaveDocumentProps {
  id: string;
  title: string;
  kind: ComposerKind;
  content: string;
  userId: string;
}

export interface CreateDocumentCallbackProps {
  id: string;
  title: string;
  dataStream: DataStreamWriter;
  session: Session;
}

export interface UpdateDocumentCallbackProps {
  document: Document;
  description: string;
  dataStream: DataStreamWriter;
  session: Session;
}

export interface DocumentHandler<T = ComposerKind> {
  kind: T;
  onCreateDocument: (args: CreateDocumentCallbackProps) => Promise<void>;
  onUpdateDocument: (args: UpdateDocumentCallbackProps) => Promise<void>;
}

export function createDocumentHandler<T extends ComposerKind>(config: {
  kind: T;
  onCreateDocument: (params: CreateDocumentCallbackProps) => Promise<string>;
  onUpdateDocument: (params: UpdateDocumentCallbackProps) => Promise<string>;
}): DocumentHandler<T> {
  return {
    kind: config.kind,
    onCreateDocument: async (args: CreateDocumentCallbackProps) => {
      const draftContent = await config.onCreateDocument({
        id: args.id,
        title: args.title,
        dataStream: args.dataStream,
        session: args.session,
      });

      if (args.session?.user?.id) {
        await saveDocument({
          id: args.id,
          title: args.title,
          content: draftContent,
          kind: config.kind,
          userId: args.session.user.id,
        });
      }

      return;
    },
    onUpdateDocument: async (args: UpdateDocumentCallbackProps) => {
      const draftContent = await config.onUpdateDocument({
        document: args.document,
        description: args.description,
        dataStream: args.dataStream,
        session: args.session,
      });

      if (args.session?.user?.id) {
        await saveDocument({
          id: args.document.id,
          title: args.document.title,
          content: draftContent,
          kind: config.kind,
          userId: args.session.user.id,
        });
      }

      return;
    },
  };
}

/*
 * Use this array to define the document handlers for each composer kind.
 */
export const documentHandlersByComposerKind: Array<DocumentHandler> = [
  textDocumentHandler,
  codeDocumentHandler,
  imageDocumentHandler,
  sheetDocumentHandler,
  chartDocumentHandler,
  vtoDocumentHandler,
];

export const composerKinds = [
  'text',
  'code',
  'image',
  'sheet',
  'chart',
  'vto',
] as const;
