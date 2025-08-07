import FirecrawlApp from '@mendable/firecrawl-js';
import type { ResearchPlan, ResearchStep } from './nexus-ai-planner';

export interface SearchResult {
  question: string;
  results: Array<{
    title: string;
    url: string;
    snippet: string;
    content: string;
  }>;
}

export interface StepResults {
  step: ResearchStep;
  searchResults: SearchResult[];
}

/**
 * Execute searches for a research plan using Firecrawl
 */
export async function executeResearchPlan(
  plan: ResearchPlan,
  onProgress?: (message: string) => void,
): Promise<StepResults[]> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    throw new Error('Firecrawl API key not configured');
  }

  const app = new FirecrawlApp({ apiKey });
  const allStepResults: StepResults[] = [];

  console.log('[Nexus Executor] Starting research plan execution');
  onProgress?.(`Starting research: ${plan.mainObjective}`);

  // Process each step
  for (const step of plan.steps) {
    console.log(
      `[Nexus Executor] Processing step ${step.stepNumber}: ${step.stepTitle}`,
    );
    onProgress?.(
      `Step ${step.stepNumber}/${plan.steps.length}: ${step.stepTitle}`,
    );

    const stepSearchResults: SearchResult[] = [];
    let questionsSearched = 0;

    // Process each question in the step
    for (const question of step.questions) {
      console.log(`[Nexus Executor] Searching for: "${question.searchQuery}"`);
      onProgress?.(`Searching: ${question.question}`);

      try {
        // Use Firecrawl search API
        const searchResponse = await app.search(question.searchQuery, {
          limit: 5, // 5 results per question
          scrapeOptions: {
            formats: ['markdown'],
            onlyMainContent: true,
          },
        });

        const results =
          searchResponse.data?.map((result: any) => ({
            title: result.metadata?.title || 'Untitled',
            url: result.metadata?.sourceURL || result.url || '',
            snippet: result.metadata?.description || '',
            content: result.markdown || '',
          })) || [];

        stepSearchResults.push({
          question: question.question,
          results,
        });

        console.log(
          `[Nexus Executor] Found ${results.length} results for question`,
        );
      } catch (error) {
        console.error(
          `[Nexus Executor] Search error for "${question.question}":`,
          error,
        );
        // Continue with empty results for this question
        stepSearchResults.push({
          question: question.question,
          results: [],
        });
      }
    }

    allStepResults.push({
      step,
      searchResults: stepSearchResults,
    });
  }

  console.log('[Nexus Executor] Research plan execution complete');
  return allStepResults;
}
