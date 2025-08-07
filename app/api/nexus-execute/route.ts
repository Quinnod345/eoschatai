import type { NextRequest } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { searchWeb } from '@/lib/web-search';
import { getNexusSearchConfig } from '@/lib/web-search-config';
import type { ResearchPlan } from '@/lib/ai/nexus-query-generator';
import { extractCitationsFromResults } from '@/lib/ai/citation-formatter';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    const body = await request.json();
    const { plan, chatId } = body;

    if (!plan) {
      return new Response('Research plan is required', { status: 400 });
    }

    const researchPlan = plan as ResearchPlan;

    // Create a streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const writeSSEEvent = (data: any) => {
          const event = `data: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(event));
        };

        try {
          // Calculate total searches
          const totalSearchCount = researchPlan.phases.reduce(
            (total, phase) => total + phase.queries.length,
            0,
          );

          // Send enhanced research start event
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
          let currentSearchNumber = 0;

          // Execute each phase
          for (
            let phaseIndex = 0;
            phaseIndex < researchPlan.phases.length;
            phaseIndex++
          ) {
            const phase = researchPlan.phases[phaseIndex];

            // Send enhanced phase start event
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
                percentage: Math.round(
                  (phaseIndex / researchPlan.phases.length) * 100,
                ),
              },
            });

            // Execute searches in this phase with batching
            const BATCH_SIZE = 2; // Process 2 queries in parallel
            const phaseResults: any[] = [];

            for (
              let queryIndex = 0;
              queryIndex < phase.queries.length;
              queryIndex += BATCH_SIZE
            ) {
              const batch = phase.queries.slice(
                queryIndex,
                queryIndex + BATCH_SIZE,
              );

              const batchPromises = batch.map(async (query, batchIndex) => {
                const searchNumber =
                  currentSearchNumber + queryIndex + batchIndex + 1;

                // Send search start event
                writeSSEEvent({
                  type: 'nexus-search-progress',
                  searchNumber: searchNumber,
                  totalSearches: totalSearchCount,
                  query: query,
                  phase: phase.name,
                  status: 'searching',
                  progress: {
                    percentage: Math.round(
                      (searchNumber / totalSearchCount) * 100,
                    ),
                  },
                });

                try {
                  // Get search configuration based on phase and strategy
                  const searchConfig = getNexusSearchConfig(
                    researchPlan.searchStrategy.depth,
                    phaseIndex,
                  );

                  // Execute the search with context
                  const results = await searchWeb(
                    query,
                    (progress) => {
                      // Send progress updates
                      writeSSEEvent({
                        type: 'nexus-search-update',
                        searchNumber: searchNumber,
                        query: query,
                        status: progress.status,
                        sitesFound: progress.sitesFound,
                        contentScraped: progress.contentScraped,
                        phase: phase.name,
                      });
                    },
                    searchNumber - 1,
                    3, // max retries
                    {
                      query: query,
                      domain: 'research',
                      intent: 'comprehensive',
                      depth: researchPlan.searchStrategy.depth as any,
                    },
                    totalSearchCount,
                  );

                  // Add citation numbers to results
                  const numberedResults = results.map((result, idx) => ({
                    ...result,
                    citationNumber:
                      allResults.length + phaseResults.length + idx + 1,
                    phase: phase.name,
                    searchQuery: query,
                  }));

                  // Send search complete event
                  writeSSEEvent({
                    type: 'nexus-search-complete',
                    searchNumber: searchNumber,
                    query: query,
                    resultsFound: results.length,
                    totalResultsSoFar:
                      allResults.length + phaseResults.length + results.length,
                    phase: phase.name,
                    sites: results.slice(0, 3).map((r) => ({
                      title: r.title,
                      url: r.url,
                      snippet: `${r.snippet?.substring(0, 150)}...`,
                    })),
                  });

                  return numberedResults;
                } catch (error) {
                  console.error(
                    `[Nexus Execute] Search failed for query: ${query}`,
                    error,
                  );
                  // Send error event but continue with other searches
                  writeSSEEvent({
                    type: 'nexus-search-error',
                    searchNumber: searchNumber,
                    query: query,
                    error:
                      error instanceof Error ? error.message : 'Search failed',
                    phase: phase.name,
                  });
                  return [];
                }
              });

              // Wait for batch to complete
              const batchResults = await Promise.all(batchPromises);

              // Flatten and add to results
              batchResults.forEach((results) => {
                phaseResults.push(...results);
                allResults.push(...results);
              });

              // Add small delay between batches to respect rate limits
              if (queryIndex + BATCH_SIZE < phase.queries.length) {
                await new Promise((resolve) => setTimeout(resolve, 1500));
              }
            }

            currentSearchNumber += phase.queries.length;

            // Send phase complete event with summary
            writeSSEEvent({
              type: 'nexus-phase-complete',
              phaseNumber: phaseIndex + 1,
              phaseName: phase.name,
              resultsFound: phaseResults.length,
              totalResultsSoFar: allResults.length,
              uniqueSources: [
                ...new Set(phaseResults.map((r) => new URL(r.url).hostname)),
              ].length,
              progress: {
                completedPhases: phaseIndex + 1,
                totalPhases: researchPlan.phases.length,
                percentage: Math.round(
                  ((phaseIndex + 1) / researchPlan.phases.length) * 100,
                ),
              },
            });
          }

          // Process and format citations
          const citations = extractCitationsFromResults(allResults);

          // Calculate research quality metrics
          const uniqueDomains = [
            ...new Set(allResults.map((r) => new URL(r.url).hostname)),
          ];
          const researchDuration = Math.round(
            (Date.now() - researchStartTime) / 1000,
          );

          // Send enhanced completion event
          writeSSEEvent({
            type: 'nexus-research-complete',
            totalResults: allResults.length,
            duration: researchDuration,
            results: allResults,
            citations: citations,
            summary: {
              phasesCompleted: researchPlan.phases.length,
              searchesCompleted: totalSearchCount,
              uniqueSources: uniqueDomains.length,
              averageResultsPerSearch: Math.round(
                allResults.length / totalSearchCount,
              ),
              researchQuality: {
                coverage:
                  allResults.length > 30
                    ? 'comprehensive'
                    : allResults.length > 15
                      ? 'good'
                      : 'basic',
                diversity:
                  uniqueDomains.length > 15
                    ? 'excellent'
                    : uniqueDomains.length > 8
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
              uniqueDomains: uniqueDomains.length,
              domains: uniqueDomains.slice(0, 10),
            },
          });

          // Close the stream
          controller.close();
        } catch (error) {
          console.error('[Nexus Execute] Fatal error:', error);
          writeSSEEvent({
            type: 'nexus-error',
            error: error instanceof Error ? error.message : 'Research failed',
            fatal: true,
          });
          controller.close();
        }
      },
    });

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
        error:
          error instanceof Error ? error.message : 'Failed to execute research',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}

