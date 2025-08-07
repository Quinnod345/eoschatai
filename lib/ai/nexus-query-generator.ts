import { openai } from '@ai-sdk/openai';
import { generateObject, generateText } from 'ai';
import { z } from 'zod';

// Schema for research plan
const ResearchPlanSchema = z.object({
  mainObjective: z
    .string()
    .describe('The main research objective in natural language'),
  researchQuestions: z
    .array(z.string())
    .describe(
      'Natural questions that a human expert would ask about this topic',
    ),
  searchQueries: z
    .array(
      z.object({
        query: z
          .string()
          .describe(
            'A natural, specific search query as a human expert would type it - AVOID templates like "[topic] best practices"',
          ),
        intent: z
          .enum([
            'overview',
            'specific',
            'technical',
            'recent',
            'comparative',
            'tutorial',
          ])
          .describe('The natural intent behind this search'),
        priority: z
          .enum(['high', 'medium', 'low'])
          .describe('How critical this search is for understanding the topic'),
      }),
    )
    .describe('Natural, diverse search queries without any templated patterns'),
  searchStrategy: z.object({
    depth: z
      .enum(['shallow', 'medium', 'deep', 'comprehensive'])
      .describe('How thorough the research should be'),
    focus: z
      .array(z.string())
      .describe('Specific aspects to investigate deeply'),
    timeframe: z
      .enum(['all', 'recent', 'year', 'month', 'week'])
      .describe('Time relevance for the research'),
  }),
});

// Schema for dynamic query refinement
const QueryRefinementSchema = z.object({
  refinedQueries: z.array(
    z.object({
      query: z.string(),
      rationale: z.string(),
      expectedInsights: z.array(z.string()),
    }),
  ),
  gaps: z.array(z.string()).describe('Information gaps to fill'),
  followUpQuestions: z
    .array(z.string())
    .describe('Questions for deeper exploration'),
});

export interface ResearchContext {
  userQuery: string;
  previousSearches?: string[];
  foundInformation?: string[];
  userIntent?: string;
  domain?: string;
  model?: string; // Allow specifying the model to use
}

/**
 * Detect the domain of the query for better search targeting
 */
export function detectDomain(query: string): string {
  const queryLower = query.toLowerCase();

  if (
    queryLower.match(
      /\b(api|sdk|library|framework|programming|code|developer)\b/,
    )
  ) {
    return 'technical';
  }
  if (queryLower.match(/\b(research|study|paper|academic|science)\b/)) {
    return 'academic';
  }
  if (queryLower.match(/\b(business|marketing|sales|revenue|company)\b/)) {
    return 'business';
  }
  if (queryLower.match(/\b(news|latest|update|announcement)\b/)) {
    return 'news';
  }

  return 'general';
}

/**
 * Detect user intent from the query
 */
export function detectIntent(query: string): string {
  const queryLower = query.toLowerCase();

  if (queryLower.startsWith('how to') || queryLower.startsWith('how do')) {
    return 'tutorial';
  }
  if (queryLower.startsWith('what is') || queryLower.startsWith('what are')) {
    return 'definition';
  }
  if (
    queryLower.includes('vs') ||
    queryLower.includes('versus') ||
    queryLower.includes('compare')
  ) {
    return 'comparison';
  }
  if (queryLower.includes('best') || queryLower.includes('top')) {
    return 'recommendation';
  }
  if (queryLower.includes('why')) {
    return 'explanation';
  }

  return 'general';
}

export interface ResearchPlan {
  mainObjective: string;
  researchQuestions: string[];
  searchQueries: Array<{
    query: string;
    intent:
      | 'overview'
      | 'specific'
      | 'technical'
      | 'recent'
      | 'comparative'
      | 'tutorial';
    priority: 'high' | 'medium' | 'low';
  }>;
  searchStrategy: {
    depth: 'shallow' | 'medium' | 'deep' | 'comprehensive';
    focus: string[];
    timeframe: 'all' | 'recent' | 'year' | 'month' | 'week';
  };
  phases: Array<{
    name: string;
    description: string;
    queries: string[];
    expectedDuration: number;
  }>;
  estimatedDuration: number;
  estimatedCredits: number;
}

