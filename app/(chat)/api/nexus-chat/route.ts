import type { NextRequest } from 'next/server';
import { createDataStream } from 'ai';
import { searchWeb } from '@/lib/web-search';
import { auth } from '@/app/(auth)/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    const body = await request.json();
    const { query, chatId, streamId } = body;

    if (!query) {
      return new Response('Query is required', { status: 400 });
    }

    const stream = createDataStream({
      execute: async (writer) => {
        try {
          // Phase 1: Generate search queries
          writer.writeData({
            type: 'nexus-phase-update',
            phase: 'planning',
            message: 'Generating research strategy...',
            startTime: Date.now(),
          });

          // Generate diverse search queries
          const searchQueries = [
            query, // Original query
            `${query} overview guide`,
            `${query} best practices`,
            `${query} examples tutorial`,
            `latest ${query} trends 2024`,
          ];

          writer.writeData({
            type: 'nexus-research-plan',
            searchQueries,
            totalSearches: searchQueries.length,
          });

          // Phase 2: Start research
          writer.writeData({
            type: 'nexus-phase-update',
            phase: 'research',
            message: `Conducting ${searchQueries.length} targeted searches...`,
            startTime: Date.now(),
          });

          // Send initial status
          writer.writeData({
            type: 'nexus-search-start',
            totalSearches: searchQueries.length,
          });

          const allResults: any[] = [];
          let completedSearches = 0;

          // Execute searches with progress tracking
          for (let i = 0; i < searchQueries.length; i++) {
            const searchQuery = searchQueries[i];

            writer.writeData({
              type: 'nexus-search-progress',
              currentSearch: searchQuery,
              searchIndex: i,
              searchesCompleted: completedSearches,
            });

            try {
              const results = await searchWeb(searchQuery, (progress) => {
                // Send detailed progress updates
                writer.writeData({
                  type: 'nexus-search-detail',
                  searchIndex: i,
                  query: searchQuery,
                  status: progress.status,
                  sitesFound: progress.sitesFound ?? 0,
                  error: progress.error ?? null,
                  retryAfter: progress.retryAfter ?? null,
                });

                // Handle rate limiting with batch delay notification
                if (progress.status === 'rate-limited' && progress.retryAfter) {
                  writer.writeData({
                    type: 'nexus-batch-delay',
                    delaySeconds: progress.retryAfter,
                    reason: 'API rate limit',
                    searchIndex: i,
                  });
                }
              });

              // Send sites visited
              if (results.length > 0) {
                writer.writeData({
                  type: 'nexus-sites-found',
                  searchIndex: i,
                  sites: results.map((r) => ({
                    url: r.url,
                    title: r.title,
                  })),
                });
              }

              allResults.push(...results);
              completedSearches++;
            } catch (error) {
              console.error(
                `[Nexus] Search failed for "${searchQuery}":`,
                error,
              );
              writer.writeData({
                type: 'nexus-search-error',
                searchIndex: i,
                query: searchQuery,
                error: error instanceof Error ? error.message : 'Unknown error',
              });
              completedSearches++;
            }
          }

          // Phase 3: Analyzing results
          writer.writeData({
            type: 'nexus-phase-update',
            phase: 'analyzing',
            message: 'Processing and analyzing research findings...',
            startTime: Date.now(),
          });

          // Deduplicate results
          const uniqueResults = Array.from(
            new Map(allResults.map((item) => [item.url, item])).values(),
          );

          // Phase 4: Complete
          writer.writeData({
            type: 'nexus-phase-update',
            phase: 'complete',
            message: 'Research complete! Generating comprehensive response...',
            startTime: Date.now(),
          });

          // Send completion
          writer.writeData({
            type: 'nexus-search-complete',
            totalResults: uniqueResults.length,
            results: uniqueResults.slice(0, 15),
          });
        } catch (error) {
          console.error('[Nexus] Stream error:', error);
          writer.writeData({
            type: 'nexus-error',
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      },
      onError: (error) => {
        console.error('[Nexus] Route error:', error);
        return error instanceof Error ? error.message : 'Unknown error';
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
