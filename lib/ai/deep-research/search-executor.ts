/**
 * Deep Research System - Search Executor
 *
 * Handles parallel batch execution of Firecrawl searches with:
 * - Concurrency control (p-limit style)
 * - Result deduplication by URL
 * - Content quality scoring
 * - Retry logic for failed searches
 */

import FirecrawlApp from '@mendable/firecrawl-js';
import type {
  ResearchSource,
  SearchBatchResult,
  DeepResearchConfig,
} from './types';

// ─── Quality Scoring ─────────────────────────────────────────────────────────

/** Domains that tend to produce high-quality content */
const HIGH_QUALITY_DOMAINS = new Set([
  'nature.com',
  'science.org',
  'arxiv.org',
  'scholar.google.com',
  'ieee.org',
  'acm.org',
  'nytimes.com',
  'washingtonpost.com',
  'reuters.com',
  'apnews.com',
  'bbc.com',
  'bbc.co.uk',
  'theguardian.com',
  'economist.com',
  'ft.com',
  'bloomberg.com',
  'wsj.com',
  'hbr.org',
  'mckinsey.com',
  'bcg.com',
  'deloitte.com',
  'pwc.com',
  'statista.com',
  'pewresearch.org',
  'brookings.edu',
  'rand.org',
  'who.int',
  'worldbank.org',
  'imf.org',
  'nih.gov',
  'cdc.gov',
  'gov.uk',
  'europa.eu',
  'un.org',
  'github.com',
  'stackoverflow.com',
  'medium.com',
  'substack.com',
  'techcrunch.com',
  'theverge.com',
  'arstechnica.com',
  'wired.com',
  'forbes.com',
]);

/** Domains that tend to produce low-quality or SEO content */
const LOW_QUALITY_DOMAINS = new Set([
  'pinterest.com',
  'quora.com',
  'answers.yahoo.com',
  'wikihow.com',
  'ehow.com',
  'about.com',
]);

function getDomainFromUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    // Remove www. prefix
    return hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/**
 * Score a search result for quality (0-1 scale)
 */
function scoreSourceQuality(
  title: string,
  url: string,
  content: string,
  snippet: string,
): number {
  let score = 0.5; // Base score

  const domain = getDomainFromUrl(url);

  // Domain quality bonus/penalty
  if (HIGH_QUALITY_DOMAINS.has(domain)) {
    score += 0.15;
  }
  // .edu and .gov domains get a bonus
  if (domain.endsWith('.edu') || domain.endsWith('.gov')) {
    score += 0.1;
  }
  if (LOW_QUALITY_DOMAINS.has(domain)) {
    score -= 0.2;
  }

  // Content length scoring (longer content = more substance)
  const contentLen = content?.length || 0;
  if (contentLen > 5000) {
    score += 0.15;
  } else if (contentLen > 2000) {
    score += 0.1;
  } else if (contentLen > 500) {
    score += 0.05;
  } else if (contentLen < 200) {
    score -= 0.15; // Very short content is likely low quality
  }

  // Title quality
  if (title && title.length > 10 && title.length < 200) {
    score += 0.05;
  }

  // Snippet quality
  if (snippet && snippet.length > 50) {
    score += 0.05;
  }

  // Penalize if content is mostly navigation/boilerplate
  if (content) {
    const navPatterns =
      /cookie|privacy policy|terms of service|subscribe|newsletter|sign up|log in/gi;
    const matches = content.match(navPatterns);
    if (matches && matches.length > 5) {
      score -= 0.1;
    }
  }

  // Clamp to [0, 1]
  return Math.max(0, Math.min(1, score));
}

// ─── Concurrency Limiter ─────────────────────────────────────────────────────

/**
 * Simple concurrency limiter (p-limit alternative without external dependency)
 */
function createConcurrencyLimiter(concurrency: number) {
  let active = 0;
  const queue: Array<() => void> = [];

  function next() {
    if (queue.length > 0 && active < concurrency) {
      active++;
      const resolve = queue.shift();
      if (resolve) resolve();
    }
  }

  return async function limit<T>(fn: () => Promise<T>): Promise<T> {
    // Wait for a slot to open
    if (active >= concurrency) {
      await new Promise<void>((resolve) => {
        queue.push(resolve);
      });
    } else {
      active++;
    }

    try {
      return await fn();
    } finally {
      active--;
      next();
    }
  };
}

// ─── Search Execution ────────────────────────────────────────────────────────

/**
 * Execute a single search query via Firecrawl
 */