/**
 * Generate an intelligent research strategy using AI reasoning
 */
async function generateResearchStrategy(
  context: ResearchContext,
): Promise<string> {
  const modelToUse = context.model || 'gpt-4.1-mini';

  // First, use AI to deeply analyze what needs to be researched
  const strategyPrompt = `You are an expert research strategist. Analyze this query deeply and explain what specific information needs to be gathered to provide a comprehensive answer.

Query: "${context.userQuery}"
${context.domain ? `Domain: ${context.domain}` : ''}
${context.userIntent ? `Intent: ${context.userIntent}` : ''}

Think step by step:
1. What are the core concepts that need to be understood?
2. What background information is essential?
3. What are the different perspectives to explore?
4. What practical information would be valuable?
5. What recent developments are relevant?
6. What comparisons or alternatives should be considered?
7. What potential challenges or limitations exist?
8. What expert insights would be valuable?
9. What data, statistics, or evidence should be gathered?
10. What are the controversial or debated aspects?
11. What best practices or recommendations exist?
12. What case studies or real-world examples would be helpful?

Provide a detailed research strategy explaining exactly what information to search for and why. Be specific about the types of sources and information needed. Think like a professional researcher conducting a thorough investigation.`;

  try {
    const response = await generateText({
      model: openai(modelToUse),
      prompt: strategyPrompt,
      temperature: 0.8,
      maxTokens: 1500,
    });

    return response.text;
  } catch (error) {
    console.error('[Research Strategy] Failed to generate strategy:', error);
    return '';
  }
}

/**
 * Extract intelligent search queries from research strategy
 */
