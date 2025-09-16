/**
 * Firesearch API Route
 * Replaces the old Nexus chat route with Firesearch integration
 */

import type { NextRequest } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import {
  getFiresearchService,
  FiresearchRedisStorage,
  type ResearchSession,
  type ResearchCheckpoint,
} from '@/lib/firesearch';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    const body = await request.json();
    const {
      query,
      chatId,
      streamId,
      depth = 'standard',
      resumeSessionId,
      followUpContext,
      // New optional params
      filters,
      synonymsEnabled,
      synonyms,
      ranking,
    } = body;

    if (!query && !resumeSessionId) {
      return new Response('Query or resumeSessionId is required', {
        status: 400,
      });
    }

    // Initialize services
    const firesearch = getFiresearchService();
    const storage = new FiresearchRedisStorage();

    // Check rate limiting
    const rateLimit = await storage.checkRateLimit(session.user.id);
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({
          error: 'Rate limit exceeded',
          remaining: rateLimit.remaining,
          resetAt: rateLimit.resetAt,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Remaining': rateLimit.remaining.toString(),
            'X-RateLimit-Reset': new Date(rateLimit.resetAt).toISOString(),
          },
        },
      );
    }

    // Handle session resume
    if (resumeSessionId) {
      const existingSession = await storage.loadSession(resumeSessionId);
      if (!existingSession) {
        return new Response('Session not found', { status: 404 });
      }

      // Check if session belongs to user
      if (existingSession.userId !== session.user.id) {
        return new Response('Unauthorized', { status: 403 });
      }

      // Resume from last checkpoint
      const lastCheckpoint =
        existingSession.checkpoints[existingSession.checkpoints.length - 1];
      if (!lastCheckpoint) {
        return new Response('No checkpoint found', { status: 400 });
      }

      // Minimal resume: restart research using the original query and context
      const firesearch = getFiresearchService();
      const researchStream = firesearch.research({
        query: existingSession.result?.query || query,
        context: followUpContext,
        sessionId: resumeSessionId,
        depth: depth as any,
        filters,
        synonymsEnabled,
        synonyms,
        ranking,
      });

      // Stream events as usual
      const sseStream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          const writeSSE = (event: any) => {
            const sseData = `data: ${JSON.stringify(event)}\n\n`;
            controller.enqueue(encoder.encode(sseData));
          };

          try {
            // Emit standardized resume event
            writeSSE({
              type: 'nexus-session-resume',
              sessionId: resumeSessionId,
            });
            // Forward Firesearch events as standardized nexus-* events
            for await (const event of researchStream) {
              switch (event.type) {
                case 'phase':
                  writeSSE({
                    type: 'nexus-phase',
                    phase: event.data.phase,
                    message: event.data.message,
                    progress: event.data.progress,
                  });
                  break;
                case 'query':
                  writeSSE({
                    type: 'nexus-query',
                    queries: event.data.queries,
                    strategy: event.data.strategy,
                  });
                  break;
                case 'progress':
                  writeSSE({
                    type: 'nexus-search-progress',
                    currentQuery: event.data.currentQuery,
                    queriesCompleted: event.data.queriesCompleted,
                    totalQueries: event.data.totalQueries,
                  });
                  break;
                case 'source':
                  writeSSE({
                    type: 'nexus-source',
                    data: {
                      source: {
                        title: event.data.title,
                        url: event.data.url,
                        snippet: event.data.snippet || '',
                        content: event.data.content || '',
                        citationIndex: event.data.citationIndex,
                        relevanceScore: event.data.relevanceScore || 0,
                      },
                    },
                  });
                  break;
                case 'followup':
                  writeSSE({
                    type: 'nexus-followup-questions',
                    questions: event.data.questions,
                  });
                  break;
                case 'result':
                  writeSSE({
                    type: 'nexus-search-complete',
                    results: event.data.sources,
                    citations: event.data.sources.map((s: any, i: number) => ({
                      number: i + 1,
                      title: s.title,
                      url: s.url,
                      snippet: s.snippet,
                    })),
                    researchContext: formatResearchContext(event.data),
                    followUpQuestions: event.data.followUpQuestions,
                    metadata: event.data.metadata,
                    sessionId: resumeSessionId,
                  });
                  break;
                case 'error':
                  writeSSE({
                    type: 'nexus-error',
                    error: event.data.message,
                    code: event.data.code,
                  });
                  break;
              }
            }
          } catch (e) {
            writeSSE({
              type: 'nexus-error',
              error: e instanceof Error ? e.message : 'Resume failed',
            });
          } finally {
            writeSSE({ type: 'stream-end' });
            controller.close();
          }
        },
      });

      return new Response(sseStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
          'X-Session-Id': resumeSessionId,
        },
      });
    }

    // Create new research session
    const sessionId = `fs_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const researchSession: ResearchSession = {
      id: sessionId,
      userId: session.user.id,
      chatId: chatId || 'direct',
      status: 'active',
      startTime: Date.now(),
      lastUpdate: Date.now(),
      checkpoints: [],
      // Store original query for resume
      result: undefined,
    };

    // Save initial session
    await storage.saveSession(researchSession);

    // Execute research with streaming
    const researchStream = firesearch.research({
      query,
      context: followUpContext,
      sessionId,
      depth: depth as any,
      filters,
      synonymsEnabled,
      synonyms,
      ranking,
    });

    // Create SSE stream with progress tracking
    const sseStream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        const writeSSE = (event: any) => {
          const sseData = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(sseData));
        };

        try {
          // Acquire lock for this session
          const lockAcquired = await storage.acquireLock(sessionId);
          if (!lockAcquired) {
            writeSSE({
              type: 'nexus-error',
              error: 'Another research is already in progress',
            });
            controller.close();
            return;
          }

          // Initial event
          writeSSE({
            type: 'nexus-search-start',
            sessionId,
            streamId: streamId || sessionId,
          });

          let lastPhase: string | null = null;
          const checkpointData: any = {
            queries: [],
            sources: [],
            progress: 0,
          };

          // Process Firesearch events
          for await (const event of researchStream) {
            // Convert to standardized nexus-* events expected by the UI
            let nexusEvent: any = null;

            switch (event.type) {
              case 'phase':
                lastPhase = event.data.phase;

                // Save checkpoint on phase change
                if (
                  lastPhase &&
                  ['searching', 'analyzing', 'synthesizing'].includes(lastPhase)
                ) {
                  const checkpoint: ResearchCheckpoint = {
                    phase: lastPhase as any,
                    timestamp: Date.now(),
                    data: { ...checkpointData },
                  };
                  await storage.addCheckpoint(sessionId, checkpoint);
                }

                // Update progress
                await storage.updateProgress(sessionId, {
                  phase: event.data.phase,
                  completedSearches: checkpointData.queries.length,
                  totalSearches: 0, // Will be updated when we get the plan
                  sourcesFound: checkpointData.sources.length,
                });

                nexusEvent = {
                  type: 'nexus-phase',
                  phase: event.data.phase,
                  message: event.data.message,
                  progress: event.data.progress,
                };
                break;

              case 'query':
                checkpointData.queries = event.data.queries;
                nexusEvent = {
                  type: 'nexus-query',
                  queries: event.data.queries,
                  strategy: event.data.strategy,
                  totalSearches: event.data.queries.length,
                };
                break;

              case 'source':
                checkpointData.sources.push(event.data);
                nexusEvent = {
                  type: 'nexus-source',
                  data: {
                    source: {
                      title: event.data.title,
                      url: event.data.url,
                      snippet: event.data.snippet || '',
                      content: event.data.content || '',
                      citationIndex: event.data.citationIndex,
                      relevanceScore: event.data.relevanceScore || 0,
                    },
                  },
                };
                break;

              case 'progress':
                checkpointData.progress =
                  (event.data.queriesCompleted / event.data.totalQueries) * 100;
                nexusEvent = {
                  type: 'nexus-search-progress',
                  currentQuery: event.data.currentQuery,
                  queriesCompleted: event.data.queriesCompleted,
                  totalQueries: event.data.totalQueries,
                };
                break;

              case 'followup':
                nexusEvent = {
                  type: 'nexus-followup-questions',
                  questions: event.data.questions,
                };
                break;

              case 'result':
                // Save final result
                await storage.saveResult(sessionId, event.data);

                nexusEvent = {
                  type: 'nexus-search-complete',
                  results: event.data.sources,
                  citations: event.data.sources.map((s: any, i: number) => ({
                    number: i + 1,
                    title: s.title,
                    url: s.url,
                    snippet: s.snippet,
                  })),
                  researchContext: formatResearchContext(event.data),
                  followUpQuestions: event.data.followUpQuestions,
                  metadata: event.data.metadata,
                  sessionId,
                };
                break;

              case 'error':
                await storage.updateSessionStatus(sessionId, 'error');
                nexusEvent = {
                  type: 'nexus-error',
                  error: event.data.message,
                  code: event.data.code,
                };
                break;
            }

            if (nexusEvent) {
              writeSSE(nexusEvent);
            }
          }

          // Update session status
          await storage.updateSessionStatus(sessionId, 'completed');
        } catch (error) {
          console.error('[Firesearch API] Error:', error);

          await storage.updateSessionStatus(sessionId, 'error');

          writeSSE({
            type: 'nexus-error',
            error: error instanceof Error ? error.message : 'Unknown error',
            code: 'FIRESEARCH_ERROR',
          });
        } finally {
          // Release lock
          await storage.releaseLock(sessionId);

          // Close stream
          writeSSE({ type: 'stream-end' });
          controller.close();
        }
      },
    });

    // Return SSE response
    return new Response(sseStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Session-Id': sessionId,
        'X-RateLimit-Remaining': rateLimit.remaining.toString(),
      },
    });
  } catch (error) {
    console.error('[Firesearch API] Fatal error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}

/**
 * Format research context for AI consumption
 */
function formatResearchContext(result: any): string {
  const sources = result.sources || [];
  const summary = result.summary || '';

  let context = `