async function executeSingleSearch(
  query: string,
  areaId: string,
  config: DeepResearchConfig,
  existingUrls: Set<string>,
  sourceIndexStart: number,
): Promise<SearchBatchResult> {
  const startTime = Date.now();

  try {
    const app = new FirecrawlApp({
      apiKey: process.env.FIRECRAWL_API_KEY || '',
    });

    if (!app.apiKey) {
      throw new Error('FIRECRAWL_API_KEY is not set');
    }

    const searchResponse = await app.search(query, {
      limit: config.resultsPerQuery,
      scrapeOptions: {
        formats: ['markdown'],
        timeout: 30000,
        onlyMainContent: true,
        parsePDF: false,
        waitFor: 2000,
      },
    });

    const results: ResearchSource[] = [];
    let currentIndex = sourceIndexStart;

    if (searchResponse.data && Array.isArray(searchResponse.data)) {
      for (const result of searchResponse.data) {
        const url = result.url || '';

        // Skip duplicates
        if (!url || existingUrls.has(url)) {
          continue;
        }

        const title = result.title || 'Untitled';
        const snippet =
          result.description || (result as any).snippet || '';
        const content = (
          result.markdown ||
          (result as any).content ||
          snippet
        ).substring(0, config.maxContentPerSource);

        const qualityScore = scoreSourceQuality(
          title,
          url,
          content,
          snippet,
        );

        results.push({
          index: currentIndex++,
          title,
          url,
          snippet,
          content,
          areaId,
          query,
          qualityScore,
          contentLength: content.length,
        });

        existingUrls.add(url);
      }
    }

    return {
      query,
      areaId,
      results,
      success: true,
      durationMs: Date.now() - startTime,
    };
  } catch (error) {
    console.error(`[DeepResearch] Search failed for "${query}":`, error);
    return {
      query,
      areaId,
      results: [],
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      durationMs: Date.now() - startTime,
    };
  }
}

// ─── Batch Search Executor ───────────────────────────────────────────────────

export type SearchProgressCallback = (progress: {
  queriesCompleted: number;
  queriesTotal: number;
  sourcesFound: number;
  currentQuery: string;
  currentArea: string;
}) => void;

/**
 * Execute multiple search queries in parallel with concurrency control.
 * Deduplicates results by URL across all queries.
 *
 * @param queries - Array of { query, areaId } to execute
 * @param config - Deep research configuration
 * @param existingUrls - Set of URLs already collected (for deduplication)
 * @param sourceIndexStart - Starting index for source numbering
 * @param onProgress - Callback for progress updates
 * @returns All search results with deduplication applied
 */
export async function executeSearchBatch(
  queries: Array<{ query: string; areaId: string; areaName?: string }>,
  config: DeepResearchConfig,
  existingUrls: Set<string>,
  sourceIndexStart: number,
  onProgress?: SearchProgressCallback,
): Promise<{
  results: SearchBatchResult[];
  allSources: ResearchSource[];
  totalNewSources: number;
}> {
  const limit = createConcurrencyLimiter(config.concurrency);
  let queriesCompleted = 0;
  let currentSourceIndex = sourceIndexStart;
  const allSources: ResearchSource[] = [];

  // Execute all queries with concurrency control
  const batchResults = await Promise.allSettled(
    queries.map((q) =>
      limit(async () => {
        const result = await executeSingleSearch(
          q.query,
          q.areaId,
          config,
          existingUrls,
          currentSourceIndex,
        );

        // Update source index for next query
        currentSourceIndex += result.results.length;

        // Collect sources
        allSources.push(...result.results);

        // Report progress
        queriesCompleted++;
        if (onProgress) {
          onProgress({
            queriesCompleted,
            queriesTotal: queries.length,
            sourcesFound: allSources.length + sourceIndexStart - 1,
            currentQuery: q.query,
            currentArea: q.areaName || q.areaId,
          });
        }

        return result;
      }),
    ),
  );

  // Collect successful results
  const results: SearchBatchResult[] = [];
  for (const settled of batchResults) {
    if (settled.status === 'fulfilled') {
      results.push(settled.value);
    } else {
      console.error('[DeepResearch] Batch search error:', settled.reason);
      results.push({
        query: 'unknown',
        areaId: 'unknown',
        results: [],
        success: false,
        error: String(settled.reason),
        durationMs: 0,
      });
    }
  }

  return {
    results,
    allSources,
    totalNewSources: allSources.length,
  };
}

/**
 * Re-index all sources sequentially starting from 1.
 * Called after all search phases are complete to ensure clean citation numbering.
 */
export function reindexSources(
  sources: ResearchSource[],
): ResearchSource[] {
  // Sort by quality score descending, then by original index
  const sorted = [...sources].sort((a, b) => {
    if (b.qualityScore !== a.qualityScore) {
      return b.qualityScore - a.qualityScore;
    }
    return a.index - b.index;
  });

  // Re-assign indices
  return sorted.map((source, i) => ({
    ...source,
    index: i + 1,
  }));
}
