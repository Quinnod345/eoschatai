/**
 * Firesearch Service Integration
 * Main service wrapper for Firesearch deep research functionality
 */

import type {
  FiresearchConfig,
  ResearchQuery,
  ResearchResult,
  ResearchPhase,
  StreamEvent,
  ResearchSource,
  ResearchCheckpoint,
} from './types';
import FirecrawlApp from '@mendable/firecrawl-js';
import { OpenAI } from 'openai';
import Anthropic from '@anthropic-ai/sdk';

function safeJsonParse<T>(
  value: string | null | undefined,
  fallback: T,
  context: string,
): T {
  if (!value) {
    return fallback;
  }
  try {
    const parsed = JSON.parse(value) as T;
    if (parsed === null || parsed === undefined) {
      return fallback;
    }
    return parsed;
  } catch (error) {
    console.warn(`[FiresearchService] Failed to parse ${context}`, error);
    return fallback;
  }
}

function sanitizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item.length > 0);
}

export class FiresearchService {
  private firecrawl: FirecrawlApp;
  private openai: OpenAI;
  private anthropic: Anthropic;
  private config: FiresearchConfig;

  constructor(config: FiresearchConfig) {
    this.config = config;
    this.firecrawl = new FirecrawlApp({
      apiKey: config.firecrawlApiKey,
    });
    this.openai = new OpenAI({
      apiKey: config.openaiApiKey,
    });
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  /**
   * Execute deep research with streaming updates
   */
  async *research(
    query: ResearchQuery,
  ): AsyncGenerator<StreamEvent, ResearchResult, unknown> {
    const sessionId = query.sessionId || this.generateSessionId();
    const startTime = Date.now();
    const sources: ResearchSource[] = [];
    const searchQueries: string[] = [];

    try {
      // Phase 1: Planning
      yield this.createEvent('phase', {
        phase: 'planning',
        message: 'Analyzing your query and creating research strategy...',
        progress: 0,
        timestamp: Date.now(),
      } as ResearchPhase);

      // Expand query with synonyms if requested
      const expandedQuery = this.expandQueryWithSynonyms(query);

      const researchPlan = await this.generateResearchPlan({
        ...query,
        query: expandedQuery,
      });
      searchQueries.push(...researchPlan.queries);

      yield this.createEvent('query', {
        queries: searchQueries,
        strategy: researchPlan.strategy,
      });

      // Phase 2: Searching
      yield this.createEvent('phase', {
        phase: 'searching',
        message: `Executing ${searchQueries.length} targeted searches...`,
        progress: 20,
        timestamp: Date.now(),
      } as ResearchPhase);

      let searchProgress = 0;
      for (const searchQuery of searchQueries) {
        yield this.createEvent('progress', {
          currentQuery: searchQuery,
          queriesCompleted: searchProgress,
          totalQueries: searchQueries.length,
        });

        let results = await this.executeSearch(searchQuery);

        // Apply filters if provided
        if (query.filters && Object.keys(query.filters).length > 0) {
          results = this.applyFilters(results, query.filters);
        }

        // Apply ranking
        results =
          query.ranking === 'ml'
            ? await this.applyMlRanking(searchQuery, results)
            : this.applyHeuristicRanking(searchQuery, results);

        sources.push(...results);

        // Yield each source as it's found
        for (const source of results) {
          yield this.createEvent('source', source);
        }

        searchProgress++;
      }

      // Phase 3: Analyzing
      yield this.createEvent('phase', {
        phase: 'analyzing',
        message: 'Analyzing and validating information...',
        progress: 60,
        sourcesFound: sources.length,
        timestamp: Date.now(),
      } as ResearchPhase);

      const analysis = await this.analyzeResults(query.query, sources);

      // Phase 4: Synthesizing
      yield this.createEvent('phase', {
        phase: 'synthesizing',
        message: 'Generating comprehensive research report...',
        progress: 80,
        timestamp: Date.now(),
      } as ResearchPhase);

      const synthesis = await this.synthesizeResults(
        query.query,
        sources,
        analysis,
        query.maxOutputTokens || 8000,
        query.model || 'gpt-4o',
      );

      // Generate follow-up questions if enabled
      let followUpQuestions: string[] = [];
      if (this.config.followUpQuestions !== false) {
        followUpQuestions = await this.generateFollowUpQuestions(
          query.query,
          synthesis.summary,
        );

        yield this.createEvent('followup', {
          questions: followUpQuestions,
        });
      }

      // Complete
      yield this.createEvent('phase', {
        phase: 'complete',
        message: 'Research completed successfully',
        progress: 100,
        timestamp: Date.now(),
      } as ResearchPhase);

      // Return final result
      const result: ResearchResult = {
        sessionId,
        query: query.query,
        summary: synthesis.summary,
        sources, // Include ALL sources, not just first 20
        followUpQuestions,
        relatedTopics: synthesis.relatedTopics,
        references: synthesis.references, // Include references from synthesis
        timestamp: Date.now(),
        metadata: {
          totalSources: sources.length,
          searchQueries,
          duration: Date.now() - startTime,
          depth: query.depth || 'standard',
        },
      };
      // Yield the result as an event for the orchestrator
      yield this.createEvent('result', result);

      return result;
    } catch (error) {
      yield this.createEvent('error', {
        message: error instanceof Error ? error.message : 'Unknown error',
        code: 'RESEARCH_ERROR',
      });
      throw error;
    }
  }

  /**
   * Generate research plan with intelligent query decomposition
   */
  private async generateResearchPlan(query: ResearchQuery): Promise<{
    queries: string[];
    strategy: string;
  }> {
    // Determine number of queries based on depth
    const depthConfig = {
      quick: { min: 2, max: 4 },
      standard: { min: 4, max: 8 },
      deep: { min: 10, max: 20 },
      comprehensive: { min: 20, max: 30 },
    };
    const depth = query.depth || 'comprehensive';
    const queryRange =
      depthConfig[depth as keyof typeof depthConfig] ||
      depthConfig.comprehensive;

    const prompt = `
You are an expert research planning assistant. Create a comprehensive research strategy.

USER QUERY: ${query.query}
${query.context ? `CONTEXT: ${query.context}` : ''}
${query.previousQueries ? `PREVIOUS SEARCHES: ${query.previousQueries.join(', ')}` : ''}

GENERATE ${queryRange.min}-${queryRange.max} SPECIFIC SEARCH QUERIES that will:
1. Cover ALL aspects of the user's question
2. Explore different angles and perspectives
3. Find supporting evidence and examples
4. Investigate contradicting viewpoints
5. Discover related concepts and implications
6. Research historical context and future trends
7. Find expert opinions and authoritative sources
8. Uncover data, statistics, and case studies

Be EXTREMELY thorough. Each query should target specific information needed for a comprehensive ${depth} research report.

Return your response in JSON format:
{
  "queries": [
    "specific search query 1",
    "specific search query 2",
    ... (generate ${queryRange.min}-${queryRange.max} queries)
  ],
  "strategy": "Detailed explanation of the multi-faceted research approach"
}
`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    });

