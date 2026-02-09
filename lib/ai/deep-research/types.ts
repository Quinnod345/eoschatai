/**
 * Deep Research System - Type Definitions
 *
 * Multi-phase deep research orchestrator types for the Nexus research mode.
 */

// ─── Research Plan (Phase 1 output) ───────────────────────────────────────────

export interface ResearchPlan {
  /** High-level objective of the research */
  objective: string;
  /** 6-10 research areas to investigate */
  areas: ResearchArea[];
  /** Estimated total number of searches */
  estimatedSearchCount: number;
  /** Estimated total time in seconds */
  estimatedTimeSeconds: number;
}

export interface ResearchArea {
  /** Unique ID for this area (e.g., "area-1") */
  id: string;
  /** Name of the research area (e.g., "Market Analysis") */
  name: string;
  /** Brief description of what to investigate */
  description: string;
  /** 3-5 specific search queries for this area */
  queries: string[];
  /** Priority order (1 = highest) */
  priority: number;
}

// ─── Search Results (Phase 2 output) ──────────────────────────────────────────

export interface ResearchSource {
  /** Globally unique index across all searches (1-based for citations) */
  index: number;
  /** Page title */
  title: string;
  /** Source URL */
  url: string;
  /** Short description / snippet */
  snippet: string;
  /** Full extracted content (markdown) */
  content: string;
  /** Which research area this source is associated with */
  areaId: string;
  /** The query that found this source */
  query: string;
  /** Quality score (0-1) based on content length, domain, relevance */
  qualityScore: number;
  /** Content length in characters */
  contentLength: number;
}

export interface SearchBatchResult {
  /** The query that was executed */
  query: string;
  /** Which research area this query belongs to */
  areaId: string;
  /** Results returned by the search */
  results: ResearchSource[];
  /** Whether the search succeeded */
  success: boolean;
  /** Error message if search failed */
  error?: string;
  /** Time taken in ms */
  durationMs: number;
}

// ─── Analysis & Gap Detection (Phase 3 output) ───────────────────────────────

export interface ResearchFindings {
  /** Per-area summaries of what was found */
  areaSummaries: AreaSummary[];
  /** Cross-cutting themes identified */
  crossCuttingThemes: string[];
  /** Conflicting information found */
  conflicts: ConflictInfo[];
  /** Gaps that need follow-up research */
  gaps: ResearchGap[];
  /** Follow-up queries to fill gaps */
  followUpQueries: FollowUpQuery[];
}

export interface AreaSummary {
  /** Area ID */
  areaId: string;
  /** Area name */
  areaName: string;
  /** Key findings as bullet points */
  keyFindings: string[];
  /** Source indices referenced */
  sourceIndices: number[];
  /** Confidence level in findings */
  confidence: 'high' | 'medium' | 'low';
  /** Coverage completeness */
  coverageLevel: 'comprehensive' | 'adequate' | 'partial' | 'insufficient';
}

export interface ConflictInfo {
  /** What the conflict is about */
  topic: string;
  /** Different claims/positions */
  positions: string[];
  /** Source indices for each position */
  sourceIndices: number[][];
}

export interface ResearchGap {
  /** What information is missing */
  description: string;
  /** Which area this gap belongs to */
  areaId: string;
  /** How critical this gap is */
  severity: 'critical' | 'important' | 'minor';
}

export interface FollowUpQuery {
  /** The search query to execute */
  query: string;
  /** Which area this fills a gap for */
  areaId: string;
  /** Why this query is needed */
  rationale: string;
}

// ─── Orchestrator Configuration ──────────────────────────────────────────────

export interface DeepResearchConfig {
  /** Max concurrent Firecrawl searches */
  concurrency: number;
  /** Results per search query */
  resultsPerQuery: number;
  /** Max content chars to keep per source */
  maxContentPerSource: number;
  /** Max total queries (initial + follow-up) */
  maxTotalQueries: number;
  /** Max follow-up iterations (Phase 3 -> Phase 4 loops) */
  maxFollowUpIterations: number;
  /** Max output tokens for the final synthesis */
  maxSynthesisTokens: number;
  /** Model to use for plan generation and analysis */
  planningModel: string;
  /** Model to use for final synthesis */
  synthesisModel: string;
  /** Whether to enable extended thinking for synthesis */
  enableThinkingForSynthesis: boolean;
  /** Thinking budget tokens if extended thinking is enabled */
  thinkingBudget: number;
}

