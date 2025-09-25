import type { NextRequest } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { searchWeb } from '@/lib/web-search';
import { getNexusSearchConfig } from '@/lib/web-search-config';
import type { ResearchPlan } from '@/lib/ai/nexus-query-generator';
import { extractCitationsFromResults } from '@/lib/ai/citation-formatter';
import {
  getAccessContext,
  incrementUsageCounter,
  reserveDeepResearchSlot,
} from '@/lib/entitlements';
import { trackBlockedAction } from '@/lib/analytics';

export const maxDuration = 60;

const CONFIDENCE_THRESHOLD = 1.2;
const CONFIDENCE_DOMAINS_THRESHOLD = 6;

const toSeconds = (value: number) => Math.max(1, Math.ceil(value / 1000));

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    const body = await request.json();
    const { plan, chatId: _chatId, maxLookups } = body as {
      plan?: ResearchPlan;
      chatId?: string;
      maxLookups?: number;
    };

    if (!plan) {
      return new Response('Research plan is required', { status: 400 });
    }

    const researchPlan = plan as ResearchPlan;
    const accessContext = await getAccessContext(session.user.id);
    const deepFeature = accessContext.entitlements.features.deep_research;
    const requestedLookups = Number.isFinite(Number(maxLookups))
      ? Math.max(1, Math.floor(Number(maxLookups)))
      : null;
    const userOrgId = accessContext.user.orgId;
    const userPlan = accessContext.user.plan;
    const isDemoMode = !deepFeature.enabled && userPlan === 'free';

    if (!deepFeature.enabled && !isDemoMode) {
      await trackBlockedAction({
        feature: 'deep_research',
        reason: 'not_enabled',
        user_id: session.user.id,
        org_id: userOrgId,
        status: 403,
      });

      return new Response(
        JSON.stringify({
          code: 'ENTITLEMENT_BLOCK',
          feature: 'deep_research',
          reason: 'not_enabled',
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    const totalSearchCount = researchPlan.phases.reduce(
      (total, phase) => total + phase.queries.length,
      0,
    );

    const planCap =
      deepFeature.enabled && deepFeature.lookups_per_run > 0
        ? deepFeature.lookups_per_run
        : Number.POSITIVE_INFINITY;
    const demoCap = isDemoMode ? 4 : Number.POSITIVE_INFINITY;
    const effectiveLookupCap = Math.max(
      1,
      Math.min(
        totalSearchCount,
        requestedLookups ?? totalSearchCount,
        planCap,
        demoCap,
      ),
    );

    const reservation = isDemoMode
      ? null
      : await reserveDeepResearchSlot(session.user.id, 2);

    if (!isDemoMode && reservation && !reservation.allowed) {
      const retrySeconds = toSeconds(reservation.retryInMs);
      await trackBlockedAction({
        feature: 'deep_research',
        reason: 'rate_limited',
        user_id: session.user.id,
        org_id: userOrgId,
        status: 429,
      });

      return new Response(
        JSON.stringify({
          code: 'ENTITLEMENT_BLOCK',
          feature: 'deep_research',
          reason: 'rate_limited',
          retry_in: retrySeconds,
          message: `Deep Research is busy right now. Try again in about ${retrySeconds} seconds.`,
        }),
        {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    if (!isDemoMode) {
      await incrementUsageCounter(session.user.id, 'deep_runs_day', 1);
    }

    const encoder = new TextEncoder();
    const releaseReservation = async () => {
      if (!isDemoMode) {
        await reservation?.release();
      }
    };

    let stream: ReadableStream<Uint8Array>;
    try {
      stream = new ReadableStream({
        async start(controller) {
          const writeSSEEvent = (data: any) => {
            const event = `data: ${JSON.stringify(data)}\n\n`;
            controller.enqueue(encoder.encode(event));
          };

          let reservationReleased = false;
          const ensureReleased = async () => {
            if (!reservationReleased) {
              reservationReleased = true;
              await releaseReservation();
            }
          };

          try {
            let executedLookups = 0;
            let confidenceScore = 0;
            let shouldStop = false;
            let stopReason: 'plan_cap' | 'demo_cap' | 'confidence' | null = null;
            let currentSearchNumber = 0;
            const uniqueDomains = new Set<string>();

            writeSSEEvent({
              type: 'nexus-search-start',
              message: 'Starting comprehensive AI-driven research...',
              totalPhases: researchPlan.phases.length,
              phases: researchPlan.phases.map((p) => ({
                name: p.name,
                description: p.description,
                queryCount: p.queries.length,
              })),
              totalSearches: totalSearchCount,
              estimatedDuration: researchPlan.estimatedDuration,
              researchStrategy: {
                depth: researchPlan.searchStrategy.depth,
                focus: researchPlan.searchStrategy.focus,
                timeframe: researchPlan.searchStrategy.timeframe,
              },
            });

            const researchStartTime = Date.now();
            const allResults: any[] = [];

            for (let phaseIndex = 0; phaseIndex < researchPlan.phases.length; phaseIndex++) {
              if (shouldStop) {
                break;
              }

              const phase = researchPlan.phases[phaseIndex];

              writeSSEEvent({
                type: 'nexus-phase-start',
                phaseNumber: phaseIndex + 1,
                phaseName: phase.name,
                phaseDescription: phase.description,
                queryCount: phase.queries.length,
                progress: {
                  completedPhases: phaseIndex,
                  totalPhases: researchPlan.phases.length,
                  completedSearches: currentSearchNumber,
                  totalSearches: totalSearchCount,
                  percentage: Math.round((phaseIndex / researchPlan.phases.length) * 100),
                },
              });

              const BATCH_SIZE = 2;
              const phaseResults: any[] = [];

              for (let queryIndex = 0; queryIndex < phase.queries.length; queryIndex += BATCH_SIZE) {
                if (shouldStop) {
                  break;
                }

                const remaining = effectiveLookupCap - executedLookups;
                if (remaining <= 0) {
                  shouldStop = true;
                  stopReason = isDemoMode ? 'demo_cap' : 'plan_cap';
                  break;
                }

                const batch = phase.queries.slice(
                  queryIndex,
                  queryIndex + Math.min(BATCH_SIZE, remaining),
                );

                if (batch.length === 0) {
                  shouldStop = true;
                  break;
                }

                const baseSearchNumber = currentSearchNumber;
                const batchPromises = batch.map(async (query, batchIndex) => {
                  const searchNumber = baseSearchNumber + batchIndex + 1;

                  writeSSEEvent({
                    type: 'nexus-search-progress',
                    searchNumber,
                    totalSearches: totalSearchCount,
                    query,
                    phase: phase.name,
                    status: 'searching',
                    progress: {
                      percentage: Math.round((searchNumber / totalSearchCount) * 100),
                    },
                  });

                  try {
                    const searchConfig = getNexusSearchConfig(
                      searchNumber - 1,
                      totalSearchCount,
                    );

                    const results = await searchWeb(
                      query,
                      (progress) => {
                        writeSSEEvent({
                          type: 'nexus-search-update',
                          searchNumber,
                          query,
                          status: progress.status,
                          sitesFound: progress.sitesFound,
                          contentScraped: progress.contentScraped,
                          phase: phase.name,
                        });
                      },
                      searchNumber - 1,
                      3,
                      {
                        type: 'comprehensive',
                        priority: 'quality',
                        depth:
                          researchPlan.searchStrategy.depth === 'comprehensive'
                            ? 'deep'
                            : (researchPlan.searchStrategy.depth as
                                | 'shallow'
                                | 'medium'
                                | 'deep'),
                        timeframe: researchPlan.searchStrategy.timeframe as any,
                      },
                      totalSearchCount,
                    );

                    const numberedResults = results.map((result, idx) => ({
                      ...result,
                      citationNumber:
                        allResults.length + phaseResults.length + idx + 1,
                      phase: phase.name,
                      searchQuery: query,
                    }));

                    const filteredResults = isDemoMode
                      ? numberedResults.slice(0, 2).map((entry) => ({
                          ...entry,
                          demo: true,
                        }))
                      : numberedResults;

                    writeSSEEvent({
                      type: 'nexus-search-complete',
                      searchNumber,
                      query,
                      resultsFound: filteredResults.length,
                      totalResultsSoFar:
                        allResults.length + phaseResults.length + filteredResults.length,
                      phase: phase.name,
                      sites: filteredResults.slice(0, 3).map((r) => ({
                        title: r.title,
                        url: r.url,
                        snippet: `${r.snippet?.substring(0, 150)}...`,
                      })),
                    });

                    const confidenceIncrement =
                      results.length >= 8
                        ? 0.5
                        : results.length >= 5
                          ? 0.35
                          : results.length >= 3
                            ? 0.2
                            : results.length > 0
                              ? 0.1
                              : 0;

                    return { results: filteredResults, confidence: confidenceIncrement };
                  } catch (error) {
                    console.error(`[Nexus Execute] Search failed for query: ${query}`, error);
                    writeSSEEvent({
                      type: 'nexus-search-error',
                      searchNumber,
                      query,
                      error: error instanceof Error ? error.message : 'Search failed',
                      phase: phase.name,
                    });
                    return { results: [] as any[], confidence: 0 };
                  }
                });

                const batchResults = await Promise.all(batchPromises);

                batchResults.forEach(({ results, confidence }) => {
                  phaseResults.push(...results);
                  allResults.push(...results);
                  confidenceScore += confidence;
                  for (const item of results) {
                    try {
                      uniqueDomains.add(new URL(item.url).hostname);
                    } catch (error) {
                      console.warn('[Nexus Execute] Failed to parse domain', error);
                    }
                  }
                });

                executedLookups += batch.length;
                currentSearchNumber += batch.length;

                if (queryIndex + BATCH_SIZE < phase.queries.length) {
                  await new Promise((resolve) => setTimeout(resolve, 1500));
                }

                if (
                  !isDemoMode &&
                  confidenceScore >= CONFIDENCE_THRESHOLD &&
                  uniqueDomains.size >= CONFIDENCE_DOMAINS_THRESHOLD
                ) {
                  shouldStop = true;
                  stopReason = 'confidence';
                  break;
                }
              }

              writeSSEEvent({
                type: 'nexus-phase-complete',
                phaseNumber: phaseIndex + 1,
                phaseName: phase.name,
                resultsFound: phaseResults.length,
                totalResultsSoFar: allResults.length,
                uniqueSources: phaseResults.length
                  ? [
                      ...new Set(
                        phaseResults
                          .map((result) => {
                            try {
                              return new URL(result.url).hostname;
                            } catch {
                              return null;
                            }
                          })
                          .filter(Boolean),
                      ),
                    ].length
                  : 0,
                progress: {
                  completedPhases: phaseIndex + 1,
                  totalPhases: researchPlan.phases.length,
                  percentage: Math.round(((phaseIndex + 1) / researchPlan.phases.length) * 100),
                },
              });
            }

            const citations = extractCitationsFromResults(allResults);
            const uniqueDomainList = [...uniqueDomains];
            const researchDuration = Math.round((Date.now() - researchStartTime) / 1000);

            if (stopReason === 'plan_cap') {
              writeSSEEvent({
                type: 'nexus-run-limited',
                reason: 'plan_cap',
                allowedLookups: effectiveLookupCap,
                requestedLookups: totalSearchCount,
              });
            }

            if (stopReason === 'demo_cap') {
              writeSSEEvent({
                type: 'nexus-run-limited',
                reason: 'demo_cap',
                allowedLookups: effectiveLookupCap,
                requestedLookups: totalSearchCount,
              });
            }

            if (stopReason === 'confidence') {
              writeSSEEvent({
                type: 'nexus-early-stop',
                reason: 'confidence',
                confidence: Number(confidenceScore.toFixed(2)),
                lookupsExecuted: executedLookups,
              });
            }

            writeSSEEvent({
              type: 'nexus-research-complete',
              totalResults: allResults.length,
              duration: researchDuration,
              results: allResults,
              citations,
              summary: {
                phasesCompleted: researchPlan.phases.length,
                searchesCompleted: totalSearchCount,
                uniqueSources: uniqueDomainList.length,
                averageResultsPerSearch: Math.round(allResults.length / totalSearchCount),
                researchQuality: {
                  coverage:
                    allResults.length > 30
                      ? 'comprehensive'
                      : allResults.length > 15
                        ? 'good'
                        : 'basic',
                  diversity:
                    uniqueDomainList.length > 15
                      ? 'excellent'
                      : uniqueDomainList.length > 8
                        ? 'good'
                        : 'moderate',
                  depth: researchPlan.searchStrategy.depth,
                  completeness: `${Math.round((allResults.length / (totalSearchCount * 3)) * 100)}%`,
                },
              },
              statistics: {
                totalSearches: totalSearchCount,
                totalResults: allResults.length,
                totalPhases: researchPlan.phases.length,
                duration: researchDuration,
                uniqueDomains: uniqueDomainList.length,
                domains: uniqueDomainList.slice(0, 10),
              },
              demo: isDemoMode,
            });

            if (isDemoMode) {
              writeSSEEvent({
                type: 'nexus-demo-upgrade',
                message:
                  'This was a limited Deep Research demo. Upgrade to unlock full reports and unlimited lookups.',
              });
            }

            controller.close();
          } catch (error) {
            console.error('[Nexus Execute] Fatal error:', error);
            writeSSEEvent({
              type: 'nexus-error',
              error: error instanceof Error ? error.message : 'Research failed',
              fatal: true,
            });
            controller.close();
          } finally {
            await ensureReleased();
          }
        },
      });
    } catch (error) {
      await releaseReservation();
      throw error;
    }

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('[Nexus Execute] Error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to execute research',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}
