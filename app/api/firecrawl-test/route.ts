import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import FirecrawlApp from '@mendable/firecrawl-js';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, limit = 10, formats = ['markdown', 'html'] } = body;

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Firecrawl API key not configured' },
        { status: 500 },
      );
    }

    console.log('[Firecrawl Test] Starting search:', {
      query,
      limit,
      formats,
    });

    const app = new FirecrawlApp({ apiKey });

    // Perform the search
    const startTime = Date.now();
    const searchResults = await app.search(query, {
      limit,
      scrapeOptions: {
        formats,
        onlyMainContent: true,
      },
    });

    const duration = Date.now() - startTime;

    console.log('[Firecrawl Test] Search completed:', {
      resultsCount: searchResults.data?.length || 0,
      duration: `${duration}ms`,
    });

    // Format the response
    const formattedResults =
      searchResults.data?.map((result: any, index: number) => ({
        index: index + 1,
        title: result.metadata?.title || 'Untitled',
        url: result.metadata?.sourceURL || result.url || '',
        description: result.metadata?.description || '',
        content: {
          markdown: result.markdown
            ? `${result.markdown.substring(0, 500)}...`
            : null,
          html: result.html ? `${result.html.substring(0, 500)}...` : null,
        },
        fullContent: {
          markdown: result.markdown,
          html: result.html,
        },
        metadata: result.metadata,
      })) || [];

    return NextResponse.json({
      success: true,
      query,
      duration: `${duration}ms`,
      resultsCount: formattedResults.length,
      results: formattedResults,
      raw: searchResults, // Include raw response for debugging
    });
  } catch (error) {
    console.error('[Firecrawl Test] Error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Search failed',
        details: error,
      },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  // Simple test endpoint info
  return NextResponse.json({
    endpoint: '/api/firecrawl-test',
    method: 'POST',
    description: 'Test Firecrawl search API directly',
    usage: {
      body: {
        query: 'Your search query (required)',
        limit: 'Number of results (optional, default: 10)',
        formats: 'Array of formats (optional, default: ["markdown", "html"])',
      },
      example: {
        query: 'How to implement EOS in business',
        limit: 5,
        formats: ['markdown'],
      },
    },
    curlExample: `curl -X POST http://localhost:3000/api/firecrawl-test \\
  -H 'Content-Type: application/json' \\
  -d '{
    "query": "How to implement EOS in business",
    "limit": 5,
    "formats": ["markdown"]
  }'`,
  });
}
