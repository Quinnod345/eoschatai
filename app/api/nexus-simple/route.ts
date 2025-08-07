import type { NextRequest } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { searchWebSimple } from '@/lib/web-search-simple';

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    const body = await request.json();
    const { query } = body;

    if (!query) {
      return new Response('Query is required', { status: 400 });
    }

    console.log('[Nexus Simple] Starting search for:', query);

    // Create a streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const writeSSEEvent = (data: any) => {
          const event = `data: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(event));
        };

        try {
          // Send start event
          writeSSEEvent({
            type: 'nexus-search-start',
            message: 'Starting web search...',
            query,
          });

          // Perform the search using Firecrawl
          const results = await searchWebSimple(query, 15);

          // Send progress event
          writeSSEEvent({
            type: 'nexus-search-progress',
            message: `Found ${results.length} results`,
            count: results.length,
          });

          // Send the results
          writeSSEEvent({
            type: 'nexus-search-complete',
            results: results,
            totalResults: results.length,
            query: query,
          });

          // Close the stream
          controller.close();
        } catch (error) {
          console.error('[Nexus Simple] Error:', error);
          writeSSEEvent({
            type: 'nexus-error',
            error: error instanceof Error ? error.message : 'Search failed',
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
    console.error('[Nexus Simple] Error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to search',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}
