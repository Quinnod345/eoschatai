import type { NextRequest } from 'next/server';
import { searchWebComprehensive, type SearchResult } from '@/lib/web-search';
import { auth } from '@/app/(auth)/auth';
import {
  generateResearchPlan,
  detectDomain,
  detectIntent,
} from '@/lib/ai/nexus-query-generator';
import { RESEARCH_DEPTH_PRESETS } from '@/lib/web-search-config';

export const dynamic = 'force-dynamic';

// Enhanced search result with citations
interface CitedSearchResult extends SearchResult {
  citationNumber: number;
  usedInResponse?: boolean;
  relevanceToQuery?: number;
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    const body = await request.json();
    const { query, chatId, streamId, researchDepth = 'STANDARD', model } = body;

    if (!query) {
      return new Response('Query is required', { status: 400 });
    }

    // Get research depth preset
    const depthPreset =
      RESEARCH_DEPTH_PRESETS[
        researchDepth as keyof typeof RESEARCH_DEPTH_PRESETS
      ] || RESEARCH_DEPTH_PRESETS.STANDARD;

    // Create a proper Server-Sent Events stream
    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();

        const writeSSEEvent = (data: any) => {
          const sseData = `data: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(sseData));
          console.log(`[Nexus SSE] Sent event: ${data.type}`, {
            hasResults: !!data.results,
            resultCount: data.results?.length || 0,
          });
        };

        const executeDeepResearch = async () => {
          // Track the start time for research duration calculation
          const researchStartTime = Date.now();

          try {
            // Phase 1: Generate intelligent research plan
            writeSSEEvent({
              type: 'nexus-phase-update',
              phase: 'planning',
              message: 'Analyzing your query and creating research strategy...',
              startTime: researchStartTime,
            });

            // Generate research plan using AI with the specified model
            const researchPlan = await generateResearchPlan({
              userQuery: query,
              domain: detectDomain(query),
              userIntent: detectIntent(query),
              model: model || 'gpt-4.1-mini', // Use provided model or default to gpt-4.1-mini
            });

            // Calculate actual total searches from phases
            const totalSearchCount = researchPlan.phases.reduce(
              (sum, phase) => sum + phase.queries.length,
              0,
            );

            console.log('[Nexus] Generated research plan:', {
              mainObjective: researchPlan.mainObjective,
              queryCount: researchPlan.searchQueries.length,
              actualSearchCount: totalSearchCount,
              depth: researchPlan.searchStrategy.depth,
              phases: researchPlan.phases.length,
            });

            // Send the enhanced research plan
            writeSSEEvent({
              type: 'nexus-research-plan',
              plan: {
                ...researchPlan,
                mainQuery: researchPlan.mainObjective,
                subQuestions: researchPlan.researchQuestions, // Map researchQuestions to subQuestions for UI
                searchQueries: researchPlan.searchQueries.map((q) => q.query), // Extract just the query strings
                researchApproach: researchPlan.searchStrategy.depth,
                totalSearches: totalSearchCount,
                estimatedDuration: researchPlan.estimatedDuration,
                estimatedCredits: researchPlan.estimatedCredits,
              },
              totalSearches: totalSearchCount,
              phases: researchPlan.phases,
            });

            // Wait briefly before starting research
            console.log(
              '[Nexus] Research plan sent, starting research in 2 seconds...',
            );
            await new Promise((resolve) => setTimeout(resolve, 2000));

            // Phase 2: Execute comprehensive research
            writeSSEEvent({
              type: 'nexus-phase-update',
              phase: 'research',
              message: `Executing ${researchPlan.phases.length} research phases...`,
              startTime: Date.now(),
            });

            const allResults: CitedSearchResult[] = [];
            let completedSearches = 0;
            let currentCitationNumber = 1;

            // Execute research phases
            for (
              let phaseIndex = 0;
              phaseIndex < researchPlan.phases.length;
              phaseIndex++
            ) {
              const phase = researchPlan.phases[phaseIndex];

              writeSSEEvent({
                type: 'nexus-phase-start',
                phaseName: phase.name,
                phaseDescription: phase.description,
                phaseIndex,
                totalPhases: researchPlan.phases.length,
                queriesInPhase: phase.queries.length,
              });

              // Execute searches in this phase
              for (
                let queryIndex = 0;
                queryIndex < phase.queries.length;
                queryIndex++
              ) {
                const searchQuery = phase.queries[queryIndex];
                const currentSearchNumber = completedSearches; // This is the current search (0-indexed)

                writeSSEEvent({
                  type: 'nexus-search-progress',
                  currentSearch: searchQuery,
                  searchIndex: currentSearchNumber, // Current search being executed (0-indexed)
                  searchesCompleted: completedSearches,
                  totalSearches: totalSearchCount, // Use actual total count
                  phase: phase.name,
                });

                try {
                  console.log(`[Nexus] Executing search: "${searchQuery}"`);

                  // Send detailed search start notification
                  writeSSEEvent({
                    type: 'nexus-search-detail',
                    searchIndex: currentSearchNumber,
                    query: searchQuery,
                    status: 'starting',
                    message: `Initiating deep web search: "${searchQuery}"`,
                    phase: phase.name,
                    phaseName: phase.name,
                    totalSearches: totalSearchCount,
                  });

                  // Use the enhanced search function with detailed progress tracking
                  const results = await searchWebComprehensive(
                    [searchQuery],
                    (progress) => {
                      // Send highly detailed progress updates
                      const detailMessage =
                        progress.status === 'searching'
                          ? `🔍 Searching web for relevant sources...`
                          : progress.status === 'scraping'
                            ? `📖 Extracting full content from ${progress.sitesFound || 0} sources...`
                            : progress.status === 'parsing'
                              ? `🔬 Analyzing and parsing content...`
                              : progress.status === 'completed'
                                ? `✅ Search complete with ${progress.sitesFound || 0} sources`
                                : progress.status === 'rate-limited'
                                  ? `⏳ Rate limited, waiting ${progress.retryAfter}s...`
                                  : `Processing...`;

                      writeSSEEvent({
                        type: 'nexus-search-detail',
                        searchIndex: currentSearchNumber,
                        query: searchQuery,
                        status: progress.status,
                        sitesFound: progress.sitesFound ?? 0,
                        contentScraped: progress.contentScraped ?? 0,
                        error: progress.error ?? null,
                        phase: phase.name,
                        phaseName: phase.name,
                        message: detailMessage,
                        costEstimate: progress.costEstimate,
                        retryAfter: progress.retryAfter,
                        totalSearches: totalSearchCount,
                      });
                    },
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
                  );

                  console.log(
                    `[Nexus] Search completed with ${results.length} results`,
                  );

                  // Process and add citations to results
                  const citedResults: CitedSearchResult[] = results.map(
                    (result, idx) => ({
                      ...result,
                      citationNumber: currentCitationNumber++,
                      relevanceToQuery: result.relevanceScore || 100 - idx * 5,
                    }),
                  );

                  if (citedResults.length > 0) {
                    // Send discovered sources with proper citation numbers
                    writeSSEEvent({
                      type: 'nexus-sites-found',
                      searchIndex: completedSearches,
                      phase: phase.name,
                      sites: citedResults.map((r) => ({
                        url: r.url,
                        title: r.title,
                        citationNumber: r.citationNumber,
                        hasContent: !!r.content,
                        contentLength: r.content?.length || 0,
                      })),
                    });

                    allResults.push(...citedResults);
                  }

                  completedSearches++;
                } catch (error) {
                  console.error(
                    `[Nexus] Search failed for "${searchQuery}":`,
                    error,
                  );
                  writeSSEEvent({
                    type: 'nexus-search-error',
                    searchIndex: completedSearches,
                    query: searchQuery,
                    error:
                      error instanceof Error ? error.message : 'Unknown error',
                    phase: phase.name,
                  });
                  completedSearches++;
                }

                // Small delay between searches in the same phase
                if (queryIndex < phase.queries.length - 1) {
                  await new Promise((resolve) => setTimeout(resolve, 2000));
                }
              }

              // Phase completion
              writeSSEEvent({
                type: 'nexus-phase-complete',
                phaseName: phase.name,
                phaseIndex,
                resultsFound: allResults.length,
              });

              // Longer delay between phases
              if (phaseIndex < researchPlan.phases.length - 1) {
                writeSSEEvent({
                  type: 'nexus-batch-delay',
                  delaySeconds: 3,
                  reason: 'Preparing next research phase',
                });
                await new Promise((resolve) => setTimeout(resolve, 3000));
              }
            }

            // Phase 3: Analyzing and organizing results
            writeSSEEvent({
              type: 'nexus-phase-update',
              phase: 'analyzing',
              message: 'Analyzing and organizing research findings...',
              startTime: Date.now(),
            });

            // Sort results by relevance and deduplicate
            const uniqueResults = deduplicateResults(allResults);
            const sortedResults = uniqueResults.sort(
              (a, b) => (b.relevanceToQuery || 0) - (a.relevanceToQuery || 0),
            );

            console.log(
              `[Nexus] Analysis complete: ${allResults.length} total, ${uniqueResults.length} unique results`,
            );

            // Identify information gaps for potential follow-up
            const gaps = identifyInformationGaps(query, sortedResults);
            if (gaps.length > 0) {
              writeSSEEvent({
                type: 'nexus-gaps-identified',
                gaps,
                message: 'Identified areas for potential follow-up research',
              });
            }

            // Phase 4: Generate comprehensive response with citations
            writeSSEEvent({
              type: 'nexus-phase-update',
              phase: 'complete',
              message:
                'Research complete! Preparing comprehensive response with citations...',
              startTime: Date.now(),
            });

            // Prepare results with proper citation format
            const resultsWithCitations = sortedResults
              .slice(0, 20)
              .map((result) => ({
                ...result,
                // Format for citation rendering
                citationFormat: `[${result.citationNumber}]`,
                citationMarkdown: `[${result.citationNumber}](${result.url})`,
              }));

            // Send completion with enhanced citation support
            const completionData = {
              type: 'nexus-search-complete',
              totalResults: uniqueResults.length,
              results: resultsWithCitations,
              // Citation metadata for the main chat route
              citationFormat: 'numbered',
              citationStyle: 'academic', // Similar to academic citations
              citations: resultsWithCitations, // Include citations array
              searchContext: {
                query,
                researchPlan: {
                  mainObjective: researchPlan.mainObjective,
                  researchQuestions: researchPlan.researchQuestions,
                  depth: researchPlan.searchStrategy.depth,
                },
                totalSearches: totalSearchCount,
                completedSearches,
                phases: researchPlan.phases.map((p) => p.name),
                researchTime: Date.now() - researchStartTime,
              },
              // Enhanced summary statistics
              statistics: {
                totalSearchesExecuted: completedSearches,
                totalResultsFound: allResults.length,
                uniqueResultsFound: uniqueResults.length,
                contentScraped: uniqueResults.filter((r) => r.content).length,
                totalContentCharacters: uniqueResults.reduce(
                  (sum, r) => sum + (r.content?.length || 0),
                  0,
                ),
                averageContentLength: Math.round(
                  uniqueResults.reduce(
                    (sum, r) => sum + (r.content?.length || 0),
                    0,
                  ) /
                    Math.max(1, uniqueResults.filter((r) => r.content).length),
                ),
                citationsAvailable: resultsWithCitations.length,
              },
              // Information gaps for transparency
              informationGaps: gaps,
              // Research quality indicators
              researchQuality: {
                hasFullContent:
                  uniqueResults.filter((r) => r.content).length > 10,
                hasDiverseSources: uniqueResults.length > 15,
                hasRecentSources: true,
                comprehensiveLevel: researchPlan.searchStrategy.depth,
              },
            };

            console.log(
              `[Nexus] Sending completion with ${resultsWithCitations.length} cited results`,
            );
            writeSSEEvent(completionData);

            // Close the stream
            controller.close();
          } catch (error) {
            console.error('[Nexus] Stream error:', error);
            writeSSEEvent({
              type: 'nexus-error',
              error: error instanceof Error ? error.message : 'Unknown error',
              details: error instanceof Error ? error.stack : undefined,
            });
            controller.close();
          }
        };

        // Start the deep research execution
        executeDeepResearch();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Stream-Id': streamId || 'unknown',
      },
    });
  } catch (error) {
    console.error('[Nexus] Request error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to process request' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}

/**
 * Deduplicate results based on URL
 */
function deduplicateResults(results: CitedSearchResult[]): CitedSearchResult[] {
  const seen = new Map<string, CitedSearchResult>();

  for (const result of results) {
    const existing = seen.get(result.url);
    if (!existing || (result.content && !existing.content)) {
      // Keep the result with content, or the first one if neither has content
      seen.set(result.url, result);
    }
  }

  return Array.from(seen.values());
}

/**
 * Identify information gaps based on query and results
 */
function identifyInformationGaps(
  query: string,
  results: CitedSearchResult[],
): string[] {
  const gaps: string[] = [];
  const queryLower = query.toLowerCase();

  // Check for common information types
  const hasHowTo = results.some(
    (r) =>
      r.title?.toLowerCase().includes('how to') ||
      r.content?.toLowerCase().includes('step by step'),
  );
  const hasPricing = results.some(
    (r) =>
      r.title?.toLowerCase().includes('pricing') ||
      r.content?.toLowerCase().includes('cost'),
  );
  const hasComparison = results.some(
    (r) =>
      r.title?.toLowerCase().includes('vs') ||
      r.title?.toLowerCase().includes('comparison'),
  );
  const hasRecent = results.some((r) => {
    const year = new Date().getFullYear();
    return (
      r.title?.includes(year.toString()) || r.content?.includes(year.toString())
    );
  });

  // Suggest gaps based on what's missing
  if (queryLower.includes('how') && !hasHowTo) {
    gaps.push('Detailed step-by-step instructions');
  }
  if (
    !hasPricing &&
    (queryLower.includes('service') || queryLower.includes('product'))
  ) {
    gaps.push('Pricing and cost information');
  }
  if (!hasComparison) {
    gaps.push('Comparison with alternatives');
  }
  if (!hasRecent) {
    gaps.push('Latest updates and recent developments');
  }

  return gaps.slice(0, 3); // Return top 3 gaps
}
