import { codeDocumentHandler } from '@/composer/code/server';
import { imageDocumentHandler } from '@/composer/image/server';
import { sheetDocumentHandler } from '@/composer/sheet/server';
import { textDocumentHandler } from '@/composer/text/server';
import { chartDocumentHandler } from '@/composer/chart/server';
import { vtoDocumentHandler } from '@/composer/vto/server';
import type { ComposerKind } from '@/components/composer';
import type { UIMessageStreamWriter } from 'ai';
import type { Session } from 'next-auth';
import type { Document } from '@/lib/db/schema';
import { saveDocument } from '@/lib/db/queries';
import { accountabilityDocumentHandler } from '@/composer/accountability/server';
import { ComposerContentBuffer } from '@/lib/stream/buffer-service';

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
  dataStream: UIMessageStreamWriter;
  session: Session;
  maxOutputTokens?: number;
  context?: string;
}

export interface UpdateDocumentCallbackProps {
  document: Document;
  description: string;
  dataStream: UIMessageStreamWriter;
  session: Session;
  maxOutputTokens?: number;
}

export interface DocumentHandler<T = ComposerKind> {
  kind: T;
  onCreateDocument: (args: CreateDocumentCallbackProps) => Promise<void>;
  onUpdateDocument: (args: UpdateDocumentCallbackProps) => Promise<void>;
}

// Interval for incremental saves during streaming (in milliseconds)
const INCREMENTAL_SAVE_INTERVAL = 500;

export function createDocumentHandler<T extends ComposerKind>(config: {
  kind: T;
  onCreateDocument: (params: CreateDocumentCallbackProps) => Promise<string>;
  onUpdateDocument: (params: UpdateDocumentCallbackProps) => Promise<string>;
}): DocumentHandler<T> {
  return {
    kind: config.kind,
    onCreateDocument: async (args: CreateDocumentCallbackProps) => {
      console.log(
        `[Document Handler] Starting onCreateDocument for ${config.kind}, id: ${args.id}`,
      );

      // Initialize content buffer for incremental saves
      const contentBuffer = new ComposerContentBuffer(args.id);
      let lastSaveTime = Date.now();
      let accumulatedContent = '';

      // Create a wrapped dataStream that also buffers content
      const wrappedDataStream = {
        ...args.dataStream,
        write: (chunk: unknown) => {
          // Forward to original dataStream
          args.dataStream.write(chunk as any);

          // Extract content from text deltas for incremental saves
          const chunkData = chunk as any;
          if (chunkData?.data?.type === 'text-delta' && chunkData?.data?.content) {
            accumulatedContent += chunkData.data.content;

            // Periodically save to Redis
            const now = Date.now();
            if (now - lastSaveTime >= INCREMENTAL_SAVE_INTERVAL) {
              lastSaveTime = now;
              contentBuffer.savePartialContent(accumulatedContent).catch((err) => {
                console.error('[Document Handler] Failed to save partial content:', err);
              });
            }
          }
        },
      };

      const draftContent = await config.onCreateDocument({
        id: args.id,
        title: args.title,
        dataStream: wrappedDataStream as UIMessageStreamWriter,
        session: args.session,
        maxOutputTokens: args.maxOutputTokens,
        context: args.context,
      });

      console.log(
        `[Document Handler] Finished streaming content for ${args.id}, length: ${draftContent?.length || 0} chars`,
      );

      if (args.session?.user?.id) {
        console.log(
          `[Document Handler] Saving document ${args.id} with content length: ${draftContent?.length || 0}`,
        );

        await saveDocument({
          id: args.id,
          title: args.title,
          content: draftContent,
          kind: config.kind,
          userId: args.session.user.id,
        });

        // Clean up Redis buffer after successful save
        await contentBuffer.cleanup();

        console.log(
          `[Document Handler] Document ${args.id} saved successfully`,
        );
      }

      return;
    },
    onUpdateDocument: async (args: UpdateDocumentCallbackProps) => {
      // Initialize content buffer for incremental saves
      const contentBuffer = new ComposerContentBuffer(args.document.id);
      let lastSaveTime = Date.now();
      let accumulatedContent = '';

      // Create a wrapped dataStream that also buffers content
      const wrappedDataStream = {
        ...args.dataStream,
        write: (chunk: unknown) => {
          // Forward to original dataStream
          args.dataStream.write(chunk as any);

          // Extract content from text deltas for incremental saves
          const chunkData = chunk as any;
          if (chunkData?.data?.type === 'text-delta' && chunkData?.data?.content) {
            accumulatedContent += chunkData.data.content;

            // Periodically save to Redis
            const now = Date.now();
            if (now - lastSaveTime >= INCREMENTAL_SAVE_INTERVAL) {
              lastSaveTime = now;
              contentBuffer.savePartialContent(accumulatedContent).catch((err) => {
                console.error('[Document Handler] Failed to save partial content:', err);
              });
            }
          }
        },
      };

      const draftContent = await config.onUpdateDocument({
        document: args.document,
        description: args.description,
        dataStream: wrappedDataStream as UIMessageStreamWriter,
        session: args.session,
        maxOutputTokens: args.maxOutputTokens,
      });

      if (args.session?.user?.id) {
        await saveDocument({
          id: args.document.id,
          title: args.document.title,
          content: draftContent,
          kind: config.kind,
          userId: args.session.user.id,
        });

        // Clean up Redis buffer after successful save
        await contentBuffer.cleanup();
      }

      return;
    },
  };
}

/**
 * Recover partial composer content from Redis buffer
 * Call this when loading a document that may have been interrupted
 */
export async function recoverPartialContent(
  documentId: string,
): Promise<string | null> {
  const contentBuffer = new ComposerContentBuffer(documentId);
  return contentBuffer.getPartialContent();
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
  accountabilityDocumentHandler,
];

export const composerKinds = [
  'text',
  'code',
  'image',
  'sheet',
  'chart',
  'vto',
  'accountability',
] as const;
