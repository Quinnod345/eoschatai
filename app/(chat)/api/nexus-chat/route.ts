import type { NextRequest } from 'next/server';
import { createDataStream } from 'ai';
import { searchWeb } from '@/lib/web-search';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, searchQueries } = body;

    const stream = createDataStream({
      execute: async (writer) => {
        try {
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
                });
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

          // Deduplicate results
          const uniqueResults = Array.from(
            new Map(allResults.map((item) => [item.url, item])).values(),
          );

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
