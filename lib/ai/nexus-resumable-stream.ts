import { Redis } from '@upstash/redis';
import { createDataStream, type DataStreamWriter } from 'ai';
import { generateUUID } from '@/lib/utils';
import type { SearchResult } from '@/lib/web-search';

// Initialize Redis client
let redisClient: Redis | null = null;

function getRedisClient(): Redis | null {
  if (!redisClient) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
      console.warn('Redis not configured for resumable streams');
      return null;
    }

    redisClient = new Redis({ url, token });
  }

  return redisClient;
}

// Stream state structure
export interface NexusStreamState {
  streamId: string;
  sessionId: string;
  chatId: string;
  query: string;
  phase:
    | 'planning'
    | 'research'
    | 'analyzing'
    | 'generating'
    | 'complete'
    | 'error';
  startTime: number;
  lastUpdate: number;
  progress: {
    totalSearches: number;
    completedSearches: number;
    sourcesFound: number;
    currentSearchIndex?: number;
    currentSearchQuery?: string;
  };
  results: any[];
  error?: string;
  researchPlan?: any;
  checkpointData?: any; // For resuming mid-search
}

// Redis keys for stream state
const streamKeys = {
  state: (streamId: string) => `nexus:stream:${streamId}:state`,
  checkpoint: (streamId: string) => `nexus:stream:${streamId}:checkpoint`,
  results: (streamId: string) => `nexus:stream:${streamId}:results`,
  lock: (streamId: string) => `nexus:stream:${streamId}:lock`,
};

// Save stream state to Redis
export async function saveStreamState(state: NexusStreamState): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  state.lastUpdate = Date.now();

  try {
    await redis.setex(
      streamKeys.state(state.streamId),
      7200, // 2 hours TTL
      JSON.stringify(state),
    );
  } catch (error) {
    console.error('[Nexus] Failed to save stream state:', error);
  }
}

// Load stream state from Redis
export async function loadStreamState(
  streamId: string,
): Promise<NexusStreamState | null> {
  const redis = getRedisClient();
  if (!redis) return null;

  try {
    const stateData = await redis.get(streamKeys.state(streamId));
    if (!stateData) return null;

    return JSON.parse(stateData as string);
  } catch (error) {
    console.error('[Nexus] Failed to load stream state:', error);
    return null;
  }
}

// Acquire stream lock to prevent duplicate processing
export async function acquireStreamLock(
  streamId: string,
  ttl = 30,
): Promise<boolean> {
  const redis = getRedisClient();
  if (!redis) return true; // No Redis, proceed without lock

  try {
    const lockKey = streamKeys.lock(streamId);
    const lockId = generateUUID();

    // Try to set lock with NX (only if not exists)
    const result = await redis.set(lockKey, lockId, {
      nx: true,
      ex: ttl,
    });

    return result === 'OK';
  } catch (error) {
    console.error('[Nexus] Failed to acquire stream lock:', error);
    return false;
  }
}

// Release stream lock
export async function releaseStreamLock(streamId: string): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    await redis.del(streamKeys.lock(streamId));
  } catch (error) {
    console.error('[Nexus] Failed to release stream lock:', error);
  }
}

// Save checkpoint for resuming mid-search
export async function saveStreamCheckpoint(
  streamId: string,
  checkpoint: any,
): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    await redis.setex(
      streamKeys.checkpoint(streamId),
      3600, // 1 hour TTL
      JSON.stringify(checkpoint),
    );
  } catch (error) {
    console.error('[Nexus] Failed to save stream checkpoint:', error);
  }
}

// Load checkpoint
export async function loadStreamCheckpoint(
  streamId: string,
): Promise<any | null> {
  const redis = getRedisClient();
  if (!redis) return null;

  try {
    const data = await redis.get(streamKeys.checkpoint(streamId));
    return data ? JSON.parse(data as string) : null;
  } catch (error) {
    console.error('[Nexus] Failed to load stream checkpoint:', error);
    return null;
  }
}

