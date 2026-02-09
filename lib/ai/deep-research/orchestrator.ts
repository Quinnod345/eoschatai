/**
 * Deep Research System - Orchestrator
 *
 * Server-driven multi-phase research orchestrator.
 * Controls the entire research lifecycle:
 *   Phase 1: Plan Generation (AI call → structured JSON)
 *   Phase 2: Bulk Parallel Search (programmatic, no AI)
 *   Phase 3: Analysis & Gap Detection (AI call → structured JSON)
 *   Phase 4: Follow-up Searches (programmatic)
 *   Phase 5: Synthesis (AI call → streamed long-form report)
 *
 * The orchestrator streams progress events throughout and the final
 * synthesis text at the end.
 */

import { generateText, streamText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import type {
  ResearchPlan,
  ResearchSource,
  ResearchFindings,
  DeepResearchConfig,
  DeepResearchState,
  DeepResearchProgressEvent,
  CitationReference,
  FollowUpQuery,
} from './types';
import { DEFAULT_DEEP_RESEARCH_CONFIG } from './types';
import {
  executeSearchBatch,
  reindexSources,
} from './search-executor';
import {
  planGenerationSystemPrompt,
  buildPlanGenerationUserPrompt,
  analysisSystemPrompt,
  buildAnalysisUserPrompt,
  synthesisSystemPrompt,
  buildSynthesisUserPrompt,
} from './prompts';

// ─── Writer Interface ────────────────────────────────────────────────────────

export interface DeepResearchWriter {
  /** Write a progress event (shown in UI as status indicators) */
  writeProgress(event: DeepResearchProgressEvent): void;
  /** Write a text chunk of the final report (streamed to UI) */
  writeText(text: string): void;
  /** Write citation references for the report */
  writeCitations(citations: CitationReference[]): void;
  /** Signal that the research is complete */
  writeComplete(detail: {
    totalSources: number;
    totalSearches: number;
    totalTimeSeconds: number;
    totalAreas: number;
  }): void;
  /** Signal an error */
  writeError(error: string): void;
}

// ─── JSON Parsing Helpers ────────────────────────────────────────────────────

function extractJSON(text: string): string {
  // Try to find JSON in the response (may be wrapped in markdown code blocks)
  const jsonBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (jsonBlockMatch) {
    return jsonBlockMatch[1].trim();
  }

  // Try to find raw JSON (starts with { and ends with })
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return jsonMatch[0].trim();
  }

  return text.trim();
}

function safeParseJSON<T>(text: string, fallback: T): T {
  try {
    const jsonStr = extractJSON(text);
    return JSON.parse(jsonStr) as T;
  } catch (error) {
    console.error('[DeepResearch] Failed to parse JSON:', error);
    console.error('[DeepResearch] Raw text:', text.substring(0, 500));
    return fallback;
  }
}

// ─── Orchestrator ────────────────────────────────────────────────────────────