    const result = safeJsonParse<any>(
      response.choices[0].message.content,
      {},
      'research plan response',
    );
    const queries = sanitizeStringArray(result.queries);
    if (queries.length === 0) {
      queries.push(query.query);
    }

    const strategy =
      typeof result.strategy === 'string' && result.strategy.trim().length > 0
        ? result.strategy.trim()
        : 'Standard research approach';

    return {
      queries,
      strategy,
    };
  }

  /**
   * Execute web search using Firecrawl
   */
  private async executeSearch(query: string): Promise<ResearchSource[]> {
    try {
      // Search for many more results to ensure comprehensive research
      const searchResults = await this.firecrawl.search(query, {
        limit: 25, // Increased from 10 to get more sources
        scrapeOptions: {
          formats: ['markdown'],
          waitFor: 1000,
          timeout: 60000,
        },
      });

      return (searchResults.data || []).map((result, index) => ({
        title: result.title || 'Untitled',
        url: result.url || '',
        snippet: result.description || '',
        content: result.markdown || '',
        relevanceScore: this.calculateRelevance(query, result),
        citationIndex: index + 1,
      }));
    } catch (error) {
      console.error(`Search error for query "${query}":`, error);
      return [];
    }
  }

  /**
   * Analyze search results for quality and relevance
   */
  private async analyzeResults(
    query: string,
    sources: ResearchSource[],
  ): Promise<{
    keyFindings: string[];
    contradictions: string[];
    gaps: string[];
  }> {
    // Include full content for deep analysis
    const sourcesForAnalysis = sources.map((s, i) => ({
      index: i + 1,
      title: s.title,
      url: s.url,
      content: (s.content || s.snippet).slice(0, 3000), // Include substantial content
    }));

    const prompt = `
Conduct a DEEP analysis of these search results for: "${query}"

SOURCES (${sources.length} total):
${sourcesForAnalysis.map((s) => `[${s.index}] ${s.title}\nURL: ${s.url}\nContent: ${s.content}\n---`).join('\n\n')}

Perform COMPREHENSIVE analysis:
1. Extract ALL key findings, insights, data points, statistics, expert opinions
2. Identify contradictions, conflicting viewpoints, or inconsistencies
3. Note information gaps, unanswered questions, areas needing more research
4. Find patterns, trends, and connections between sources
5. Identify the most authoritative and credible sources

Be EXTREMELY thorough - extract EVERYTHING relevant. Generate at least 15-20 key findings.

Return your analysis in JSON format:
{
  "keyFindings": [
    "Detailed finding 1 with specific data/quotes",
    "Detailed finding 2 with evidence",
    ... (at least 15-20 findings)
  ],
  "contradictions": [
    "Specific contradiction between sources X and Y",
    ...
  ],
  "gaps": [
    "Specific information gap or unanswered question",
    ...
  ]
}
`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    const result = safeJsonParse<any>(
      response.choices[0].message.content,
      {},
      'analysis response',
    );

    return {
      keyFindings: sanitizeStringArray(result.keyFindings),
      contradictions: sanitizeStringArray(result.contradictions),
      gaps: sanitizeStringArray(result.gaps),
    };
  }

  /**
   * Synthesize results into comprehensive summary
   */
  private async synthesizeResults(
    query: string,
    sources: ResearchSource[],
    analysis: any,
    maxTokens = 6000,
    model = 'claude-sonnet-4-5-20250929',
  ): Promise<{
    summary: string;
    relatedTopics: string[];
    references?: Array<{
      number: number;
      title: string;
      url: string;
      snippet?: string;
    }>;
  }> {
    // For comprehensive research, use all sources with full content
    // Trim sources to control prompt size and avoid context overflow
    const MAX_SOURCES = 18;
    const MAX_CONTENT_CHARS = 4000;
    const limitedSources = sources.slice(0, MAX_SOURCES);
    const sourcesForSynthesis = limitedSources.map((s, i) => ({
      index: i + 1,
      title: s.title,
      url: s.url,
      snippet: s.snippet,
      content: (s.content || s.snippet || '').slice(0, MAX_CONTENT_CHARS),
    }));

    const keyFindings = sanitizeStringArray(analysis?.keyFindings);
    const keyFindingsSection =
      keyFindings.length > 0
        ? keyFindings.join('\n')
        : 'No key findings were returned by the analysis step.';

    const prompt = `
You are a world-class research analyst tasked with creating an EXTREMELY comprehensive and detailed research report.

RESEARCH QUERY: "${query}"

KEY FINDINGS FROM ANALYSIS:
${keyFindingsSection}

ALL RESEARCH SOURCES (${sources.length} total):
${sourcesForSynthesis
  .map(
    (s) => `[${s.index}] ${s.title}
URL: ${s.url}
Content: ${s.content}
---`,
  )
  .join('\n\n')}

CREATE A COMPREHENSIVE RESEARCH REPORT:

Your report should be approximately ${Math.floor(maxTokens * 0.8)} tokens long. This should be a detailed and comprehensive research report.

Requirements:
1. **Length**: Generate a comprehensive report of ~${Math.floor(maxTokens * 0.8)} tokens.
2. **Structure**: Use clear markdown formatting with multiple sections and subsections
3. **Citations**: Include DENSE inline citations throughout using [1][2][3] format - cite EVERYTHING
4. **Depth**: Go into extreme detail on every aspect - explain concepts thoroughly, provide extensive examples
5. **Analysis**: Include deep analysis, comparisons, implications, and expert insights
6. **Evidence**: Quote extensively from sources, include specific data points, statistics, and examples
7. **Comprehensiveness**: Cover ALL aspects of the topic - history, current state, future implications, related concepts
8. **Contradictions**: Note any conflicting information between sources
9. **Limitations**: Acknowledge gaps in available information
10. **Related Topics**: Suggest 5-10 related areas for further research

The report should include AT MINIMUM:
- Executive Summary (500+ words)
- Detailed Introduction (1000+ words)
- Multiple main sections with subsections (5000+ words each)
- Comprehensive analysis and discussion (3000+ words)
- Future implications and trends (2000+ words)
- Conclusion (1000+ words)
- References section listing all sources

Remember: This is a DEEP RESEARCH report. Be EXHAUSTIVE. Include EVERYTHING relevant from the sources. The user wants the FULL picture with maximum detail.

Return your response in JSON format:
{
  "summary": "Your massive, comprehensive markdown report with dense citations throughout (must be ~${Math.floor(maxTokens * 0.9)} tokens)",
  "relatedTopics": ["topic1", "topic2", "topic3", "topic4", "topic5", ...],
  "references": [
    {"number": 1, "title": "Source 1 Title", "url": "https://...", "snippet": "Brief description"},
    {"number": 2, "title": "Source 2 Title", "url": "https://...", "snippet": "Brief description"},
    ...
  ]
}
`;

    // Use Claude for synthesis (larger context)
    const response = await this.anthropic.messages.create({
      model: model,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
    });

    const responseText = response.content[0].type === 'text' 
      ? response.content[0].text 
      : '';
    
    const result = safeJsonParse<any>(
      responseText,
      {},
      'synthesis response',
    );

    const summary =
      typeof result.summary === 'string' && result.summary.trim().length > 0
        ? result.summary
        : 'No summary generated.';

    const relatedTopics = sanitizeStringArray(result.relatedTopics);

    let references:
      | Array<{
          number: number;
          title: string;
          url: string;
          snippet?: string;
        }>
      | undefined;

    if (Array.isArray(result.references)) {
      const sanitized = result.references
        .map((ref: any, index: number) => {
          const title = typeof ref?.title === 'string' ? ref.title.trim() : '';
          const url = typeof ref?.url === 'string' ? ref.url.trim() : '';
          if (!title || !url) {
            return null;
          }
          const number =
            typeof ref?.number === 'number' ? ref.number : index + 1;
          const snippet =
            typeof ref?.snippet === 'string' && ref.snippet.trim().length > 0
              ? ref.snippet.trim()
              : undefined;
          return { number, title, url, snippet };
        })
        .filter(
          (
            ref: {
              number: number;
              title: string;
              url: string;
              snippet?: string;
            } | null,
          ): ref is {
            number: number;
            title: string;
            url: string;
            snippet?: string;
          } => Boolean(ref),
        );
      if (sanitized.length > 0) {
        references = sanitized;
      }
    }

    return {
      summary,
      relatedTopics,
      references,
    };
  }

  /**
   * Generate intelligent follow-up questions
   */
  private async generateFollowUpQuestions(
    originalQuery: string,
    summary: string,
  ): Promise<string[]> {
    const prompt = `
Based on this research query and summary, generate 3-5 follow-up questions that would help deepen understanding.

Original Query: ${originalQuery}

Summary (truncated): ${summary.slice(0, 1000)}...

Generate questions that:
1. Explore specific aspects mentioned in the summary
2. Address any gaps or limitations noted
3. Connect to related topics
4. Help clarify complex points

Return your response in JSON format:
{
  "questions": ["question1", "question2", ...]
}
`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
      response_format: { type: 'json_object' },
    });

    const result = safeJsonParse<any>(
      response.choices[0].message.content,
      {},
      'follow-up questions response',
    );
    return sanitizeStringArray(result.questions);
  }

  /**
   * Calculate relevance score for a search result
   */
  private calculateRelevance(query: string, result: any): number {
    const queryLower = query.toLowerCase();
    const titleLower = (result.title || '').toLowerCase();
    const snippetLower = (result.description || '').toLowerCase();

    let score = 0;

    // Title match
    if (titleLower.includes(queryLower)) score += 0.4;

    // Query terms in title/snippet
    const queryTerms = queryLower.split(' ');
    const matchedTerms = queryTerms.filter(
      (term) => titleLower.includes(term) || snippetLower.includes(term),
    );
    score += (matchedTerms.length / queryTerms.length) * 0.3;

    // Content quality indicators
    if (result.markdown && result.markdown.length > 1000) score += 0.2;
    if (result.metadata?.language === 'en') score += 0.1;

    return Math.min(score, 1);
  }

  /**
   * Create a stream event
   */
  private createEvent(type: StreamEvent['type'], data: any): StreamEvent {
    return {
      type,
      data,
      timestamp: Date.now(),
    };
  }

  /**
   * Expand user query with synonyms if enabled
   */
  private expandQueryWithSynonyms(query: ResearchQuery): string {
    if (
      !query.synonymsEnabled &&
      (!query.synonyms || query.synonyms.length === 0)
    ) {
      return query.query;
    }
    const unique = new Set<string>();
    const base = query.query.trim();
    base.split(/\s+/).forEach((t) => unique.add(t));
    (query.synonyms || []).forEach((t) => unique.add(t));
    return Array.from(unique).join(' ');
  }

  /**
   * Apply simple key/value filters to results
   */
  private applyFilters(
    results: ResearchSource[],
    filters: Record<string, any>,
  ): ResearchSource[] {
    // Since sources are scraped web docs, we only support basic filters derived from URL/title/content
    return results.filter((r) => {
      return Object.entries(filters).every(([key, val]) => {
        const v = Array.isArray(val) ? val : [val];
        const haystack =
          `${r.title} ${r.url} ${r.snippet} ${r.content || ''}`.toLowerCase();
        return v.every((needle) =>
          String(needle)
            .toLowerCase()
            .split(/\s+/)
            .every((term) => haystack.includes(term)),
        );
      });
    });
  }

  /**
   * Heuristic ranking using simple relevance + position boosts
   */
  private applyHeuristicRanking(
    query: string,
    results: ResearchSource[],
  ): ResearchSource[] {
    const scored = results.map((r, i) => {
      const base =
        r.relevanceScore ??
        this.calculateRelevance(query, {
          title: r.title,
          description: r.snippet,
          markdown: r.content,
          metadata: { language: 'en' },
        });
      const positionBoost = 1 - Math.min(i / 20, 0.5);
      return { r, score: base * 0.8 + positionBoost * 0.2 };
    });
    return scored.sort((a, b) => b.score - a.score).map((s) => s.r);
  }

  /**
   * ML re-ranking using OpenAI embeddings + cosine similarity
   */
  private async applyMlRanking(
    query: string,
    results: ResearchSource[],
  ): Promise<ResearchSource[]> {
    if (results.length === 0) return results;
    try {
      const contents = results.map(
        (r) => `${r.title}\n${r.snippet}\n${(r.content || '').slice(0, 1000)}`,
      );
      const [qEmbed, dEmbeds] = await Promise.all([
        this.openai.embeddings.create({
          model: 'text-embedding-3-large',
          input: query,
        }),
        this.openai.embeddings.create({
          model: 'text-embedding-3-large',
          input: contents,
        }),
      ]);
      const qv = qEmbed.data[0].embedding;
      const sims = dEmbeds.data.map((e, i) => ({
        r: results[i],
        score: this.cosineSimilarity(qv, e.embedding),
      }));
      return sims.sort((a, b) => b.score - a.score).map((s) => s.r);
    } catch (e) {
      console.warn('ML ranking failed, falling back to heuristic', e);
      return this.applyHeuristicRanking(query, results);
    }
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0;
    let na = 0;
    let nb = 0;
    for (let i = 0; i < a.length && i < b.length; i++) {
      dot += a[i] * b[i];
      na += a[i] * a[i];
      nb += b[i] * b[i];
    }
    if (na === 0 || nb === 0) return 0;
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `fs_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Resume a research session from checkpoint
   */
  async resumeSession(
    sessionId: string,
    checkpoint: ResearchCheckpoint,
  ): Promise<AsyncGenerator<StreamEvent, ResearchResult, unknown>> {
    // This would integrate with Redis to restore session state
    // For now, we'll start a fresh search with the original query
    console.log('Resuming session:', sessionId, 'from', checkpoint.phase);

    // Implementation would restore state and continue from checkpoint
    throw new Error('Session resume not yet implemented');
  }
}
