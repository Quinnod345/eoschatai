'use client';

import { useChat } from '@ai-sdk/react';
import { useEffect, useRef } from 'react';
import { composerDefinitions, type ComposerKind } from './composer';
import type { Suggestion } from '@/lib/db/schema';
import { initialComposerData, useComposer } from '@/hooks/use-composer';

export type DataStreamDelta = {
  type:
    | 'text-delta'
    | 'code-delta'
    | 'sheet-delta'
    | 'image-delta'
    | 'title'
    | 'id'
    | 'suggestion'
    | 'clear'
    | 'finish'
    | 'kind'
    | 'chart-data'
    | 'ai-edit-start'
    | 'ai-edit-complete'
    | 'nexus-search-start'
    | 'nexus-search-progress'
    | 'nexus-search-detail'
    | 'nexus-sites-found'
    | 'nexus-search-error'
    | 'nexus-search-complete'
    | 'nexus-batch-delay'
    | 'nexus-phase-update'
    | 'nexus-complete-response';
  content: string | Suggestion | any;
};

export function DataStreamHandler({ id }: { id: string }) {
  const { data: dataStream } = useChat({ id });
  const { composer, setComposer, setMetadata } = useComposer();
  const lastProcessedIndex = useRef(-1);

  useEffect(() => {
    if (!dataStream?.length) return;

    const newDeltas = dataStream.slice(lastProcessedIndex.current + 1);
    lastProcessedIndex.current = dataStream.length - 1;

    (newDeltas as DataStreamDelta[]).forEach((delta: DataStreamDelta) => {
      // Handle Nexus search events
      if (delta.type?.startsWith('nexus-')) {
        // These events are handled by the Messages component
        // We just log them here for debugging
        console.log(
          '[DataStreamHandler] Nexus event:',
          delta.type,
          delta.content,
        );
        return;
      }

      const composerDefinition = composerDefinitions.find(
        (composerDefinition) => composerDefinition.kind === composer.kind,
      );

      if (composerDefinition?.onStreamPart) {
        // Log chart-related data for debugging
        if (
          delta.type === 'chart-data' ||
          (delta.type === 'text-delta' &&
            typeof delta.content === 'string' &&
            delta.content.includes('"type"') &&
            delta.content.includes('"data"'))
        ) {
          console.log(
            `DataStreamHandler: Processing potential chart data: ${delta.type}`,
          );
        }

        composerDefinition.onStreamPart({
          streamPart: delta,
          setComposer,
          setMetadata,
        });
      }

      setComposer((draftComposer) => {
        if (!draftComposer) {
          return { ...initialComposerData, status: 'streaming' };
        }

        switch (delta.type) {
          case 'id':
            return {
              ...draftComposer,
              documentId: delta.content as string,
              status: 'streaming',
            };

          case 'title':
            return {
              ...draftComposer,
              title: delta.content as string,
              status: 'streaming',
            };

          case 'kind':
            return {
              ...draftComposer,
              kind: delta.content as ComposerKind,
              status: 'streaming',
            };

          case 'clear':
            return {
              ...draftComposer,
              content: '',
              status: 'streaming',
            };

          case 'finish':
            return {
              ...draftComposer,
              status: 'idle',
            };

          default:
            return draftComposer;
        }
      });
    });
  }, [dataStream, setComposer, setMetadata, composer]);

  return null;
}
