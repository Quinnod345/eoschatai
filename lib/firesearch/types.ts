/**
 * Shared Firesearch types
 */

export type ResearchDepth = 'quick' | 'standard' | 'deep' | 'comprehensive';

export interface FiresearchConfig {
  firecrawlApiKey: string;
  openaiApiKey: string;
  maxDepth?: number;
  maxSources?: number;
  timeout?: number;
  followUpQuestions?: boolean;
  streaming?: boolean;
}

export interface ResearchQuery {
  query: string;
  context?: string;
  previousQueries?: string[];
  depth?: ResearchDepth | 'standard';
  sessionId?: string;
  // Optional structured filters applied to results
  filters?: Record<
    string,
    string | number | boolean | Array<string | number | boolean>
  >;
  // Enable simple synonym/related-term expansion of the query
  synonymsEnabled?: boolean;
  // Provide explicit synonyms/expansion terms
  synonyms?: string[];
  // Ranking strategy
  ranking?: 'heuristic' | 'ml';
  // Token budget for synthesis
  maxTokens?: number;
  // Target model for synthesis
  model?: string;
}

export interface ResearchSource {
  title: string;
  url: string;
  snippet: string;
  content?: string;
  relevanceScore?: number;
  citationIndex: number;
}

export interface ResearchMetadata {
  totalSources: number;
  searchQueries: string[];
  duration: number; // ms
  depth: ResearchDepth | 'standard';
}

export interface ResearchResult {
  sessionId: string;
  query: string;
  summary: string;
  sources: ResearchSource[];
  followUpQuestions?: string[];
  relatedTopics?: string[];
  references?: Array<{
    number: number;
    title: string;
    url: string;
    snippet?: string;
  }>;
  timestamp: number; // ms
  metadata: ResearchMetadata;
}

export interface ResearchPhase {
  phase: 'planning' | 'searching' | 'analyzing' | 'synthesizing' | 'complete';
  message: string;
  progress: number; // 0-100
  sourcesFound?: number;
  timestamp: number; // ms
}

export type StreamEvent =
  | { type: 'phase'; data: ResearchPhase; timestamp: number }
  | {
      type: 'query';
      data: { queries: string[]; strategy: string };
      timestamp: number;
    }
  | {
      type: 'progress';
      data: {
        currentQuery: string;
        queriesCompleted: number;
        totalQueries: number;
      };
      timestamp: number;
    }
  | { type: 'source'; data: ResearchSource; timestamp: number }
  | { type: 'followup'; data: { questions: string[] }; timestamp: number }
  | { type: 'result'; data: ResearchResult; timestamp: number }
  | {
      type: 'error';
      data: { message: string; code?: string };
      timestamp: number;
    };

export interface ResearchCheckpoint {
  phase: ResearchPhase['phase'];
  timestamp: number;
  data: {
    queries: string[];
    sources: ResearchSource[];
    progress: number; // 0-100
  };
}

export interface ResearchSession {
  id: string;
  userId: string;
  chatId: string;
  status: 'active' | 'completed' | 'error';
  startTime: number;
  lastUpdate: number;
  checkpoints: ResearchCheckpoint[];
  result?: ResearchResult;
}
