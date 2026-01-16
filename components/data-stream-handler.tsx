'use client';

// TODO: SDK 5 Migration - The 'data' property was removed from useChat in AI SDK 5.
// Data streaming is now handled differently. This component is temporarily disabled
// until the data streaming approach is migrated to SDK 5's new patterns.
// See: https://sdk.vercel.ai/docs/ai-sdk-ui/chatbot-with-tool-calling for SDK 5 patterns

// These imports are needed when the component is re-enabled after SDK 5 migration
// import { useEffect, useRef, useCallback } from 'react';
// import { composerDefinitions, type ComposerKind } from './composer';
// import { initialComposerData, useComposer } from '@/hooks/use-composer';
// import type { ComposerKind } from './composer';
// import type { Suggestion } from '@/lib/db/schema';

// Type stubs for the disabled code below - remove when re-enabling
type ComposerKind = string;
type Suggestion = unknown;

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
  content: string | Suggestion | any;
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

export function DataStreamHandler({ id: _id }: { id: string }) {
  // TODO: SDK 5 removed 'data' property from useChat - data streaming is handled differently now
  // This component is temporarily disabled until SDK 5 data streaming is implemented
  // The data property no longer exists on UseChatHelpers in SDK 5
  // 
  // Original implementation used: const { data: dataStream } = useChat({ id });
  // In SDK 5, data streaming needs to be migrated to the new approach using
  // message annotations or custom stream parts.
  //
  // For now, return null to disable this component.
  // When re-enabling, restore the useChat hook and remove this early return.
  
  // Temporarily disabled - return early until SDK 5 data streaming is implemented
  return null;
  
  /* SDK 5 Migration TODO: Re-enable this when data streaming is implemented
  const dataStream: DataStreamDelta[] | null = null;
  const lastProcessedIndex = useRef(-1);
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
        // Log chart-related data for debugging
        if (
          delta.type === 'chart-data' ||
          (delta.type === 'text-delta' &&
            typeof delta.content === 'string' &&
            delta.content.includes('"type"') &&
            delta.content.includes('"data"'))
        ) {
          console.log(
            `[DataStreamHandler] Processing chart data with kind: ${kind}`,
          );
        }

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

  useEffect(() => {
    // SDK 5: dataStream is disabled until migration is complete
    if (!dataStream || !dataStream.length) return;

    const newDeltas = dataStream.slice(lastProcessedIndex.current + 1);
    lastProcessedIndex.current = dataStream.length - 1;

    if (newDeltas.length === 0) return;

    (newDeltas as DataStreamDelta[]).forEach((delta: DataStreamDelta) => {
      // Skip Nexus search events
      if (delta.type?.startsWith('nexus-')) {
        return;
      }

      // Handle metadata deltas immediately
      if (METADATA_DELTA_TYPES.has(delta.type)) {
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
        return;
      }

      // Handle content deltas - buffer if kind not yet known
      if (CONTENT_DELTA_TYPES.has(delta.type)) {
        const currentKind = confirmedKindRef.current || composer.kind;
        
        // If we have a confirmed kind, process immediately
        if (currentKind && currentKind !== 'text') {
          // Non-default kind is set, process with that kind
          processContentDelta(delta, currentKind);
        } else if (currentKind === 'text') {
          // Default kind - check if we should buffer or process
          // If no buffered deltas and this looks like it should be text, process it
          if (bufferedDeltasRef.current.length === 0) {
            processContentDelta(delta, 'text');
          } else {
            // We have buffered deltas, keep buffering
            bufferedDeltasRef.current.push(delta);
          }
        } else {
          // No kind set yet - buffer the delta
          console.log(
            `[DataStreamHandler] Buffering delta until kind is known:`,
            delta.type,
          );
          bufferedDeltasRef.current.push(delta);
        }
        return;
      }

      // Handle AI edit events
      if (delta.type === 'ai-edit-start' || delta.type === 'ai-edit-complete') {
        const currentKind = confirmedKindRef.current || composer.kind;
        if (currentKind) {
          processContentDelta(delta, currentKind);
        }
      }
    });
  }, [dataStream, setComposer, composer.kind, processContentDelta, flushBufferedDeltas]);

  // Reset on unmount or id change
  useEffect(() => {
    return () => {
      lastProcessedIndex.current = -1;
      bufferedDeltasRef.current = [];
      confirmedKindRef.current = null;
    };
  }, [id]);

  return null;
  End of SDK 5 Migration TODO */
}
