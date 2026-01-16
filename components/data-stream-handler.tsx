'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useChat } from '@ai-sdk/react';
import { composerDefinitions, type ComposerKind } from './composer';
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
    // Nexus standardized events
    | 'nexus-phase'
    | 'nexus-search-start'
    | 'nexus-search-progress'
    | 'nexus-search-detail'
    | 'nexus-query'
    | 'nexus-source'
    | 'nexus-sites-found'
    | 'nexus-search-error'
    | 'nexus-search-complete'
    | 'nexus-batch-delay'
    | 'nexus-phase-update'
    | 'nexus-complete-response';
  content: string | any;
};

/**
 * Delta types that should be buffered until kind is known
 */
const CONTENT_DELTA_TYPES = new Set([
  'text-delta',
  'code-delta',
  'sheet-delta',
  'image-delta',
  'chart-data',
  'suggestion',
]);

/**
 * Delta types that update composer metadata (always process immediately)
 */
const METADATA_DELTA_TYPES = new Set(['id', 'title', 'kind', 'clear', 'finish']);

export function DataStreamHandler({ id }: { id: string }) {
  const { messages, status } = useChat({ id });
  const { composer, setComposer, setMetadata } = useComposer();
  
  // Track processed parts to avoid reprocessing
  const processedPartsRef = useRef<Set<string>>(new Set());
  // Buffer for content deltas received before kind is set
  const bufferedDeltasRef = useRef<DataStreamDelta[]>([]);
  // Track the confirmed kind for this stream session
  const confirmedKindRef = useRef<ComposerKind | null>(null);

  // Process a delta with the kind-specific handler
  const processContentDelta = useCallback(
    (delta: DataStreamDelta, kind: ComposerKind) => {
      const composerDefinition = composerDefinitions.find(
        (def) => def.kind === kind,
      );

      if (composerDefinition?.onStreamPart) {
        composerDefinition.onStreamPart({
          streamPart: delta,
          setComposer,
          setMetadata,
        });
      }
    },
    [setComposer, setMetadata],
  );

  // Flush buffered deltas when kind becomes available
  const flushBufferedDeltas = useCallback(
    (kind: ComposerKind) => {
      const buffered = bufferedDeltasRef.current;
      if (buffered.length > 0) {
        console.log(
          `[DataStreamHandler] Flushing ${buffered.length} buffered deltas for kind: ${kind}`,
        );
        buffered.forEach((delta) => processContentDelta(delta, kind));
        bufferedDeltasRef.current = [];
      }
    },
    [processContentDelta],
  );

  // Process data parts from messages
  useEffect(() => {
    // Get the last assistant message
    const lastAssistantMessage = messages
      .slice()
      .reverse()
      .find((m) => m.role === 'assistant');
    
    if (!lastAssistantMessage?.parts) return;

    // Process data-tool parts from the message
    for (const part of lastAssistantMessage.parts) {
      // AI SDK 5: data parts have type like 'data-tool', 'data-custom', etc.
      if ((part as any).type?.startsWith('data-')) {
        const partId = `${lastAssistantMessage.id}-${(part as any).id || JSON.stringify(part)}`;
        
        // Skip if already processed
        if (processedPartsRef.current.has(partId)) continue;
        processedPartsRef.current.add(partId);

        // Extract the delta from the data part
        const dataPart = part as any;
        const data = dataPart.data;
        
        if (!data?.type) continue;

        const delta: DataStreamDelta = {
          type: data.type,
          content: data.content,
        };

        // Skip Nexus search events (handled elsewhere)
        if (delta.type?.startsWith('nexus-')) {
          continue;
        }

        // Handle metadata deltas immediately
        if (METADATA_DELTA_TYPES.has(delta.type)) {
          setComposer((draftComposer) => {
            if (!draftComposer) {
              return { ...initialComposerData, status: 'streaming' };
            }

            switch (delta.type) {
              case 'id':
                console.log('[DataStreamHandler] Setting document ID:', delta.content);
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

              case 'kind': {
                const newKind = delta.content as ComposerKind;
                // Store confirmed kind and flush buffered deltas
                confirmedKindRef.current = newKind;
                // Schedule flush after state update
                setTimeout(() => flushBufferedDeltas(newKind), 0);
                return {
                  ...draftComposer,
                  kind: newKind,
                  status: 'streaming',
                  isVisible: true,
                };
              }

              case 'clear':
                return {
                  ...draftComposer,
                  content: '',
                  status: 'streaming',
                };

              case 'finish':
                // Reset confirmed kind on finish
                confirmedKindRef.current = null;
                bufferedDeltasRef.current = [];
                return {
                  ...draftComposer,
                  status: 'idle',
                };

              default:
                return draftComposer;
            }
          });
          continue;
        }

        // Handle content deltas - buffer if kind not yet known
        if (CONTENT_DELTA_TYPES.has(delta.type)) {
          const currentKind = confirmedKindRef.current || composer.kind;
          
          if (currentKind && currentKind !== 'text') {
            processContentDelta(delta, currentKind);
          } else if (currentKind === 'text') {
            if (bufferedDeltasRef.current.length === 0) {
              processContentDelta(delta, 'text');
            } else {
              bufferedDeltasRef.current.push(delta);
            }
          } else {
            bufferedDeltasRef.current.push(delta);
          }
          continue;
        }

        // Handle AI edit events
        if (delta.type === 'ai-edit-start' || delta.type === 'ai-edit-complete') {
          const currentKind = confirmedKindRef.current || composer.kind;
          if (currentKind) {
            processContentDelta(delta, currentKind);
          }
        }
      }
    }
  }, [messages, setComposer, composer.kind, processContentDelta, flushBufferedDeltas]);

  // Reset on id change
  useEffect(() => {
    return () => {
      processedPartsRef.current.clear();
      bufferedDeltasRef.current = [];
      confirmedKindRef.current = null;
    };
  }, [id]);

  // Update composer status based on chat status
  useEffect(() => {
    if (status === 'streaming' && composer.documentId && composer.documentId !== 'init') {
      setComposer((current) => ({
        ...current,
        status: 'streaming',
      }));
    } else if (status === 'ready' && composer.status === 'streaming') {
      setComposer((current) => ({
        ...current,
        status: 'idle',
      }));
    }
  }, [status, composer.documentId, composer.status, setComposer]);

  return null;
}
