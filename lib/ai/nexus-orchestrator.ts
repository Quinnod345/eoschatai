import { generateResearchPlan } from './nexus-ai-planner';
import { executeResearchPlan } from './nexus-search-executor';
import { analyzeStepResults } from './nexus-step-analyzer';
import type { ResearchPlan } from './nexus-ai-planner';
import type { StepAnalysis } from './nexus-step-analyzer';

export interface NexusResearchResult {
  plan: ResearchPlan;
  analyses: StepAnalysis[];
  citations: Array<{
    number: number;
    title: string;
    url: string;
    context: string;
  }>;
  researchContext: string;
}

/**
 * Main orchestrator for the Nexus research mode
 */
export async function runNexusResearch(
  userQuery: string,
  dataStream: any,
): Promise<NexusResearchResult> {
  try {
    console.log('[Nexus Orchestrator] Starting research for:', userQuery);

    // Step 1: Generate Research Plan
    dataStream.writeData({
      type: 'nexus-progress',
      phase: 'planning',
      message: 'Creating research plan...',
    });

    const researchPlan = await generateResearchPlan(userQuery);

    dataStream.writeData({
      type: 'nexus-plan-complete',
      plan: {
        mainObjective: researchPlan.mainObjective,
        steps: researchPlan.steps.map((s) => ({
          number: s.stepNumber,
          title: s.stepTitle,
          questionsCount: s.questions.length,
        })),
        expectedOutcome: researchPlan.expectedOutcome,
      },
    });

    // Step 2: Execute Searches
    dataStream.writeData({
      type: 'nexus-progress',
      phase: 'searching',
      message: 'Conducting web research...',
      plan: {
        mainObjective: researchPlan.mainObjective,
        steps: researchPlan.steps.map((s) => ({
          number: s.stepNumber,
          title: s.stepTitle,
          questionsCount: s.questions.length,
          status: 'pending' as const,
        })),
        expectedOutcome: researchPlan.expectedOutcome,
      },
    });

    // Track current step being searched
    let currentSearchStep = 1;
    let stepQuestionsSearched = 0;

    const searchResults = await executeResearchPlan(
      researchPlan,
      (progress) => {
        // Parse progress to determine current step
        const stepMatch = progress.match(/Step (\d+)\/(\d+)/);
        if (stepMatch) {
          currentSearchStep = Number.parseInt(stepMatch[1]);
          stepQuestionsSearched = 0;
        } else if (progress.startsWith('Searching:')) {
          stepQuestionsSearched++;
        }

        dataStream.writeData({
          type: 'nexus-search-update',
          message: progress,
          currentStep: currentSearchStep,
          questionsSearched: stepQuestionsSearched,
        });
      },
    );

    const totalResults = searchResults.reduce(
      (sum, sr) =>
        sum + sr.searchResults.reduce((s, q) => s + q.results.length, 0),
      0,
    );

    dataStream.writeData({
      type: 'nexus-search-complete',
      totalResults,
      stepsCompleted: searchResults.length,
    });

    // Step 3: Analyze Each Step
    dataStream.writeData({
      type: 'nexus-progress',
      phase: 'analyzing',
      message: 'Analyzing research findings...',
      plan: {
        mainObjective: researchPlan.mainObjective,
        steps: researchPlan.steps.map((s) => ({
          number: s.stepNumber,
          title: s.stepTitle,
          questionsCount: s.questions.length,
          status: 'complete' as const,
        })),
        expectedOutcome: researchPlan.expectedOutcome,
      },
      totalResults,
    });

    const stepAnalyses = [];
    for (const stepResult of searchResults) {
      const analysis = await analyzeStepResults(stepResult);
      stepAnalyses.push(analysis);

      dataStream.writeData({
        type: 'nexus-analysis-update',
        stepNumber: analysis.stepNumber,
        stepTitle: analysis.stepTitle,
        findingsCount: analysis.keyFindings.length,
      });
    }

    // Prepare citations
    const allSources = new Map<string, any>();
    let citationNumber = 1;

    for (const analysis of stepAnalyses) {
      for (const source of analysis.relevantSources) {
        if (!allSources.has(source.url)) {
          allSources.set(source.url, {
            number: citationNumber++,
            title: source.title,
            url: source.url,
            context: source.relevance,
          });
        }
      }
    }

    const citations = Array.from(allSources.values());

    // Build research context for the chat model
    const researchContext = buildResearchContext(
      userQuery,
      researchPlan,
      stepAnalyses,
      citations,
    );

    dataStream.writeData({
      type: 'nexus-progress',
      phase: 'synthesizing',
      message: 'Generating comprehensive response...',
      plan: {
        mainObjective: researchPlan.mainObjective,
        steps: researchPlan.steps.map((s) => ({
          number: s.stepNumber,
          title: s.stepTitle,
          questionsCount: s.questions.length,
          status: 'complete' as const,
        })),
        expectedOutcome: researchPlan.expectedOutcome,
      },
      totalResults,
      citations: citations.length,
    });

    // Send synthesis complete event with citations
    dataStream.writeData({
      type: 'nexus-synthesis-complete',
      citations: citations.map((c) => ({
        number: c.number,
        title: c.title,
        url: c.url,
      })),
    });

    console.log('[Nexus Orchestrator] Research complete, returning context');

    return {
      plan: researchPlan,
      analyses: stepAnalyses,
      citations,
      researchContext,
    };
  } catch (error) {
    console.error('[Nexus Orchestrator] Error:', error);
    dataStream.writeData({
      type: 'nexus-error',
      error: error instanceof Error ? error.message : 'Research failed',
    });
    throw error;
  }
}

/**
 * Build research context for the chat model
 */
function buildResearchContext(
  userQuery: string,
  plan: ResearchPlan,
  analyses: StepAnalysis[],
  citations: any[],
): string {
  let context = `## Nexus Research Results\n\n`;
  context += `**Query:** ${userQuery}\n`;
  context += `**Research Objective:** ${plan.mainObjective}\n\n`;

  // Add step analyses
  context += `### Research Analysis by Step:\n\n`;

  for (const analysis of analyses) {
    context += `#### Step ${analysis.stepNumber}: ${analysis.stepTitle}\n\n`;
    context += `${analysis.analysis}\n\n`;

    if (analysis.keyFindings.length > 0) {
      context += `**Key Findings:**\n`;
      analysis.keyFindings.forEach((finding) => {
        context += `- ${finding}\n`;
      });
      context += '\n';
    }

    if (analysis.relevantSources.length > 0) {
      context += `**Sources Used:**\n`;
      analysis.relevantSources.forEach((source) => {
        const citation = citations.find((c) => c.url === source.url);
        if (citation) {
          context += `- [${citation.number}] ${source.title}\n`;
        }
      });
      context += '\n';
    }
  }

  // Add citations reference
  context += `### Available Citations:\n\n`;
  citations.forEach((c) => {
    context += `[${c.number}] ${c.title} - ${c.url}\n`;
  });

  return context;
}