// Create a resumable Nexus stream
export function createResumableNexusStream(
  streamId: string,
  initialState: Omit<NexusStreamState, 'streamId' | 'lastUpdate'>,
) {
  return createDataStream({
    execute: async (dataStream) => {
      // Try to acquire lock
      const hasLock = await acquireStreamLock(streamId);
      if (!hasLock) {
        console.log('[Nexus] Stream already being processed:', streamId);
        dataStream.writeData({
          type: 'nexus-resume-conflict',
          message: 'This search is already being processed in another session',
        });
        return;
      }

      try {
        // Check for existing state
        let state = await loadStreamState(streamId);

        if (state) {
          console.log('[Nexus] Resuming stream from saved state:', {
            streamId,
            phase: state.phase,
            progress: state.progress,
          });

          // Send resume notification
          dataStream.writeData({
            type: 'nexus-stream-resumed',
            phase: state.phase,
            progress: state.progress,
            elapsedTime: Date.now() - state.startTime,
          });

          // If stream was complete or errored, just return the final state
          if (state.phase === 'complete' || state.phase === 'error') {
            if (state.phase === 'complete' && state.results.length > 0) {
              dataStream.writeData({
                type: 'nexus-search-complete',
                results: state.results,
                totalResults: state.results.length,
                sourcesFound: state.progress.sourcesFound,
              });
            } else if (state.error) {
              dataStream.writeData({
                type: 'nexus-error',
                error: state.error,
              });
            }
            return;
          }
        } else {
          // Initialize new state
          state = {
            streamId,
            ...initialState,
            lastUpdate: Date.now(),
          };
          await saveStreamState(state);
        }

        // Resume or start the search process
        await executeNexusSearch(state, dataStream);
      } finally {
        // Always release lock
        await releaseStreamLock(streamId);
      }
    },
    onError: (error) => {
      console.error('[Nexus] Stream error:', error);

      // Try to save error state
      saveStreamState({
        streamId,
        ...initialState,
        phase: 'error',
        lastUpdate: Date.now(),
        error: error instanceof Error ? error.message : 'Unknown error',
      }).catch(console.error);

      return error instanceof Error ? error.message : 'Stream error occurred';
    },
  });
}