export const DEFAULT_DEEP_RESEARCH_CONFIG: DeepResearchConfig = {
  concurrency: 5,
  resultsPerQuery: 10,
  maxContentPerSource: 6000,
  maxTotalQueries: 40,
  maxFollowUpIterations: 1,
  maxSynthesisTokens: 32000,
  planningModel: 'claude-sonnet-4-5-20250929',
  synthesisModel: 'claude-sonnet-4-5-20250929',
  enableThinkingForSynthesis: true,
  thinkingBudget: 10000,
};

// ─── Progress Events (streamed to UI) ────────────────────────────────────────

export type DeepResearchPhase =
  | 'planning'
  | 'searching'
  | 'analyzing'
  | 'follow-up-searching'
  | 'synthesizing'
  | 'complete'
  | 'error';

export interface DeepResearchProgressEvent {
  type: 'deep-research-progress';
  phase: DeepResearchPhase;
  /** Human-readable status message */
  message: string;
  /** Overall progress (0-100) */
  overallProgress: number;
  /** Details depending on the phase */
  detail:
    | PlanningDetail
    | SearchingDetail
    | AnalyzingDetail
    | SynthesizingDetail
    | CompleteDetail
    | ErrorDetail;
}

export interface PlanningDetail {
  phase: 'planning';
  /** Research areas identified so far */
  areasCount?: number;
  /** Total queries planned */
  queriesCount?: number;
}

export interface SearchingDetail {
  phase: 'searching' | 'follow-up-searching';
  /** Current query being executed */
  currentQuery?: string;
  /** Number of queries completed so far */
  queriesCompleted: number;
  /** Total queries to execute in this phase */
  queriesTotal: number;
  /** Total unique sources found so far */
  sourcesFound: number;
  /** Current research area being searched */
  currentArea?: string;
}

export interface AnalyzingDetail {
  phase: 'analyzing';
  /** Current area being analyzed */
  currentArea?: string;
  /** Areas analyzed so far */
  areasAnalyzed: number;
  /** Total areas to analyze */
  areasTotal: number;
  /** Gaps identified so far */
  gapsFound: number;
  /** Follow-up queries generated */
  followUpQueriesGenerated: number;
}

export interface SynthesizingDetail {
  phase: 'synthesizing';
  /** Total sources being synthesized */
  totalSources: number;
  /** Total research areas */
  totalAreas: number;
}

export interface CompleteDetail {
  phase: 'complete';
  /** Total unique sources used in the report */
  totalSources: number;
  /** Total searches performed */
  totalSearches: number;
  /** Total time taken in seconds */
  totalTimeSeconds: number;
  /** Total research areas covered */
  totalAreas: number;
}

export interface ErrorDetail {
  phase: 'error';
  /** Error message */
  error: string;
}

// ─── Orchestrator State ──────────────────────────────────────────────────────

export interface DeepResearchState {
  /** Current phase */
  phase: DeepResearchPhase;
  /** The research plan (set after Phase 1) */
  plan: ResearchPlan | null;
  /** All collected sources (deduplicated) */
  sources: Map<string, ResearchSource>;
  /** Source index counter */
  nextSourceIndex: number;
  /** Analysis findings (set after Phase 3) */
  findings: ResearchFindings | null;
  /** Total queries executed */
  totalQueriesExecuted: number;
  /** Follow-up iteration count */
  followUpIteration: number;
  /** Start timestamp */
  startedAt: number;
  /** Errors encountered */
  errors: string[];
}

// ─── Citation format for the final report ────────────────────────────────────

export interface CitationReference {
  /** 1-based index used in the report text */
  index: number;
  /** Source URL */
  url: string;
  /** Source title */
  title: string;
}
