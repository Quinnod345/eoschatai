import { anthropic } from '@ai-sdk/anthropic';
import { generateObject } from 'ai';
import { z } from 'zod/v3';

export interface QueryAnalysis {
  complexity: 'simple' | 'medium' | 'complex';
  requiresUserContext: boolean;
  requiresMemories: boolean;
  requiresWebSearch: boolean;
  suggestedChunkLimits: {
    system: number;
    persona: number;
    user: number;
    memories: number;
  };
  reasoningText: string;
}

/**
 * Analyze query complexity and context requirements
 * @param query - User's query text
 * @returns Analysis of query complexity and requirements
 */
export async function analyzeQueryComplexity(
  query: string,
): Promise<QueryAnalysis> {
  if (!query || query.trim().length === 0) {
    return getDefaultAnalysis('simple');
  }

  // Quick heuristic analysis first
  const heuristic = analyzeWithHeuristics(query);

  // For simple queries, skip LLM classification
  if (heuristic.complexity === 'simple' && query.split(/\s+/).length < 10) {
    console.log('Query Analyzer: Simple query detected via heuristics');
    return heuristic;
  }

  // Use LLM for more accurate classification of medium/complex queries
  try {
    console.log(`Query Analyzer: Analyzing query: "${query}"`);

    const result = await generateObject({
      model: anthropic('claude-3-5-haiku-20241022'),
      schema: z.object({
        complexity: z.enum(['simple', 'medium', 'complex']).describe(
          'Simple: General question, no specific user context. Medium: Specific question that might use user data. Complex: Multi-part or requires comprehensive context.',
        ),
        requiresUserContext: z.boolean().describe(
          'True if query references user-specific information (my/our/we)',
        ),
        requiresMemories: z.boolean().describe(
          'True if query asks about previous conversations or remembered facts',
        ),
        requiresWebSearch: z.boolean().describe(
          'True if query needs current/real-time information',
        ),
        reasoningText: z.string().describe(
          'Brief explanation of the complexity assessment',
        ),
      }),
      prompt: `Analyze this user query and classify its complexity and requirements:

QUERY: "${query}"

Consider:
1. Complexity:
   - Simple: General EOS questions, basic definitions, no personalization needed
   - Medium: Questions about specific EOS tools, might benefit from user context
   - Complex: Multi-part questions, requires comprehensive personalized context

2. Context Requirements:
   - Does it reference "my", "our", "we", or other personal pronouns?
   - Does it ask about previous conversations or remembered information?
   - Does it need real-time data (current events, prices, dates)?

Provide a classification.`,
      temperature: 0.3,
    });

    const analysis = result.object;
    const limits = getChunkLimitsForComplexity(analysis.complexity);

    console.log(
      `Query Analyzer: Classified as ${analysis.complexity} (User context: ${analysis.requiresUserContext}, Memories: ${analysis.requiresMemories})`,
    );
    console.log(`Query Analyzer: ${analysis.reasoningText}`);

    return {
      ...analysis,
      suggestedChunkLimits: limits,
    };
  } catch (error) {
    console.error('Query Analyzer: Error during LLM analysis:', error);
    // Fallback to heuristic analysis
    return heuristic;
  }
}

/**
 * Analyze query using simple heuristics (fast, no LLM)
 * @param query - User's query
 * @returns Heuristic analysis
 */
function analyzeWithHeuristics(query: string): QueryAnalysis {
  const wordCount = query.split(/\s+/).length;
  const hasPersonalPronouns = /\b(my|our|we|us|I|me)\b/i.test(query);
  const hasQuestion = /\?$/.test(query.trim());
  const hasMultipleQuestions = (query.match(/\?/g) || []).length > 1;
  const hasRememberKeyword = /\b(remember|recalled|mentioned|said|told)\b/i.test(query);
  const hasCurrentKeyword = /\b(current|latest|recent|now|today|this\s+(?:week|month|year))\b/i.test(query);

  // Determine complexity
  let complexity: 'simple' | 'medium' | 'complex';
  
  if (hasMultipleQuestions || wordCount > 30) {
    complexity = 'complex';
  } else if (wordCount > 15 || hasPersonalPronouns) {
    complexity = 'medium';
  } else {
    complexity = 'simple';
  }

  // Determine context requirements
  const requiresUserContext = hasPersonalPronouns;
  const requiresMemories = hasRememberKeyword;
  const requiresWebSearch = hasCurrentKeyword;

  const limits = getChunkLimitsForComplexity(complexity);

  return {
    complexity,
    requiresUserContext,
    requiresMemories,
    requiresWebSearch,
    suggestedChunkLimits: limits,
    reasoningText: `Heuristic analysis: ${wordCount} words, ${hasPersonalPronouns ? 'personal' : 'general'} query`,
  };
}

/**
 * Get suggested chunk limits based on complexity
 * @param complexity - Query complexity level
 * @returns Suggested limits for each RAG source
 */
function getChunkLimitsForComplexity(
  complexity: 'simple' | 'medium' | 'complex',
): {
  system: number;
  persona: number;
  user: number;
  memories: number;
} {
  const limits = {
    simple: {
      system: 3,
      persona: 5,
      user: 3,
      memories: 3,
    },
    medium: {
      system: 5,
      persona: 10,
      user: 10,
      memories: 5,
    },
    complex: {
      system: 8,
      persona: 14,
      user: 14,
      memories: 10,
    },
  };

  return limits[complexity];
}

/**
 * Get default analysis for edge cases
 * @param complexity - Default complexity
 * @returns Default analysis
 */
function getDefaultAnalysis(
  complexity: 'simple' | 'medium' | 'complex' = 'medium',
): QueryAnalysis {
  return {
    complexity,
    requiresUserContext: false,
    requiresMemories: false,
    requiresWebSearch: false,
    suggestedChunkLimits: getChunkLimitsForComplexity(complexity),
    reasoningText: 'Default analysis for empty or invalid query',
  };
}

/**
 * Batch analyze multiple queries
 * @param queries - Array of queries
 * @returns Array of analyses
 */
export async function analyzeMultipleQueries(
  queries: string[],
): Promise<QueryAnalysis[]> {
  return Promise.all(queries.map((q) => analyzeQueryComplexity(q)));
}

/**
 * Check if query likely needs web search
 * @param query - User's query
 * @returns Whether web search is recommended
 */
export function shouldUseWebSearch(query: string): boolean {
  const currentKeywords = [
    'current',
    'latest',
    'recent',
    'now',
    'today',
    'this week',
    'this month',
    'this year',
    '2024',
    '2025',
    'breaking',
    'news',
    'update',
  ];

  const queryLower = query.toLowerCase();
  return currentKeywords.some((keyword) => queryLower.includes(keyword));
}

