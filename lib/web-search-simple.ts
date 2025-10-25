import FirecrawlApp from '@mendable/firecrawl-js';

export interface SimpleSearchResult {
  title: string;
  url: string;
  snippet: string;
  content?: string;
  markdown?: string;
}

/**
 * Simplified web search function for the nexus-simple API
 * @param query - The search query
 * @param limit - Maximum number of results (default: 10)
 * @returns Array of search results
 */
export async function searchWebSimple(
  query: string,
  limit = 10,
): Promise<SimpleSearchResult[]> {
  try {
    console.log(
      `[Web Search Simple] Searching for: "${query}" with limit: ${limit}`,
    );

    const app = new FirecrawlApp({
      apiKey: process.env.FIRECRAWL_API_KEY || '',
    });

    if (!app.apiKey) {
      throw new Error(
        'Firecrawl API key missing. Please set FIRECRAWL_API_KEY in environment.',
      );
    }

    // Use Firecrawl's search API with improved options for better content extraction
    const searchResponse = await app.search(query, {
      limit: limit,
      scrapeOptions: {
        formats: ['markdown', 'html'],
        waitFor: 2500, // Increased from 1000ms to allow dynamic content to load
        timeout: 30000, // Increased from 15000ms for more reliable scraping
        onlyMainContent: true, // Focus on main content, skip ads/navigation
        parsePDF: false, // Keep false for speed
      },
    });

    // Process and format results
    const formattedResults: SimpleSearchResult[] = [];

    if (searchResponse.data && Array.isArray(searchResponse.data)) {
      for (const result of searchResponse.data) {
        const formattedResult: SimpleSearchResult = {
          title: result.title || 'Untitled',
          url: result.url || '',
          snippet: result.description || (result as any).snippet || '',
          markdown: result.markdown || undefined,
          content: result.markdown || (result as any).content || undefined,
        };

        formattedResults.push(formattedResult);
      }
    }

    console.log(
      `[Web Search Simple] Successfully found ${formattedResults.length} results for: "${query}"`,
    );

    return formattedResults;
  } catch (error) {
    console.error('[Web Search Simple] Error:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';

    // Return empty array on error instead of throwing
    return [];
  }
}
