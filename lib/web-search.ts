import FirecrawlApp from '@mendable/firecrawl-js';
import {
  type FirecrawlSearchConfig,
  type SearchContext,
  getNexusSearchConfig,
  getOptimalSearchConfig,
  estimateSearchCost,
} from './web-search-config';

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  content?: string;
  markdown?: string;
  html?: string;
  // Citation support
  citationNumber?: number;
  relevanceScore?: number;
  // Additional metadata from enhanced scraping
  links?: string[];
  screenshot?: string | null;
  metadata?: {
    title?: string;
    description?: string;
    keywords?: string;
    author?: string;
    publishedDate?: string;
    modifiedDate?: string;
    sourceURL?: string;
    statusCode?: number;
  };
}

export interface SearchProgress {
  query: string;
  status:
    | 'starting'
    | 'searching'
    | 'scraping'
    | 'parsing'
    | 'completed'
    | 'error'
    | 'rate-limited'
    | 'retrying';
  sitesFound?: number;
  contentScraped?: number;
  error?: string;
  retryAfter?: number;
  costEstimate?: {
    baseCredits: number;
    totalEstimate: number;
    costFactors: string[];
  };
}

export type SearchProgressCallback = (progress: SearchProgress) => void;

// Rate limit tracking
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 3000; // 3 seconds between requests
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

/**
 * Enhanced search function using Firecrawl's search API with content scraping
 */
