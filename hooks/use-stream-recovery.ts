'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { UIMessage } from 'ai';

/**
 * Stream recovery state returned from the API
 */
export interface StreamRecoveryState {
  streamId: string;
  status: 'active' | 'completed' | 'interrupted' | 'errored';
  messageId?: string;
  composerDocumentId?: string;
  metadata?: {
    researchMode?: string;
    partialContent?: string;
    composerKind?: string;
    composerTitle?: string;
    error?: string;
  };
  bufferState?: {
    streamId: string;
    chatId: string;
    chunkCount: number;
    status: string;
    createdAt: number;
    lastActiveAt: number;
  };
  chunks: Array<{
    seq: number;
    timestamp: number;
    chunk: unknown;
  }>;
  totalChunks: number;
  isActive: boolean;
  isStale?: boolean;
}

/**
 * Hook return type
 */
export interface UseStreamRecoveryReturn {
  isRecovering: boolean;
  recoveryState: StreamRecoveryState | null;
  recoveredChunks: unknown[];
  hasActiveStream: boolean;
  error: string | null;
  checkForActiveStream: () => Promise<StreamRecoveryState | null>;
  clearRecoveryState: () => void;
}

/**
 * Hook for recovering stream state on page reload
 * Checks for active streams and retrieves buffered chunks
 * Polls for new chunks while stream is active
 */
