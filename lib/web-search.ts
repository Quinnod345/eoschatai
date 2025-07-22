import FirecrawlApp from '@mendable/firecrawl-js';

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  content?: string;
}

export interface SearchProgress {
  query: string;
  status:
    | 'starting'
    | 'fetching'
    | 'parsing'
    | 'completed'
    | 'error'
    | 'rate-limited'
    | 'retrying';
  sitesFound?: number;
  error?: string;
  retryAfter?: number;
}

export type SearchProgressCallback = (progress: SearchProgress) => void;

// Rate limit tracking
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 5000; // Reduced from 10 seconds to 5 seconds
let requestCount = 0;
let resetTime = Date.now() + 60000;

async function waitForRateLimit(): Promise<void> {
  const now = Date.now();

  // Reset counter if past reset time
  if (now > resetTime) {
    requestCount = 0;
    resetTime = now + 60000;
  }

  // Wait if we need to space out requests
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    const waitTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
    await new Promise((resolve) => setTimeout(resolve, waitTime));
  }

  lastRequestTime = Date.now();
}

export async function searchWeb(
  query: string,
  onProgress?: SearchProgressCallback,
  searchIndex = 0,
  maxRetries = 3,
): Promise<SearchResult[]> {
  let retryCount = 0;

  while (retryCount < maxRetries) {
    try {
      console.log(
        `[Web Search] Starting real search ${searchIndex + 1} for: "${query}" (attempt ${retryCount + 1})`,
      );
      onProgress?.({ query, status: 'starting' });

      const app = new FirecrawlApp({
        apiKey: process.env.FIRECRAWL_API_KEY || '',
      });
      if (!app.apiKey) {
        throw new Error(
          'Firecrawl API key missing. Please set FIRECRAWL_API_KEY in environment.',
        );
      }

      // Wait for rate limit before making request
      await waitForRateLimit();
      requestCount++;

      onProgress?.({ query, status: 'fetching' });

      try {
        const searchResults = await app.search(query, {
          pageSize: 3, // Reduced from 5 to conserve API calls
          scrapeOptions: { formats: ['markdown'] },
        });

        onProgress?.({ query, status: 'parsing' });

        const formattedResults: SearchResult[] = searchResults.data.map(
          (res: any) => ({
            title: res.title,
            url: res.url,
            snippet: res.description || '',
            content: res.markdown || res.content,
          }),
        );

        console.log(
          `[Web Search] Found ${formattedResults.length} results for: "${query}"`,
        );
        onProgress?.({
          query,
          status: 'completed',
          sitesFound: formattedResults.length,
        });

        return formattedResults;
      } catch (error: any) {
        // Check if it's a rate limit error
        if (error.statusCode === 429 || error.message?.includes('Rate limit')) {
          const retryAfter = extractRetryAfter(error.message);
          console.log(
            `[Web Search] Rate limited. Waiting ${retryAfter}s before retry...`,
          );

          onProgress?.({
            query,
            status: 'rate-limited',
            retryAfter,
          });

          // Wait for the specified time plus a small buffer
          await new Promise((resolve) =>
            setTimeout(resolve, (retryAfter + 2) * 1000),
          );

          retryCount++;
          onProgress?.({ query, status: 'retrying' });
          continue;
        }

        throw error;
      }
    } catch (error) {
      console.error('[Web Search] Error:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      onProgress?.({ query, status: 'error', error: errorMessage });

      // Return fallback result
      return [
        {
          title: 'Search Error',
          url: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
          snippet:
            'Unable to perform web search. Click here for manual search.',
        },
      ];
    }
  }

  // If we exhausted all retries
  return [];
}

function extractRetryAfter(errorMessage: string): number {
  // Try to extract retry time from error message
  const match = errorMessage.match(/retry after (\d+)s/);
  if (match) {
    return Number.parseInt(match[1], 10);
  }
  return 30; // Default to 30 seconds
}