// Execute the actual Nexus search with resume capability
export async function executeNexusSearch(
  state: NexusStreamState,
  dataStream: DataStreamWriter,
): Promise<void> {
  // Import required functions
  const { searchWeb } = await import('@/lib/web-search');
  const { storeResearchResult, updateResearchProgress } = await import(
    '@/lib/ai/nexus-research-storage'
  );

  try {
    // Get research plan from state
    const plan = state.researchPlan;
    if (!plan || !plan.searchQueries) {
      throw new Error('No research plan found in state');
    }

    // Update phase if needed
    if (state.phase === 'planning' || state.phase === 'research') {
      dataStream.writeData({
        type: 'nexus-phase-update',
        phase: 'research',
        message: 'Continuing research...',
        streamId: state.streamId,
      });

      state.phase = 'research';
      await saveStreamState(state);
    }

    // Continue from last checkpoint if available
    const checkpoint = await loadStreamCheckpoint(state.streamId);
    const startBatch = checkpoint?.lastBatchStart || 0;
    let completedSearches =
      checkpoint?.completedSearches || state.progress.completedSearches;
    let sourcesFound = checkpoint?.sourcesFound || state.progress.sourcesFound;
    const allResults: SearchResult[] =
      checkpoint?.results || state.results || [];

    const BATCH_SIZE = 2;
    const BATCH_DELAY = 8000;

    // Resume from the last batch
    for (
      let batchStart = startBatch;
      batchStart < plan.searchQueries.length;
      batchStart += BATCH_SIZE
    ) {
      // Check if we should abort
      const currentState = await loadStreamState(state.streamId);
      if (
        currentState?.phase === 'error' ||
        currentState?.phase === 'complete'
      ) {
        console.log('[Nexus] Search already completed or errored');
        return;
      }

      // Save checkpoint before processing batch
      await saveStreamCheckpoint(state.streamId, {
        lastBatchStart: batchStart,
        completedSearches,
        sourcesFound,
        results: allResults,
        timestamp: Date.now(),
      });

      const batch = plan.searchQueries.slice(
        batchStart,
        batchStart + BATCH_SIZE,
      );

      // Process batch in parallel
      const batchPromises = batch.map(
        async (searchQuery: string, batchIndex: number) => {
          const searchIndex = batchStart + batchIndex;

          // Skip if already completed
          if (searchIndex < completedSearches) {
            return [];
          }

          // Emit progress event
          dataStream.writeData({
            type: 'nexus-search-progress',
            currentSearch: searchQuery,
            searchIndex: searchIndex,
            searchesCompleted: completedSearches,
            totalSearches: plan.searchQueries.length,
            phase: 'research',
            startTime: state.startTime,
            sourcesFound,
            streamId: state.streamId,
          });

          try {
            const results = await searchWeb(
              searchQuery,
              (progress) => {
                // Emit detailed search progress
                dataStream.writeData({
                  type: 'nexus-search-detail',
                  searchIndex: searchIndex,
                  query: searchQuery,
                  status: progress.status,
                  sitesFound: progress.sitesFound ?? 0,
                  error: progress.error ?? null,
                  retryAfter: progress.retryAfter ?? null,
                  phase: 'research',
                  startTime: state.startTime,
                  sourcesFound,
                  streamId: state.streamId,
                });
              },
              searchIndex,
            );

            if (results.length > 0) {
              sourcesFound += results.length;

              // Store results in database
              for (const result of results) {
                await storeResearchResult(state.sessionId, searchQuery, {
                  url: result.url,
                  title: result.title,
                  snippet: result.snippet,
                  content: result.content,
                });
              }

              // Emit sites found event
              dataStream.writeData({
                type: 'nexus-sites-found',
                searchIndex: searchIndex,
                sites: results.map((r) => ({
                  url: r.url,
                  title: r.title,
                })),
                streamId: state.streamId,
              });

              return results;
            }
            return [];
          } catch (error) {
            console.error(`[Nexus] Search failed for "${searchQuery}":`, error);
            dataStream.writeData({
              type: 'nexus-search-error',
              searchIndex: searchIndex,
              query: searchQuery,
              error: error instanceof Error ? error.message : 'Unknown error',
              streamId: state.streamId,
            });
            return [];
          }
        },
      );

      // Wait for batch to complete
      const batchResults = await Promise.all(batchPromises);
      batchResults.forEach((results) => {
        allResults.push(...results);
        completedSearches++;
      });

      // Update progress
      await updateResearchProgress(state.sessionId, {
        completedSearches,
        sourcesFound,
        phase: 'searching',
      });

      // Update stream state
      state.progress.completedSearches = completedSearches;
      state.progress.sourcesFound = sourcesFound;
      state.results = allResults;
      await saveStreamState(state);

      // Delay before next batch (if not last batch)
      if (batchStart + BATCH_SIZE < plan.searchQueries.length) {
        dataStream.writeData({
          type: 'nexus-batch-delay',
          message: 'Waiting before next batch to respect rate limits...',
          delaySeconds: BATCH_DELAY / 1000,
          streamId: state.streamId,
        });
        await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY));
      }
    }

    // Update to analyzing phase
    await updateResearchProgress(state.sessionId, {
      phase: 'analyzing',
      completedSearches: plan.searchQueries.length,
      sourcesFound,
    });

    state.phase = 'analyzing';
    await saveStreamState(state);

    dataStream.writeData({
      type: 'nexus-phase-update',
      phase: 'analyzing',
      message: 'Analyzing research results...',
      streamId: state.streamId,
    });

    // Deduplicate results
    const uniqueResults: SearchResult[] = Array.from(
      new Map(
        allResults.map((item: SearchResult) => [item.url, item]),
      ).values(),
    );

    // Update state with final results
    state.results = uniqueResults;
    state.phase = 'generating';
    await saveStreamState(state);

    // Send completion
    dataStream.writeData({
      type: 'nexus-search-complete',
      totalResults: uniqueResults.length,
      results: uniqueResults.slice(0, 15).map((result: SearchResult) => ({
        title: result.title,
        url: result.url,
        snippet: result.snippet,
      })),
      searchesCompleted: completedSearches,
      sourcesFound,
      researchTime: Date.now() - state.startTime,
      streamId: state.streamId,
    });

    // Mark session as completed
    await updateResearchProgress(state.sessionId, {
      phase: 'generating',
      completedSearches: plan.searchQueries.length,
      sourcesFound,
    });

    // Mark stream as complete
    state.phase = 'complete';
    await saveStreamState(state);
  } catch (error) {
    console.error('[Nexus] Search execution error:', error);
    state.phase = 'error';
    state.error = error instanceof Error ? error.message : 'Unknown error';
    await saveStreamState(state);

    dataStream.writeData({
      type: 'nexus-error',
      error: state.error,
      streamId: state.streamId,
    });
  }
}

// Clean up old stream states
export async function cleanupOldStreams(maxAge = 7200000): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    // This would need to be implemented with Redis SCAN
    // to find and delete old stream states
    console.log('[Nexus] Cleanup not implemented yet');
  } catch (error) {
    console.error('[Nexus] Cleanup error:', error);
  }
}

// Get active streams for a user
export async function getUserActiveStreams(userId: string): Promise<string[]> {
  const redis = getRedisClient();
  if (!redis) return [];

  try {
    // This would need a separate index of user -> stream mappings
    return [];
  } catch (error) {
    console.error('[Nexus] Failed to get user streams:', error);
    return [];
  }
}