export async function runDeepResearch(
  userQuery: string,
  writer: DeepResearchWriter,
  config: DeepResearchConfig = DEFAULT_DEEP_RESEARCH_CONFIG,
): Promise<void> {
  const state: DeepResearchState = {
    phase: 'planning',
    plan: null,
    sources: new Map(),
    nextSourceIndex: 1,
    findings: null,
    totalQueriesExecuted: 0,
    followUpIteration: 0,
    startedAt: Date.now(),
    errors: [],
  };

  const existingUrls = new Set<string>();

  try {
    // ─── Phase 1: Plan Generation ──────────────────────────────────────

    console.log('[DeepResearch] Phase 1: Generating research plan...');
    state.phase = 'planning';
    writer.writeProgress({
      type: 'deep-research-progress',
      phase: 'planning',
      message: 'Generating research plan...',
      overallProgress: 5,
      detail: { phase: 'planning' },
    });

    const plan = await generateResearchPlan(userQuery, config);

    if (!plan || !plan.areas || plan.areas.length === 0) {
      throw new Error('Failed to generate a valid research plan');
    }

    state.plan = plan;

    writer.writeProgress({
      type: 'deep-research-progress',
      phase: 'planning',
      message: `Research plan ready: ${plan.areas.length} areas, ${plan.estimatedSearchCount} searches planned`,
      overallProgress: 10,
      detail: {
        phase: 'planning',
        areasCount: plan.areas.length,
        queriesCount: plan.estimatedSearchCount,
      },
    });

    console.log(
      `[DeepResearch] Plan generated: ${plan.areas.length} areas, ${plan.estimatedSearchCount} queries`,
    );

    // ─── Phase 2: Bulk Parallel Search ─────────────────────────────────

    console.log('[DeepResearch] Phase 2: Executing bulk search...');
    state.phase = 'searching';

    // Collect all queries from the plan
    const allQueries = plan.areas.flatMap((area) =>
      area.queries.map((query) => ({
        query,
        areaId: area.id,
        areaName: area.name,
      })),
    );

    // Cap at maxTotalQueries
    const cappedQueries = allQueries.slice(0, config.maxTotalQueries);

    writer.writeProgress({
      type: 'deep-research-progress',
      phase: 'searching',
      message: `Searching ${cappedQueries.length} queries across ${plan.areas.length} research areas...`,
      overallProgress: 15,
      detail: {
        phase: 'searching',
        queriesCompleted: 0,
        queriesTotal: cappedQueries.length,
        sourcesFound: 0,
      },
    });

    const searchResults = await executeSearchBatch(
      cappedQueries,
      config,
      existingUrls,
      state.nextSourceIndex,
      (progress) => {
        // Calculate overall progress (15-55% range for Phase 2)
        const searchProgress =
          progress.queriesCompleted / progress.queriesTotal;
        const overallProgress = Math.round(15 + searchProgress * 40);

        writer.writeProgress({
          type: 'deep-research-progress',
          phase: 'searching',
          message: `Searching... ${progress.queriesCompleted}/${progress.queriesTotal} queries (${progress.sourcesFound} sources found)`,
          overallProgress,
          detail: {
            phase: 'searching',
            currentQuery: progress.currentQuery,
            queriesCompleted: progress.queriesCompleted,
            queriesTotal: progress.queriesTotal,
            sourcesFound: progress.sourcesFound,
            currentArea: progress.currentArea,
          },
        });
      },
    );

    // Add sources to state
    for (const source of searchResults.allSources) {
      state.sources.set(source.url, source);
    }
    state.nextSourceIndex += searchResults.totalNewSources;
    state.totalQueriesExecuted += cappedQueries.length;

    const failedSearches = searchResults.results.filter((r) => !r.success);
    if (failedSearches.length > 0) {
      console.warn(
        `[DeepResearch] ${failedSearches.length}/${searchResults.results.length} searches failed`,
      );
    }

    console.log(
      `[DeepResearch] Phase 2 complete: ${state.sources.size} unique sources from ${cappedQueries.length} queries`,
    );

    // ─── Phase 3: Analysis & Gap Detection ─────────────────────────────

    console.log('[DeepResearch] Phase 3: Analyzing findings...');
    state.phase = 'analyzing';

    writer.writeProgress({
      type: 'deep-research-progress',
      phase: 'analyzing',
      message: `Analyzing ${state.sources.size} sources across ${plan.areas.length} research areas...`,
      overallProgress: 58,
      detail: {
        phase: 'analyzing',
        areasAnalyzed: 0,
        areasTotal: plan.areas.length,
        gapsFound: 0,
        followUpQueriesGenerated: 0,
      },
    });

    const findings = await analyzeFindings(
      plan,
      Array.from(state.sources.values()),
      config,
    );

    state.findings = findings;

    writer.writeProgress({
      type: 'deep-research-progress',
      phase: 'analyzing',
      message: `Analysis complete: ${findings.gaps.length} gaps identified, ${findings.followUpQueries.length} follow-up queries`,
      overallProgress: 65,
      detail: {
        phase: 'analyzing',
        areasAnalyzed: plan.areas.length,
        areasTotal: plan.areas.length,
        gapsFound: findings.gaps.length,
        followUpQueriesGenerated: findings.followUpQueries.length,
      },
    });

    console.log(
      `[DeepResearch] Phase 3 complete: ${findings.gaps.length} gaps, ${findings.followUpQueries.length} follow-ups`,
    );

    // ─── Phase 4: Follow-up Searches ───────────────────────────────────

    if (
      findings.followUpQueries.length > 0 &&
      state.followUpIteration < config.maxFollowUpIterations
    ) {
      console.log('[DeepResearch] Phase 4: Executing follow-up searches...');
      state.phase = 'follow-up-searching';

      // May iterate up to maxFollowUpIterations times
      let currentFollowUps: FollowUpQuery[] = findings.followUpQueries;

      while (
        currentFollowUps.length > 0 &&
        state.followUpIteration < config.maxFollowUpIterations &&
        state.totalQueriesExecuted < config.maxTotalQueries
      ) {
        state.followUpIteration++;

        const remainingBudget =
          config.maxTotalQueries - state.totalQueriesExecuted;
        const followUpBatch = currentFollowUps.slice(
          0,
          Math.min(currentFollowUps.length, remainingBudget),
        );

        writer.writeProgress({
          type: 'deep-research-progress',
          phase: 'follow-up-searching',
          message: `Follow-up round ${state.followUpIteration}: searching ${followUpBatch.length} targeted queries...`,
          overallProgress: 68 + state.followUpIteration * 5,
          detail: {
            phase: 'follow-up-searching',
            queriesCompleted: 0,
            queriesTotal: followUpBatch.length,
            sourcesFound: state.sources.size,
          },
        });

        const followUpResults = await executeSearchBatch(
          followUpBatch.map((fq) => ({
            query: fq.query,
            areaId: fq.areaId,
            areaName:
              plan.areas.find((a) => a.id === fq.areaId)?.name || fq.areaId,
          })),
          config,
          existingUrls,
          state.nextSourceIndex,
          (progress) => {
            writer.writeProgress({
              type: 'deep-research-progress',
              phase: 'follow-up-searching',
              message: `Follow-up ${state.followUpIteration}: ${progress.queriesCompleted}/${progress.queriesTotal} (${progress.sourcesFound} total sources)`,
              overallProgress:
                68 +
                state.followUpIteration * 5 +
                Math.round(
                  (progress.queriesCompleted / progress.queriesTotal) * 4,
                ),
              detail: {
                phase: 'follow-up-searching',
                currentQuery: progress.currentQuery,
                queriesCompleted: progress.queriesCompleted,
                queriesTotal: progress.queriesTotal,
                sourcesFound: progress.sourcesFound,
                currentArea: progress.currentArea,
              },
            });
          },
        );

        // Add new sources
        for (const source of followUpResults.allSources) {
          state.sources.set(source.url, source);
        }
        state.nextSourceIndex += followUpResults.totalNewSources;
        state.totalQueriesExecuted += followUpBatch.length;

        console.log(
          `[DeepResearch] Follow-up round ${state.followUpIteration}: ${followUpResults.totalNewSources} new sources (${state.sources.size} total)`,
        );

        // If we still have budget and this is not the last iteration,
        // do a quick re-analysis to see if more follow-ups are needed
        if (
          state.followUpIteration < config.maxFollowUpIterations &&
          state.totalQueriesExecuted < config.maxTotalQueries
        ) {
          const reAnalysis = await analyzeFindings(
            plan,
            Array.from(state.sources.values()),
            config,
          );
          state.findings = reAnalysis;

          // Only continue if there are critical or important gaps
          const significantGaps = reAnalysis.gaps.filter(
            (g) => g.severity === 'critical' || g.severity === 'important',
          );
          if (significantGaps.length === 0 || reAnalysis.followUpQueries.length === 0) {
            console.log(
              '[DeepResearch] No significant gaps remaining, skipping further follow-ups',
            );
            break;
          }

          currentFollowUps = reAnalysis.followUpQueries;
        } else {
          break;
        }
      }
    }

    console.log(
      `[DeepResearch] Search phases complete: ${state.sources.size} total sources, ${state.totalQueriesExecuted} total queries`,
    );

    // ─── Phase 5: Synthesis ────────────────────────────────────────────

    console.log('[DeepResearch] Phase 5: Synthesizing report...');
    state.phase = 'synthesizing';

    // Re-index sources for clean citation numbering
    const allSourcesArray = reindexSources(
      Array.from(state.sources.values()),
    );

    writer.writeProgress({
      type: 'deep-research-progress',
      phase: 'synthesizing',
      message: `Generating comprehensive report from ${allSourcesArray.length} sources...`,
      overallProgress: 80,
      detail: {
        phase: 'synthesizing',
        totalSources: allSourcesArray.length,
        totalAreas: plan.areas.length,
      },
    });

    // Write citations
    const citations: CitationReference[] = allSourcesArray.map((s) => ({
      index: s.index,
      url: s.url,
      title: s.title,
    }));
    writer.writeCitations(citations);

    // Stream the synthesis
    await synthesizeReport(
      plan,
      state.findings as ResearchFindings,
      allSourcesArray,
      config,
      (text) => writer.writeText(text),
    );

    // ─── Complete ──────────────────────────────────────────────────────

    const totalTimeSeconds = Math.round(
      (Date.now() - state.startedAt) / 1000,
    );

    writer.writeComplete({
      totalSources: allSourcesArray.length,
      totalSearches: state.totalQueriesExecuted,
      totalTimeSeconds,
      totalAreas: plan.areas.length,
    });

    console.log(
      `[DeepResearch] Complete: ${allSourcesArray.length} sources, ${state.totalQueriesExecuted} searches, ${totalTimeSeconds}s`,
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    console.error('[DeepResearch] Fatal error:', errorMessage);
    writer.writeError(errorMessage);
  }
}

// ─── Phase 1: Plan Generation ────────────────────────────────────────────────

async function generateResearchPlan(
  userQuery: string,
  config: DeepResearchConfig,
): Promise<ResearchPlan> {
  const { text } = await generateText({
    model: anthropic(config.planningModel),
    system: planGenerationSystemPrompt,
    prompt: buildPlanGenerationUserPrompt(userQuery),
    maxOutputTokens: 4096,
    temperature: 0.3,
  });

  const plan = safeParseJSON<ResearchPlan>(text, {
    objective: userQuery,
    areas: [
      {
        id: 'area-1',
        name: 'General Research',
        description: `Research about: ${userQuery}`,
        queries: [userQuery, `${userQuery} latest 2025`, `${userQuery} analysis`],
        priority: 1,
      },
    ],
    estimatedSearchCount: 3,
    estimatedTimeSeconds: 30,
  });

  // Ensure all areas have valid IDs
  plan.areas = plan.areas.map((area, i) => ({
    ...area,
    id: area.id || `area-${i + 1}`,
    queries: area.queries || [],
    priority: area.priority || i + 1,
  }));

  // Recalculate search count
  plan.estimatedSearchCount = plan.areas.reduce(
    (sum, a) => sum + a.queries.length,
    0,
  );

  return plan;
}

// ─── Phase 3: Analysis & Gap Detection ───────────────────────────────────────

async function analyzeFindings(
  plan: ResearchPlan,
  sources: ResearchSource[],
  config: DeepResearchConfig,
): Promise<ResearchFindings> {
  const totalSourceCount = sources.length;
  const areaCount = plan.areas.length;

  // Budget: aim for ~120K tokens total prompt (~480K chars).
  // Reserve ~20K chars for system prompt, area headers, boilerplate.
  // Remaining ~460K chars split across all sources.
  const MAX_ANALYSIS_CHARS = 460000;

  // Determine how many sources per area and content length per source
  // so we stay well within the context window.
  const maxSourcesPerArea = Math.min(
    15,
    Math.max(5, Math.floor(120 / areaCount)),
  );

  // Group sources by area (top quality first)
  const sourcesByAreaRaw = plan.areas.map((area) => {
    const areaSources = sources
      .filter((s) => s.areaId === area.id)
      .sort((a, b) => b.qualityScore - a.qualityScore)
      .slice(0, maxSourcesPerArea);
    return { areaId: area.id, areaName: area.name, sources: areaSources };
  });

  const totalSourcesForAnalysis = sourcesByAreaRaw.reduce(
    (sum, a) => sum + a.sources.length,
    0,
  );

  // Dynamically size content preview to stay within budget
  const contentPreviewLength = Math.min(
    1500,
    Math.max(300, Math.floor(MAX_ANALYSIS_CHARS / Math.max(totalSourcesForAnalysis, 1))),
  );

  const sourcesByArea = sourcesByAreaRaw.map((area) => ({
    areaId: area.areaId,
    areaName: area.areaName,
    sources: area.sources.map((s) => ({
      index: s.index,
      title: s.title,
      url: s.url,
      snippet: s.snippet,
      contentPreview: s.content.substring(0, contentPreviewLength),
    })),
  }));

  const userPrompt = buildAnalysisUserPrompt(plan.objective, sourcesByArea);

  const estimatedTokens = Math.ceil((userPrompt.length + analysisSystemPrompt.length) / 4);
  console.log(
    `[DeepResearch] Analyzing ${totalSourcesForAnalysis}/${totalSourceCount} sources across ${sourcesByArea.length} areas (${contentPreviewLength} chars/source, ~${estimatedTokens} est. tokens)`,
  );

  // Safety check: if still too large, warn but proceed (API will reject if truly over)
  if (estimatedTokens > 180000) {
    console.warn(
      `[DeepResearch] Analysis prompt may be too large (~${estimatedTokens} tokens). Consider reducing source count.`,
    );
  }

  const { text } = await generateText({
    model: anthropic(config.planningModel),
    system: analysisSystemPrompt,
    prompt: userPrompt,
    maxOutputTokens: 8192,
    temperature: 0.2,
  });

  const findings = safeParseJSON<ResearchFindings>(text, {
    areaSummaries: plan.areas.map((area) => ({
      areaId: area.id,
      areaName: area.name,
      keyFindings: ['Research data collected but analysis failed to parse'],
      sourceIndices: [],
      confidence: 'low' as const,
      coverageLevel: 'partial' as const,
    })),
    crossCuttingThemes: [],
    conflicts: [],
    gaps: [],
    followUpQueries: [],
  });

  // Validate and cap follow-up queries
  if (findings.followUpQueries) {
    findings.followUpQueries = findings.followUpQueries.slice(0, 15);
  }

  return findings;
}

// ─── Phase 5: Synthesis ──────────────────────────────────────────────────────

async function synthesizeReport(
  plan: ResearchPlan,
  findings: ResearchFindings,
  sources: ResearchSource[],
  config: DeepResearchConfig,
  onTextChunk: (text: string) => void,
): Promise<void> {
  // Prepare sources for the synthesis prompt
  // Limit content per source to fit in context window
  // With 200 sources at 3000 chars each = ~600K chars ≈ ~150K tokens
  // We need to be strategic about how much content to include

  // Budget: Claude's context is 200K tokens (~800K chars).
  // Reserve ~42K tokens for output (32K) + thinking (10K). That leaves ~158K tokens (~632K chars) for input.
  // Reserve ~40K chars for system prompt, plan overview, findings summary.
  // Remaining ~400K chars for source content (conservative to avoid timeouts).
  const MAX_SYNTHESIS_INPUT_CHARS = 400000;
  const maxSourcesForSynthesis = Math.min(100, sources.length);
  const topSources = sources.slice(0, maxSourcesForSynthesis);

  // Dynamically adjust content length based on source count
  const contentBudgetPerSource = Math.min(
    config.maxContentPerSource,
    Math.max(500, Math.floor(MAX_SYNTHESIS_INPUT_CHARS / topSources.length)),
  );

  const synthesisSourceData = topSources.map((s) => ({
    index: s.index,
    title: s.title,
    url: s.url,
    snippet: s.snippet,
    content: s.content.substring(0, contentBudgetPerSource),
    areaId: s.areaId,
  }));

  const userPrompt = buildSynthesisUserPrompt(
    plan.objective,
    plan,
    findings,
    synthesisSourceData,
  );

  const estimatedTokens = Math.ceil((userPrompt.length + synthesisSystemPrompt.length) / 4);
  console.log(
    `[DeepResearch] Synthesis: ${topSources.length} sources, ${contentBudgetPerSource} chars/source, prompt ${Math.round(userPrompt.length / 1024)}KB (~${estimatedTokens} tokens)`,
  );

  // When extended thinking is enabled, Claude requires temperature to be undefined
  const result = streamText({
    model: anthropic(config.synthesisModel),
    system: synthesisSystemPrompt,
    prompt: userPrompt,
    maxOutputTokens: config.maxSynthesisTokens,
    temperature: config.enableThinkingForSynthesis ? undefined : 0.4,
    ...(config.enableThinkingForSynthesis
      ? {
          providerOptions: {
            anthropic: {
              thinking: {
                type: 'enabled' as const,
                budgetTokens: config.thinkingBudget,
              },
            },
          },
        }
      : {}),
  });

  // Stream the text chunks to the writer
  for await (const chunk of result.textStream) {
    onTextChunk(chunk);
  }
}