# Deep Research Results

${summary}

## Verified Sources

`;

  sources.forEach((source: any, index: number) => {
    context += `
### [${index + 1}] ${source.title}
- **URL**: ${source.url}
- **Relevance**: ${Math.round((source.relevanceScore || 0.5) * 100)}%

${source.snippet}

${source.content ? `**Key Information**: ${source.content.slice(0, 500)}...` : ''}

`;
  });

  if (result.followUpQuestions?.length > 0) {
    context += `
## Suggested Follow-up Questions for Deeper Understanding

${result.followUpQuestions.map((q: string, i: number) => `${i + 1}. ${q}`).join('\n')}
`;
  }

  if (result.relatedTopics?.length > 0) {
    context += `
## Related Topics to Explore

${result.relatedTopics.map((topic: string) => `- ${topic}`).join('\n')}
`;
  }

  return context;
}

/**
 * GET endpoint to check session status
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return new Response('Session ID required', { status: 400 });
    }

    const storage = new FiresearchRedisStorage();
    const researchSession = await storage.loadSession(sessionId);

    if (!researchSession) {
      return new Response('Session not found', { status: 404 });
    }

    if (researchSession.userId !== session.user.id) {
      return new Response('Unauthorized', { status: 403 });
    }

    // Get current progress
    const progress = await storage.getProgress(sessionId);

    // Get cached result if available
    const cachedResult = await storage.getCachedResult(sessionId);

    return new Response(
      JSON.stringify({
        session: researchSession,
        progress,
        result: cachedResult,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error('[Firesearch API] GET error:', error);
    return new Response('Internal server error', { status: 500 });
  }
}
