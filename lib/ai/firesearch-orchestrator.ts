/**
 * Firesearch Orchestrator
 * Replaces the old Nexus orchestrator with Firesearch integration
 */

import { getFiresearchService } from '@/lib/firesearch';
import type { ResearchResult, ResearchSource } from '@/lib/firesearch/types';
import type { DataStreamWriter } from 'ai';

export interface FiresearchResult {
  citations: Array<{
    number: number;
    title: string;
    url: string;
    snippet: string;
  }>;
  results: any[];
  researchContext: string;
}

/**
 * Run Firesearch deep research
 */
export async function runFiresearchResearch(
  userQuery: string,
  dataStream: DataStreamWriter,
): Promise<FiresearchResult> {
  console.log(
    '[Firesearch Orchestrator] Starting deep research for:',
    userQuery,
  );

  const firesearch = getFiresearchService();
  const startTime = Date.now();

  let researchResult: ResearchResult | null = null;
  const citations: Array<{
    number: number;
    title: string;
    url: string;
    snippet: string;
  }> = [];

  try {
    // Create research stream with high token budget for deep research
    const researchStream = firesearch.research({
      query: userQuery,
      depth: 'comprehensive',
      synonymsEnabled: true,
      ranking: 'ml',
      maxTokens: 6000,
    });

    // Process stream events
    for await (const event of researchStream) {
      switch (event.type) {
        case 'phase':
          dataStream.writeData({
            type: 'nexus-phase',
            phase: event.data.phase,
            message: event.data.message,
            progress: event.data.progress,
            startTime,
          });
          break;

        case 'query':
          // Emit Firesearch-style query list for UI
          dataStream.writeData({
            type: 'nexus-query',
            queries: event.data.queries,
            strategy: event.data.strategy,
          });
          break;

        case 'progress':
          dataStream.writeData({
            type: 'nexus-progress',
            currentQuery: event.data.currentQuery,
            queriesCompleted: event.data.queriesCompleted,
            totalQueries: event.data.totalQueries,
            phase: 'searching',
            startTime,
          });
          break;

        case 'source': {
          const source = event.data as ResearchSource;
          citations.push({
            number: source.citationIndex,
            title: source.title,
            url: source.url,
            snippet: source.snippet,
          });
          // Forward source for UI grouping by current query
          dataStream.writeData({
            type: 'nexus-source',
            data: {
              source: {
                title: source.title,
                url: source.url,
                snippet: source.snippet || '',
                content: source.content || '',
                citationIndex: source.citationIndex,
                relevanceScore: source.relevanceScore || 0,
              },
            },
          });
          break;
        }

        case 'followup':
          dataStream.writeData({
            type: 'nexus-followup-questions',
            questions: event.data.questions,
          });
          break;

        case 'result':
          researchResult = event.data as ResearchResult;
          break;

        case 'error':
          console.error('[Firesearch Orchestrator] Error:', event.data);
          dataStream.writeData({
            type: 'nexus-error',
            error: event.data.message,
            code: event.data.code || 'UNKNOWN_ERROR',
          });
          throw new Error(event.data.message);
      }
    }

    if (!researchResult) {
      throw new Error('No research result received');
    }

    // Format research context for AI
    const researchContext = formatResearchContext(researchResult);

    // Send completion event
    dataStream.writeData({
      type: 'nexus-search-complete',
      results: researchResult.sources.map((source) => ({
        title: source.title,
        url: source.url,
        snippet: source.snippet,
        content: source.content || source.snippet,
        citationNumber: source.citationIndex,
        usedInResponse: true,
        relevanceToQuery: source.relevanceScore || 0.5,
      })),
      citations,
      researchContext,
      totalSearches: researchResult.metadata.searchQueries.length,
      phase: 'complete',
      startTime,
      sourcesFound: researchResult.sources.length,
      followUpQuestions: researchResult.followUpQuestions || [],
    });

    const duration = Date.now() - startTime;
    console.log(
      '[Firesearch Orchestrator] Research completed in',
      duration,
      'ms',
    );

    return {
      citations,
      results: researchResult.sources,
      researchContext,
    };
  } catch (error) {
    console.error('[Firesearch Orchestrator] Fatal error:', error);

    dataStream.writeData({
      type: 'nexus-error',
      error: error instanceof Error ? error.message : 'Research failed',
      phase: 'error',
    });

    // Return minimal result on error
    return {
      citations: [],
      results: [],
      researchContext: `
# Research Error

An error occurred during the research process: ${error instanceof Error ? error.message : 'Unknown error'}

Please try rephrasing your query or try again later.
`,
    };
  }
}

/**
 * Format research context for AI consumption
 */
function formatResearchContext(result: ResearchResult): string {
  // The synthesis already contains a comprehensive ~45k token research report
  // with dense citations, references section, and all necessary formatting.
  // We pass it through directly to preserve the full depth of research.
  return result.summary;
}