export function useStreamRecovery(chatId: string): UseStreamRecoveryReturn {
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryState, setRecoveryState] = useState<StreamRecoveryState | null>(
    null,
  );
  const [recoveredChunks, setRecoveredChunks] = useState<unknown[]>([]);
  const [error, setError] = useState<string | null>(null);
  const checkedRef = useRef(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const lastSeqRef = useRef<number>(0);

  /**
   * Check for active stream and retrieve buffered chunks
   */
  const checkForActiveStream = useCallback(async (): Promise<StreamRecoveryState | null> => {
    if (!chatId) {
      return null;
    }

    try {
      setIsRecovering(true);
      setError(null);

      console.log(`[StreamRecovery] Checking for active stream: ${chatId}`);

      const response = await fetch(`/api/chat?chatId=${chatId}`);

      if (response.status === 204) {
        // No active stream
        console.log('[StreamRecovery] No active stream found');
        setRecoveryState(null);
        setRecoveredChunks([]);
        return null;
      }

      if (!response.ok) {
        throw new Error(`Failed to check stream: ${response.status}`);
      }

      const state: StreamRecoveryState = await response.json();
      console.log('[StreamRecovery] Retrieved state:', {
        streamId: state.streamId,
        status: state.status,
        chunkCount: state.chunks?.length || 0,
        isActive: state.isActive,
        isStale: state.isStale,
      });

      setRecoveryState(state);
      
      // Extract the inner chunk from BufferedChunk wrapper
      const extractedChunks = state.chunks?.map((c: { chunk: unknown }) => c.chunk) || [];
      console.log('[StreamRecovery] Extracted chunks:', {
        count: extractedChunks.length,
        firstChunkType: extractedChunks[0] ? (extractedChunks[0] as Record<string, unknown>)?.type : 'none',
      });
      setRecoveredChunks(extractedChunks);
      
      // Track the last sequence number for polling
      if (state.chunks && state.chunks.length > 0) {
        lastSeqRef.current = Math.max(...state.chunks.map(c => c.seq)) + 1;
      }

      return state;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('[StreamRecovery] Error checking stream:', errorMessage);
      setError(errorMessage);
      return null;
    } finally {
      setIsRecovering(false);
    }
  }, [chatId]);

  /**
   * Clear recovery state
   */
  const clearRecoveryState = useCallback(() => {
    setRecoveryState(null);
    setRecoveredChunks([]);
    setError(null);
  }, []);

  // Check for active stream on mount (only once)
  useEffect(() => {
    if (!checkedRef.current && chatId) {
      checkedRef.current = true;
      checkForActiveStream();
    }
  }, [chatId, checkForActiveStream]);

  // Reset checked ref when chatId changes
  useEffect(() => {
    checkedRef.current = false;
    lastSeqRef.current = 0;
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, [chatId]);

  // Poll for new chunks while stream is active
  useEffect(() => {
    if (!recoveryState?.isActive) {
      // Stop polling if stream is not active
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
        console.log('[StreamRecovery] Stopped polling - stream not active');
      }
      return;
    }

    // Start polling for new chunks
    const pollForChunks = async () => {
      try {
        const response = await fetch(
          `/api/chat?chatId=${chatId}&fromSeq=${lastSeqRef.current}`,
        );

        // 204 means no active stream - stop polling and fetch final message
        if (response.status === 204) {
          console.log('[StreamRecovery] Stream no longer active (204), fetching final message');
          // Update recovery state to mark as not active
          setRecoveryState((prev) => prev ? { ...prev, isActive: false, status: 'completed' } : null);
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
          
          // Fetch the complete messages from the database
          // The stream completed on the server and the message was saved
          try {
            const messagesResponse = await fetch(`/api/chats/messages?chatId=${chatId}`);
            if (messagesResponse.ok) {
              const { messages: finalMessages } = await messagesResponse.json();
              if (finalMessages && finalMessages.length > 0) {
                console.log('[StreamRecovery] Fetched final messages from database:', finalMessages.length);
                // Signal that we have final messages to apply
                // We'll use a special marker in recoveredChunks
                setRecoveredChunks((prev) => [
                  ...prev,
                  { __finalMessages: finalMessages },
                ]);
              }
            }
          } catch (fetchErr) {
            console.error('[StreamRecovery] Failed to fetch final messages:', fetchErr);
          }
          return;
        }

        if (!response.ok) {
          console.error('[StreamRecovery] Poll failed:', response.status);
          return;
        }

        const state: StreamRecoveryState = await response.json();

        // Check if stream has completed
        if (!state.isActive || state.status !== 'active') {
          console.log('[StreamRecovery] Stream completed, stopping poll');
          setRecoveryState(state);
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
          return;
        }

        // Process new chunks
        if (state.chunks && state.chunks.length > 0) {
          const newChunks = state.chunks
            .filter((c) => c.seq >= lastSeqRef.current)
            .map((c) => c.chunk);

          if (newChunks.length > 0) {
            console.log(`[StreamRecovery] Poll: ${newChunks.length} new chunks`);
            setRecoveredChunks((prev) => [...prev, ...newChunks]);
            lastSeqRef.current = Math.max(...state.chunks.map((c) => c.seq)) + 1;
          }
        }
      } catch (err) {
        console.error('[StreamRecovery] Poll error:', err);
        // On error, stop polling to avoid spamming
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      }
    };

    // Poll every 500ms while stream is active
    pollingRef.current = setInterval(pollForChunks, 500);
    console.log('[StreamRecovery] Started polling for new chunks');

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [recoveryState?.isActive, chatId]);

  return {
    isRecovering,
    recoveryState,
    recoveredChunks,
    hasActiveStream: recoveryState?.isActive || false,
    error,
    checkForActiveStream,
    clearRecoveryState,
  };
}

/**
 * Apply recovered chunks to update messages
 * This processes buffered chunks and updates the message state
 * Uses functional update to avoid stale state issues
 */
export function applyRecoveredChunks(
  chunks: unknown[],
  setMessages: (updater: (prev: UIMessage[]) => UIMessage[]) => void,
): void {
  if (!chunks || chunks.length === 0) {
    return;
  }

  console.log(`[StreamRecovery] Applying ${chunks.length} recovered chunks`);

  // Process chunks to extract content
  // Chunks have already been unwrapped from BufferedChunk { seq, timestamp, chunk }
  // by the useStreamRecovery hook (state.chunks.map(c => c.chunk))
  let accumulatedText = '';
  const processedParts: unknown[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunkData = chunks[i] as Record<string, unknown>;

    // Log first few chunks for debugging with full structure
    if (i < 5) {
      console.log(`[StreamRecovery] Chunk ${i}:`, JSON.stringify(chunkData, null, 2));
    }

    // Handle AI SDK 5 text-delta chunks (from toUIMessageStream)
    // AI SDK 5 uses 'delta' property for text-delta chunks
    if (chunkData?.type === 'text-delta') {
      // Try 'delta' first (AI SDK 5 format), then fallbacks
      const text = 
        (chunkData.delta as string) ||
        (chunkData.textDelta as string) || 
        (chunkData.text as string) || 
        (chunkData.content as string) ||
        (chunkData.value as string) ||
        '';
      if (text) {
        accumulatedText += text;
        if (i < 5) {
          console.log(`[StreamRecovery] Extracted text from chunk ${i}: "${text.substring(0, 50)}..."`);
        }
      } else {
        // Log unexpected structure with all keys
        console.warn(`[StreamRecovery] text-delta chunk ${i} has no recognized text property. Keys:`, Object.keys(chunkData), 'Values:', chunkData);
      }
    }

    // Handle our custom data chunks (type: 'data-custom', etc.)
    if (typeof chunkData?.type === 'string' && chunkData.type.startsWith('data-')) {
      // Check if it's a text-delta inside data
      const innerData = chunkData.data as Record<string, unknown> | undefined;
      if (innerData?.type === 'text-delta') {
        accumulatedText += (innerData.content as string) || '';
      }
      processedParts.push(chunkData);
    }
  }

  console.log(`[StreamRecovery] Extracted ${accumulatedText.length} chars of text`);

  // If we have accumulated text, update or create the assistant message
  if (accumulatedText) {
    // Use functional update to get current messages state
    setMessages((currentMessages) => {
      const lastAssistantIndex = currentMessages.findLastIndex(
        (m) => m.role === 'assistant',
      );

      if (lastAssistantIndex >= 0) {
        const updatedMessages = [...currentMessages];
        const existingMessage = updatedMessages[lastAssistantIndex];

        // Get existing text from parts
        const existingText =
          existingMessage.parts
            ?.filter((p: unknown) => (p as { type: string })?.type === 'text')
            .map((p: unknown) => (p as { text: string })?.text || '')
            .join('') || '';

        // Append new text to existing content (for incremental updates during polling)
        const newText = existingText + accumulatedText;
        
        updatedMessages[lastAssistantIndex] = {
          ...existingMessage,
          content: newText,
          parts: [
            { type: 'text' as const, text: newText },
            ...processedParts.map((p) => p as UIMessage['parts'][number]),
          ],
        };
        console.log(
          `[StreamRecovery] Updated message: ${existingText.length} + ${accumulatedText.length} = ${newText.length} chars`,
        );
        return updatedMessages;
      } else {
        // No assistant message found - create one with the recovered content
        console.log(`[StreamRecovery] Creating new assistant message with recovered content`);
        // Generate a proper UUID for the recovered message
        const recoveredId = crypto.randomUUID();
        const newAssistantMessage: UIMessage = {
          id: recoveredId,
          role: 'assistant',
          content: accumulatedText,
          parts: [
            { type: 'text' as const, text: accumulatedText },
            ...processedParts.map((p) => p as UIMessage['parts'][number]),
          ],
        };
        console.log(
          `[StreamRecovery] Created new assistant message with ${accumulatedText.length} chars`,
        );
        return [...currentMessages, newAssistantMessage];
      }
    });
  } else {
    console.log(`[StreamRecovery] No text content found in chunks`);
  }
}

/**
 * Process recovered composer state
 * Returns composer state if found in recovery data
 */
export function getRecoveredComposerState(
  recoveryState: StreamRecoveryState | null,
): {
  documentId: string;
  kind: string;
  title: string;
  content: string;
} | null {
  if (!recoveryState?.composerDocumentId) {
    return null;
  }

  return {
    documentId: recoveryState.composerDocumentId,
    kind: recoveryState.metadata?.composerKind || 'text',
    title: recoveryState.metadata?.composerTitle || 'Untitled',
    content: recoveryState.metadata?.partialContent || '',
  };
}