export async function searchWeb(
  query: string,
  onProgress?: SearchProgressCallback,
  searchIndex = 0,
  maxRetries = 3,
  searchContext?: SearchContext,
  totalSearches?: number,
): Promise<SearchResult[]> {
  let retryCount = 0;

  // Determine optimal configuration based on context or use Nexus mode defaults
  let searchConfig: FirecrawlSearchConfig;
  if (searchContext) {
    searchConfig = getOptimalSearchConfig(searchContext);
  } else if (totalSearches !== undefined) {
    // Use Nexus mode configuration that adapts based on search position
    searchConfig = getNexusSearchConfig(searchIndex, totalSearches);
  } else {
    // Default configuration for comprehensive research
    searchConfig = getOptimalSearchConfig({
      type: 'comprehensive',
      priority: 'quality',
      timeframe: 'year',
    });
  }

  // Estimate costs and include in progress updates
  const costEstimate = estimateSearchCost(searchConfig);

  while (retryCount < maxRetries) {
    try {
      console.log(
        `[Web Search] Starting search ${searchIndex + 1} for: "${query}" (attempt ${retryCount + 1})`,
        `\n  Config: ${JSON.stringify(searchConfig, null, 2)}`,
        `\n  Cost estimate: ${costEstimate.totalEstimate} credits`,
      );

      onProgress?.({
        query,
        status: 'starting',
        costEstimate: {
          baseCredits: costEstimate.baseCredits,
          totalEstimate: costEstimate.totalEstimate,
          costFactors: costEstimate.costFactors,
        },
      });

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

      onProgress?.({ query, status: 'searching' });

      try {
        // Use Firecrawl's search API with content scraping
        const searchResponse = await app.search(query, {
          limit: searchConfig.limit,
          scrapeOptions: searchConfig.scrapeOptions,
          location: searchConfig.location,
          tbs: searchConfig.tbs,
        });

        onProgress?.({
          query,
          status: 'scraping',
          sitesFound: searchResponse.data?.length || 0,
        });

        // Enhanced result processing with full content
        const formattedResults: SearchResult[] = [];

        if (searchResponse.data && Array.isArray(searchResponse.data)) {
          for (let i = 0; i < searchResponse.data.length; i++) {
            const result = searchResponse.data[i];

            // Extract and process each result
            const formattedResult: SearchResult = {
              title: result.title || 'Untitled',
              url: result.url || '',
              snippet: result.description || ('snippet' in result ? (result as { snippet: string }).snippet : '') || '',
              // Full content from scraping
              markdown: result.markdown || undefined,
              content: result.markdown || ('content' in result ? (result as { content: string }).content : undefined) || undefined,
              html: result.html || undefined,
              // Additional metadata
              links: result.links || [],
              screenshot: result.screenshot || null,
              metadata: {
                title: result.metadata?.title || result.title,
                description: result.metadata?.description || result.description,
                keywords: result.metadata?.keywords,
                author: result.metadata?.author,
                publishedDate: result.metadata?.publishedDate,
                modifiedDate: result.metadata?.modifiedDate,
                sourceURL: result.url,
                statusCode: result.metadata?.statusCode || 200,
              },
              // Calculate relevance score based on position and content quality
              relevanceScore: calculateRelevanceScore(i, result),
            };

            formattedResults.push(formattedResult);
          }
        }

        console.log(
          `[Web Search] Successfully processed ${formattedResults.length} results for: "${query}"`,
          '\n  Sample result:',
          formattedResults[0]
            ? {
                title: formattedResults[0].title,
                url: formattedResults[0].url,
                hasMarkdown: !!formattedResults[0].markdown,
                markdownLength: formattedResults[0].markdown?.length || 0,
                hasContent: !!formattedResults[0].content,
                contentLength: formattedResults[0].content?.length || 0,
                relevanceScore: formattedResults[0].relevanceScore,
              }
            : 'No results',
        );

        onProgress?.({
          query,
          status: 'completed',
          sitesFound: formattedResults.length,
          contentScraped: formattedResults.filter((r) => r.content).length,
        });

        return formattedResults;
      } catch (error: unknown) {
        // Check if it's a rate limit error
        const errorObj = error as { statusCode?: number; message?: string };
        if (errorObj.statusCode === 429 || errorObj.message?.includes('Rate limit')) {
          const retryAfter = extractRetryAfter(errorObj.message || '');
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

      // Return fallback result with error context
      return [
        {
          title: 'Search Error',
          url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
          snippet: `Unable to perform web search: ${errorMessage}. Click for manual search.`,
          relevanceScore: 0,
        },
      ];
    }
  }

  // If we exhausted all retries
  return [];
}

/**
 * Calculate relevance score based on position and content quality
 */
function calculateRelevanceScore(position: number, result: Partial<SearchResult> & { markdown?: string; metadata?: { statusCode?: number }; links?: string[] }): number {
  let score = 100 - position * 10; // Base score from position

  // Boost score based on content quality
  if (result.markdown && result.markdown.length > 1000) {
    score += 10; // Has substantial content
  }
  if (result.markdown && result.markdown.length > 5000) {
    score += 10; // Has comprehensive content
  }
  if (result.metadata?.statusCode === 200) {
    score += 5; // Successfully scraped
  }
  if (result.links && result.links.length > 10) {
    score += 5; // Has many links (likely authoritative)
  }

  return Math.min(100, Math.max(0, score));
}

/**
 * Enhanced search with multiple queries and result deduplication
 */
export async function searchWebComprehensive(
  queries: string[],
  onProgress?: SearchProgressCallback,
  searchContext?: SearchContext,
): Promise<SearchResult[]> {
  const allResults: SearchResult[] = [];
  const seenUrls = new Set<string>();

  for (let i = 0; i < queries.length; i++) {
    const query = queries[i];

    try {
      const results = await searchWeb(
        query,
        onProgress,
        i,
        3,
        searchContext,
        queries.length,
      );

      // Add results, avoiding duplicates
      for (const result of results) {
        if (!seenUrls.has(result.url)) {
          seenUrls.add(result.url);
          allResults.push({
            ...result,
            // Track which query found this result
            citationNumber: allResults.length + 1,
          });
        }
      }

      // Small delay between searches to avoid rate limiting
      if (i < queries.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.error(`[Web Search] Failed to search for "${query}":`, error);
    }
  }

  // Sort by relevance score
  allResults.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));

  return allResults;
}

function extractRetryAfter(errorMessage: string): number {
  // Try to extract retry time from error message
  const match = errorMessage.match(/retry after (\d+)s/);
  if (match) {
    return Number.parseInt(match[1], 10);
  }
  return 30; // Default to 30 seconds
}