async function extractSearchQueries(
  strategy: string,
  context: ResearchContext,
): Promise<any[]> {
  const modelToUse = context.model || 'gpt-4.1-mini';

  const extractionPrompt = `Based on this research strategy, generate specific search queries that would gather all the necessary information.

Research Strategy:
${strategy}

Original Query: "${context.userQuery}"

Generate 12-20 SPECIFIC, INTELLIGENT search queries that:
1. Cover all aspects mentioned in the strategy
2. Use natural language as an expert would search
3. Build upon each other for comprehensive coverage
4. Include both broad and specific searches
5. Target different types of sources (academic, practical, recent, etc.)
6. Use advanced search techniques (site-specific, quotes, operators)
7. Include queries for statistics, data, and evidence
8. Cover multiple perspectives and viewpoints

CRITICAL RULES:
- Each query must be unique and serve a specific purpose
- Think about what an expert researcher would actually type into Google
- Use varied query structures (questions, statements, keywords)
- Include queries that would find authoritative sources
- Add queries for recent updates and developments
- Include comparative and analytical queries
- DO NOT use generic templates like "[topic] best practices"
- Make queries natural and conversational when appropriate

Format each query with its purpose:
- Query: [the actual search query]
- Purpose: [what information this will find]
- Priority: [high/medium/low]`;

  try {
    const response = await generateText({
      model: openai(modelToUse),
      prompt: extractionPrompt,
      temperature: 0.9,
      maxTokens: 2000,
    });

    // Parse the response to extract queries
    const lines = response.text.split('\n');
    const queries: any[] = [];
    let currentQuery: any = {};

    for (const line of lines) {
      if (line.startsWith('- Query:')) {
        if (currentQuery.query) {
          // Clean up the query before adding
          currentQuery.query = currentQuery.query
            .replace(/^["']|["']$/g, '') // Remove quotes
            .trim();
          if (
            currentQuery.query.length > 5 &&
            currentQuery.query.length < 200
          ) {
            queries.push(currentQuery);
          }
        }
        currentQuery = { query: line.replace('- Query:', '').trim() };
      } else if (line.startsWith('- Purpose:')) {
        currentQuery.purpose = line.replace('- Purpose:', '').trim();
      } else if (line.startsWith('- Priority:')) {
        const priority = line.replace('- Priority:', '').trim().toLowerCase();
        currentQuery.priority = priority.includes('high')
          ? 'high'
          : priority.includes('low')
            ? 'low'
            : 'medium';
        currentQuery.intent = determineIntent(
          currentQuery.query,
          currentQuery.purpose,
        );
      }
    }

    if (currentQuery.query) {
      // Clean up the final query
      currentQuery.query = currentQuery.query
        .replace(/^["']|["']$/g, '')
        .trim();
      if (currentQuery.query.length > 5 && currentQuery.query.length < 200) {
        queries.push(currentQuery);
      }
    }

    // Remove duplicates and sort by priority
    const uniqueQueries = Array.from(
      new Map(queries.map((q) => [q.query.toLowerCase(), q])).values(),
    ).sort((a, b) => {
      const priorityOrder: Record<string, number> = {
        high: 0,
        medium: 1,
        low: 2,
      };
      return (
        (priorityOrder[a.priority] || 1) - (priorityOrder[b.priority] || 1)
      );
    });

    return uniqueQueries;
  } catch (error) {
    console.error('[Query Extraction] Failed to extract queries:', error);
    return [];
  }
}

/**
 * Determine search intent from query and purpose
 */
function determineIntent(query: string, purpose: string): string {
  const combined = `${query} ${purpose}`.toLowerCase();

  if (
    combined.includes('overview') ||
    combined.includes('introduction') ||
    combined.includes('what is')
  ) {
    return 'overview';
  }
  if (
    combined.includes('recent') ||
    combined.includes('latest') ||
    combined.includes('2024') ||
    combined.includes('news')
  ) {
    return 'recent';
  }
  if (
    combined.includes('how to') ||
    combined.includes('tutorial') ||
    combined.includes('guide')
  ) {
    return 'tutorial';
  }
  if (
    combined.includes('compare') ||
    combined.includes('vs') ||
    combined.includes('versus') ||
    combined.includes('alternative')
  ) {
    return 'comparative';
  }
  if (
    combined.includes('technical') ||
    combined.includes('implementation') ||
    combined.includes('code') ||
    combined.includes('api')
  ) {
    return 'technical';
  }

  return 'specific';
}

/**
 * Generate an intelligent research plan based on the user's query
 */
export async function generateResearchPlan(
  context: ResearchContext,
): Promise<ResearchPlan> {
  try {
    const modelToUse = context.model || 'gpt-4.1-mini';
    console.log(
      `[Research Plan] Using model: ${modelToUse} for AI-driven research planning`,
    );

    // Step 1: Generate comprehensive research strategy
    console.log('[Research Plan] Step 1: Generating research strategy...');
    const strategy = await generateResearchStrategy(context);

    if (!strategy) {
      console.log(
        '[Research Plan] Failed to generate strategy, using fallback',
      );
      return await generateFallbackPlan(context.userQuery);
    }

    // Step 2: Extract intelligent search queries from strategy
    console.log(
      '[Research Plan] Step 2: Extracting search queries from strategy...',
    );
    const extractedQueries = await extractSearchQueries(strategy, context);

    if (extractedQueries.length === 0) {
      console.log(
        '[Research Plan] No queries extracted, using schema-based generation',
      );
      // Fall back to schema-based generation
      return generateSchemaBasedPlan(context);
    }

    // Step 3: Organize into research plan
    console.log(
      `[Research Plan] Step 3: Organizing ${extractedQueries.length} queries into research plan...`,
    );

    // Determine research depth based on query count
    const depth =
      extractedQueries.length > 12
        ? 'comprehensive'
        : extractedQueries.length > 8
          ? 'deep'
          : extractedQueries.length > 5
            ? 'medium'
            : 'shallow';

    // Extract focus areas from queries
    const focusAreas = [
      ...new Set(
        extractedQueries
          .map((q) => q.purpose)
          .filter((p) => p)
          .slice(0, 5),
      ),
    ];

    const researchPlan: ResearchPlan = {
      mainObjective: `Comprehensive research on: ${context.userQuery}`,
      researchQuestions: extractedQueries
        .filter((q) => q.purpose)
        .map((q) => q.purpose)
        .filter((purpose, index, self) => self.indexOf(purpose) === index) // Remove duplicates
        .slice(0, 10), // Allow more questions
      searchQueries: extractedQueries.map((q) => ({
        query: q.query,
        intent: q.intent || 'specific',
        priority: q.priority || 'medium',
      })),
      searchStrategy: {
        depth: depth as any,
        focus: focusAreas,
        timeframe: extractedQueries.some(
          (q) =>
            q.query.toLowerCase().includes('recent') ||
            q.query.toLowerCase().includes('2024'),
        )
          ? 'recent'
          : 'year',
      },
      phases: [],
      estimatedDuration: 0,
      estimatedCredits: 0,
    };

    // Organize into phases
    researchPlan.phases = organizeIntoPhases(researchPlan);

    // Calculate estimates
    const { estimatedDuration, estimatedCredits } = calculateEstimates(
      researchPlan.searchQueries.length,
      researchPlan.searchStrategy.depth,
    );

    researchPlan.estimatedDuration = estimatedDuration;
    researchPlan.estimatedCredits = estimatedCredits;

    console.log(
      '[Research Plan] Successfully generated AI-driven research plan:',
      {
        queries: researchPlan.searchQueries.length,
        phases: researchPlan.phases.length,
        depth: researchPlan.searchStrategy.depth,
      },
    );

    return researchPlan;
  } catch (error) {
    console.error('[Research Plan] Failed to generate AI-driven plan:', error);
    return generateSchemaBasedPlan(context);
  }
}

/**
 * Generate a schema-based research plan (fallback)
 */
async function generateSchemaBasedPlan(
  context: ResearchContext,
): Promise<ResearchPlan> {
  try {
    const systemPrompt = `You are an advanced AI research strategist with expertise in comprehensive information gathering and analysis. Your task is to create a highly dynamic, intelligent research plan that adapts to the specific query and context.

CORE MISSION:
Generate a sophisticated research strategy that will uncover comprehensive, authoritative, and nuanced information through intelligent query formulation.

RESEARCH PLANNING PRINCIPLES:

1. **Dynamic Query Generation** (8-15 queries):
   - Analyze the query to identify core concepts, related fields, and implicit questions
   - Generate queries that explore different dimensions: theoretical, practical, historical, future-oriented
   - Include multi-perspective queries: academic, industry, user/consumer, expert viewpoints
   - Create queries that build upon each other for deeper understanding

2. **Intelligent Coverage Strategy**:
   - Start with foundational understanding queries
   - Progress to specialized and technical aspects
   - Include comparative analysis queries (alternatives, competitors, related concepts)
   - Add queries for edge cases, controversies, and limitations
   - Search for recent innovations and future trends
   - Include practical implementation and real-world application queries

3. **Adaptive Search Intents**:
   - Definitional: "What is X and how does it fundamentally work?"
   - Analytical: "Deep analysis of X mechanisms and principles"
   - Comparative: "X vs Y comparison and trade-offs"
   - Practical: "How to implement/use X in practice"
   - Evaluative: "Benefits, drawbacks, and critical analysis of X"
   - Evolutionary: "History and future evolution of X"
   - Contextual: "X in different contexts and industries"

4. **Domain-Specific Adaptations**:
   
   For Technical/Engineering Topics:
   - Architecture and design patterns
   - Implementation details and code examples
   - Performance benchmarks and optimizations
   - Security considerations and best practices
   - Integration strategies and compatibility
   - Troubleshooting and common pitfalls
   
   For Business/Market Topics:
   - Market analysis and competitive landscape
   - Financial implications and ROI
   - Case studies and success stories
   - Industry trends and disruptions
   - Regulatory and compliance aspects
   - Strategic frameworks and methodologies
   
   For Scientific/Research Topics:
   - Peer-reviewed studies and findings
   - Methodologies and experimental approaches
   - Statistical analysis and data interpretation
   - Theoretical foundations and models
   - Current research frontiers
   - Reproducibility and validation
   
   For Social/Cultural Topics:
   - Historical context and evolution
   - Cultural perspectives and variations
   - Stakeholder viewpoints and impacts
   - Ethical considerations and debates
   - Policy implications and recommendations
   - Global vs local perspectives

5. **Query Sophistication Techniques**:
   - Use advanced search operators when beneficial
   - Include long-tail queries for specific insights
   - Formulate hypothesis-testing queries
   - Create queries that explore causal relationships
   - Design queries to uncover hidden connections
   - Include queries that challenge assumptions

6. **Research Depth Calibration**:
   - Shallow: Quick overview and key facts (3-5 queries)
   - Medium: Comprehensive understanding (6-10 queries)
   - Deep: Expert-level investigation (10-15 queries)
   - Comprehensive: Exhaustive research (15-20 queries)

7. **Information Quality Focus**:
   - Prioritize queries likely to return authoritative sources
   - Include queries targeting academic and professional resources
   - Add queries for primary sources and original research
   - Search for meta-analyses and systematic reviews when relevant

IMPORTANT: 
- DO NOT use generic templates or formulaic approaches
- Each research plan must be uniquely tailored to the specific query
- Consider the implicit questions behind the user's query
- Think about what an expert researcher in this field would want to know
- Generate queries that will produce complementary, not redundant, information
- Ensure queries will capture both consensus views and alternative perspectives`;

    const userPrompt = `Create a comprehensive research plan for: "${context.userQuery}"

${context.userIntent ? `User Intent: ${context.userIntent}` : ''}
${context.domain ? `Domain: ${context.domain}` : ''}
${context.previousSearches?.length ? `Previous searches: ${context.previousSearches.join(', ')}` : ''}

CRITICAL INSTRUCTIONS FOR QUERY GENERATION:

1. DO NOT use template patterns like:
   - "[topic] best practices"
   - "[topic] vs alternatives"
   - "[topic] overview guide"
   - "[topic] troubleshooting"
   - "[topic] implementation"
   
2. INSTEAD, create NATURAL, SPECIFIC queries as if a human expert was searching, like:
   - Specific questions about the topic
   - Natural language searches
   - Context-specific queries
   - Queries that build on each other
   
3. EXAMPLES of GOOD queries for a topic like "React hooks":
   - "how do React hooks manage state internally"
   - "when should useCallback be used over useMemo in React"
   - "React hooks performance impact on large applications"
   - "custom hooks for API calls with error handling"
   - "React hooks testing strategies with Jest and React Testing Library"
   
4. EXAMPLES of BAD templated queries to AVOID:
   - "React hooks best practices"
   - "React hooks overview guide"
   - "React hooks vs alternatives"
   - "React hooks troubleshooting"
   
Generate ${context.domain === 'technical' ? '10-15' : '8-12'} unique, natural search queries that a domain expert would use.`;

    // Use the specified model or default to gpt-4.1-mini for best performance
    const modelToUse = context.model || 'gpt-4.1-mini';
    console.log(
      `[Research Plan] Using model: ${modelToUse} for plan generation`,
    );

    const result = await generateObject({
      model: openai(modelToUse),
      schema: ResearchPlanSchema,
      system: systemPrompt,
      prompt: userPrompt,
      temperature: 0.9, // Higher temperature for more creative, less templated queries
      maxTokens: 2500,
    });

    // Organize queries into research phases
    const phases = organizeIntoPhases(result.object);

    // Calculate estimates based on strategy
    const { estimatedDuration, estimatedCredits } = calculateEstimates(
      result.object.searchQueries.length,
      result.object.searchStrategy.depth,
    );

    return {
      ...result.object,
      phases,
      estimatedDuration,
      estimatedCredits,
    };
  } catch (error) {
    const modelUsed = context.model || 'gpt-4.1-mini';
    console.error(
      `[Query Generator] Failed to generate research plan with model ${modelUsed}:`,
      error,
    );
    console.log('[Query Generator] Using dynamic fallback plan generation');
    // Fallback to dynamic non-AI plan generation
    return generateFallbackPlan(context.userQuery);
  }
}

/**
 * Refine queries based on initial search results
 */
export async function refineSearchQueries(
  originalQuery: string,
  initialResults: string[],
  gaps?: string[],
): Promise<string[]> {
  try {
    const systemPrompt = `You are an expert at refining search queries based on initial research results. Analyze what information has been found and identify gaps that need to be filled with follow-up searches.`;

    const userPrompt = `Original query: "${originalQuery}"

Initial findings summary:
${initialResults.slice(0, 5).join('\n')}

${gaps?.length ? `Identified gaps: ${gaps.join(', ')}` : ''}

Generate 3-5 refined search queries that will:
1. Fill information gaps
2. Dive deeper into important aspects
3. Find recent updates or contradicting viewpoints
4. Explore practical applications or examples`;

    const result = await generateObject({
      model: openai('gpt-4o-mini'),
      schema: QueryRefinementSchema,
      system: systemPrompt,
      prompt: userPrompt,
      temperature: 0.7,
      maxTokens: 1000,
    });

    return result.object.refinedQueries.map((q) => q.query);
  } catch (error) {
    console.error('[Query Generator] Failed to refine queries:', error);
    // Fallback to AI-generated variations of original query
    return await generateQueryVariations(originalQuery);
  }
}

/**
 * Generate natural query variations using AI
 */
export async function generateQueryVariations(
  baseQuery: string,
): Promise<string[]> {
  try {
    // Use AI to generate natural variations
    const prompt = `Generate 8-10 natural, specific search queries for researching: "${baseQuery}"

Rules:
- Create queries as if an expert researcher is searching Google
- Use natural language, not templates
- Each query should explore a different aspect
- Mix questions, statements, and specific searches
- Be specific and contextual
- DO NOT use patterns like "[topic] best practices"

Format each query on a new line starting with a dash:
- [query here]`;

    const response = await generateText({
      model: openai('gpt-4o-mini'),
      prompt,
      temperature: 0.9,
      maxTokens: 500,
    });

    // Parse the response
    const lines = response.text.split('\n');
    const queries: string[] = [];

    for (const line of lines) {
      const cleaned = line.replace(/^[-•*]\s*/, '').trim();
      if (
        cleaned.length > 5 &&
        cleaned.length < 150 &&
        !cleaned.includes('[')
      ) {
        queries.push(cleaned);
      }
    }

    // If we got good results, return them
    if (queries.length >= 5) {
      return queries.slice(0, 10);
    }

    // Fallback to simple variations if AI fails
    return [
      baseQuery,
      `comprehensive guide ${baseQuery}`,
      `how does ${baseQuery} work`,
      `${baseQuery} examples and use cases`,
      `latest research ${baseQuery}`,
    ];
  } catch (error) {
    console.error('[Query Variations] AI generation failed:', error);
    // Return minimal fallback
    return [
      baseQuery,
      `understanding ${baseQuery}`,
      `${baseQuery} explained`,
      `${baseQuery} analysis`,
    ];
  }
}

/**
 * Organize search queries into logical research phases
 */
function organizeIntoPhases(plan: any): ResearchPlan['phases'] {
  const highPriority = plan.searchQueries.filter(
    (q: any) => q.priority === 'high',
  );
  const mediumPriority = plan.searchQueries.filter(
    (q: any) => q.priority === 'medium',
  );
  const lowPriority = plan.searchQueries.filter(
    (q: any) => q.priority === 'low',
  );

  const phases: ResearchPlan['phases'] = [];

  // Phase 1: Foundation (high priority overview queries)
  const foundationQueries = highPriority
    .filter((q: any) => q.intent === 'overview' || q.intent === 'tutorial')
    .map((q: any) => q.query);

  if (foundationQueries.length > 0) {
    phases.push({
      name: 'Foundation Research',
      description: 'Understanding core concepts and overview',
      queries: foundationQueries,
      expectedDuration: foundationQueries.length * 30,
    });
  }

  // Phase 2: Deep Investigation (high priority specific/technical queries)
  const deepDiveQueries = [
    ...highPriority
      .filter((q: any) => q.intent === 'specific' || q.intent === 'technical')
      .map((q: any) => q.query),
    ...mediumPriority
      .filter((q: any) => q.intent === 'specific' || q.intent === 'technical')
      .slice(0, 3)
      .map((q: any) => q.query),
  ];

  if (deepDiveQueries.length > 0) {
    phases.push({
      name: 'Deep Investigation',
      description:
        'In-depth analysis of specific aspects and technical details',
      queries: deepDiveQueries,
      expectedDuration: deepDiveQueries.length * 40,
    });
  }

  // Phase 3: Current Landscape & Trends (recent and comparative)
  const landscapeQueries = [
    ...highPriority
      .filter((q: any) => q.intent === 'recent')
      .map((q: any) => q.query),
    ...mediumPriority
      .filter((q: any) => q.intent === 'comparative' || q.intent === 'recent')
      .map((q: any) => q.query),
    ...plan.searchQueries
      .filter(
        (q: any) =>
          q.query.toLowerCase().includes('2024') ||
          q.query.toLowerCase().includes('latest') ||
          q.query.toLowerCase().includes('trend'),
      )
      .slice(0, 3)
      .map((q: any) => q.query),
  ];

  // Remove duplicates
  const uniqueLandscapeQueries = [...new Set(landscapeQueries)];

  if (uniqueLandscapeQueries.length > 0) {
    phases.push({
      name: 'Current Landscape & Trends',
      description: 'Recent developments, comparisons, and current state',
      queries: uniqueLandscapeQueries,
      expectedDuration: uniqueLandscapeQueries.length * 35,
    });
  }

  // Phase 4: Expert Insights & Best Practices
  const expertQueries = [
    ...highPriority
      .filter((q: any) => q.intent === 'comparative')
      .map((q: any) => q.query),
    ...mediumPriority
      .filter(
        (q: any) =>
          q.query.toLowerCase().includes('best practice') ||
          q.query.toLowerCase().includes('expert') ||
          q.query.toLowerCase().includes('guide') ||
          q.query.toLowerCase().includes('recommendation'),
      )
      .map((q: any) => q.query),
    ...lowPriority
      .filter((q: any) => q.intent === 'tutorial')
      .slice(0, 2)
      .map((q: any) => q.query),
  ];

  // Remove duplicates from all previous phases
  const allPreviousQueries = phases.flatMap((p) => p.queries);
  const uniqueExpertQueries = expertQueries.filter(
    (q) => !allPreviousQueries.includes(q),
  );

  if (uniqueExpertQueries.length > 0) {
    phases.push({
      name: 'Expert Insights & Best Practices',
      description: 'Professional recommendations and proven approaches',
      queries: uniqueExpertQueries,
      expectedDuration: uniqueExpertQueries.length * 35,
    });
  }

  // Phase 5: Synthesis & Validation (remaining important queries)
  const remainingQueries = plan.searchQueries
    .filter((q: any) => {
      const query = q.query;
      const usedQueries = phases.flatMap((p) => p.queries);
      return !usedQueries.includes(query) && q.priority !== 'low';
    })
    .slice(0, 5)
    .map((q: any) => q.query);

  if (remainingQueries.length > 0) {
    phases.push({
      name: 'Synthesis & Validation',
      description: 'Cross-referencing and validating findings',
      queries: remainingQueries,
      expectedDuration: remainingQueries.length * 30,
    });
  }

  // Ensure we have at least one phase
  if (phases.length === 0) {
    phases.push({
      name: 'Comprehensive Research',
      description: 'Gathering information from multiple perspectives',
      queries: plan.searchQueries.map((q: any) => q.query).slice(0, 10),
      expectedDuration: 300,
    });
  }

  // Limit phases to a reasonable number
  return phases.slice(0, 5);
}

/**
 * Calculate time and credit estimates
 */
function calculateEstimates(
  queryCount: number,
  depth: 'shallow' | 'medium' | 'deep' | 'comprehensive',
): { estimatedDuration: number; estimatedCredits: number } {
  const depthMultipliers = {
    shallow: { time: 20, credits: 10 },
    medium: { time: 30, credits: 20 },
    deep: { time: 40, credits: 35 },
    comprehensive: { time: 50, credits: 50 },
  };

  const multiplier = depthMultipliers[depth];

  return {
    estimatedDuration: queryCount * multiplier.time, // seconds
    estimatedCredits: queryCount * multiplier.credits,
  };
}

/**
 * Generate a dynamic fallback research plan using AI for queries
 * This is only used if the main AI generation fails
 */
async function generateFallbackPlan(query: string): Promise<ResearchPlan> {
  // Use AI to generate queries even in fallback
  const queries = await generateQueryVariations(query);
  const domain = detectDomain(query);
  const intent = detectIntent(query);

  // Generate research questions using AI
  let researchQuestions: string[] = [];

  try {
    // Use AI to generate research questions
    const questionsPrompt = `Generate 5-7 key research questions for investigating: "${query}"

Rules:
- Create natural, specific questions an expert would ask
- Cover different aspects: how it works, why it matters, challenges, benefits, future
- Be specific to the topic, not generic
- Mix analytical and practical questions

Format each question on a new line starting with a dash:
- [question here]`;

    const questionsResponse = await generateText({
      model: openai('gpt-4o-mini'),
      prompt: questionsPrompt,
      temperature: 0.8,
      maxTokens: 400,
    });

    // Parse the response
    const lines = questionsResponse.text.split('\n');
    for (const line of lines) {
      const cleaned = line.replace(/^[-•*]\s*/, '').trim();
      if (cleaned.length > 10 && cleaned.length < 200) {
        researchQuestions.push(cleaned);
      }
    }
  } catch (error) {
    console.error(
      '[Fallback Plan] Failed to generate research questions:',
      error,
    );
  }

  // If AI failed, use the query itself as the main question
  if (researchQuestions.length === 0) {
    researchQuestions = [query];
  }

  // Create search queries with varied intents
  const searchQueries = queries.map((q, i) => {
    let intent: any = 'overview';
    let priority: any = 'medium';

    if (i === 0) {
      intent = 'overview';
      priority = 'high';
    } else if (i < 3) {
      intent = 'specific';
      priority = 'high';
    } else if (i < 5) {
      intent = 'technical';
      priority = 'medium';
    } else if (i < 7) {
      intent = 'comparative';
      priority = 'medium';
    } else {
      intent = 'recent';
      priority = 'low';
    }

    return { query: q, intent, priority };
  });

  // Dynamic phase generation
  const phases = [
    {
      name: 'Foundation & Overview',
      description: 'Establishing comprehensive understanding of core concepts',
      queries: queries.slice(0, Math.ceil(queries.length * 0.3)),
      expectedDuration: 60,
    },
    {
      name: 'Deep Analysis',
      description:
        'Investigating specific aspects, mechanisms, and implementations',
      queries: queries.slice(
        Math.ceil(queries.length * 0.3),
        Math.ceil(queries.length * 0.6),
      ),
      expectedDuration: 90,
    },
    {
      name: 'Advanced Insights',
      description: 'Exploring edge cases, trends, and expert perspectives',
      queries: queries.slice(Math.ceil(queries.length * 0.6)),
      expectedDuration: 60,
    },
  ];

  // Calculate dynamic estimates
  const depthLevel =
    queries.length > 10 ? 'deep' : queries.length > 6 ? 'medium' : 'shallow';
  const { estimatedDuration, estimatedCredits } = calculateEstimates(
    queries.length,
    depthLevel as any,
  );

  return {
    mainObjective: `Comprehensive research and analysis of ${query}`,
    researchQuestions,
    searchQueries,
    searchStrategy: {
      depth: depthLevel as any,
      focus: extractSearchTopics(query),
      timeframe: intent === 'recent' ? 'month' : 'year',
    },
    phases,
    estimatedDuration,
    estimatedCredits,
  };
}

/**
 * Extract key topics and entities from a query for better search coverage
 */
export function extractSearchTopics(query: string): string[] {
  // Simple keyword extraction (could be enhanced with NLP)
  const stopWords = new Set([
    'the',
    'a',
    'an',
    'and',
    'or',
    'but',
    'in',
    'on',
    'at',
    'to',
    'for',
    'of',
    'with',
    'by',
    'from',
    'as',
    'is',
    'was',
    'are',
    'were',
  ]);

  const words = query.toLowerCase().split(/\s+/);
  const keywords = words.filter(
    (word) => word.length > 2 && !stopWords.has(word),
  );

  // Generate topic combinations
  const topics: string[] = [query]; // Include original query

  // Add individual important keywords
  keywords.forEach((keyword) => {
    if (keyword.length > 4) {
      topics.push(keyword);
    }
  });

  // Add bigrams (two-word combinations)
  for (let i = 0; i < words.length - 1; i++) {
    if (!stopWords.has(words[i]) && !stopWords.has(words[i + 1])) {
      topics.push(`${words[i]} ${words[i + 1]}`);
    }
  }

  return [...new Set(topics)].slice(0, 5);
}
