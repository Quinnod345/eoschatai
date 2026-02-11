import { countTokens, estimateTokenBudget } from './token-counter';
import { userRagContextPrompt } from './prompts';
import { personaRagContextPrompt } from './persona-rag';
import { systemRagContextPrompt } from './system-rag';
import { upstashSystemRagContextPrompt } from './upstash-system-rag';
import { getOrgRagContextWithMetadata } from './org-rag-context';
import { findRelevantMemories, formatMemoriesForPrompt } from './memory-rag';
import { analyzeQueryComplexity, type QueryAnalysis } from './query-analyzer';

export interface ContextSource {
  name: string;
  content: string;
  tokens: number;
  priority: number; // Lower = higher priority
  category:
    | 'system'
    | 'persona'
    | 'user'
    | 'org'
    | 'memory'
    | 'company'
    | 'conversation';
}

export interface AssembledContext {
  contexts: ContextSource[];
  totalTokens: number;
  budgetUsed: number;
  budgetRemaining: number;
  droppedContexts: ContextSource[];
  model: string;
  queryAnalysis?: QueryAnalysis;
}

/**
 * Assemble context with intelligent token budget management
 * @param options - Context assembly options
 * @returns Assembled context with budget tracking
 */
export async function assembleContextWithBudget(options: {
  userId: string;
  orgId?: string;
  query: string;
  personaId?: string;
  profileId?: string;
  model: string;
  composerDocumentId?: string;
  conversationSummary?: string;
  useAdaptiveLimits?: boolean;
}): Promise<AssembledContext> {
  const {
    userId,
    orgId,
    query,
    personaId,
    profileId,
    model,
    composerDocumentId,
    conversationSummary,
    useAdaptiveLimits = true,
  } = options;

  console.log(`Context Assembler: Starting for model ${model}`);

  // Analyze query complexity for adaptive limits
  let queryAnalysis: QueryAnalysis | undefined;
  let chunkLimits = {
    system: 8,
    persona: 14,
    user: 14,
    memories: 10,
  };

  if (useAdaptiveLimits && query) {
    queryAnalysis = await analyzeQueryComplexity(query);
    chunkLimits = queryAnalysis.suggestedChunkLimits;
    
    console.log(
      `Context Assembler: Query complexity: ${queryAnalysis.complexity}`,
    );
    console.log(
      `Context Assembler: Adaptive limits - System: ${chunkLimits.system}, Persona: ${chunkLimits.persona}, User: ${chunkLimits.user}, Memories: ${chunkLimits.memories}`,
    );
  }

  const budget = estimateTokenBudget(model);
  let remainingBudget = budget.systemPromptBudget;

  const contexts: ContextSource[] = [];
  const droppedContexts: ContextSource[] = [];

  // Priority order (lower number = higher priority):
  // 1. System knowledge (for system personas)
  // 2. User memories (explicit facts user asked to remember)
  // 3. Persona documents (persona-specific knowledge)
  // 4. Conversation summary (historical context for long chats)
  // 5. User documents (user's uploaded content)
  // 6. Org documents (organization shared knowledge)
  // 7. Company context (user's company information)

  try {
    // 1. System RAG (Highest priority for system personas)
    if (personaId) {
      console.log(
        `Context Assembler: Retrieving system knowledge for persona ${personaId}`,
      );

      let systemRagContent = '';

      // Check for hardcoded EOS implementer
      if (personaId === 'eos-implementer') {
        systemRagContent = await upstashSystemRagContextPrompt(
          profileId || null,
          query,
        );
      } else {
        // Check if it's a system persona via database
        const { db } = await import('@/lib/db');
        const { persona, circleCoursePersona } = await import('@/lib/db/schema');
        const { eq } = await import('drizzle-orm');

        const [personaData] = await db
          .select()
          .from(persona)
          .where(eq(persona.id, personaId))
          .limit(1);

        if (personaData?.isSystemPersona) {
          // Check if this is a Circle.so course persona
          const [coursePersona] = await db
            .select()
            .from(circleCoursePersona)
            .where(eq(circleCoursePersona.personaId, personaId))
            .limit(1);

          // Course personas and other system personas use PostgreSQL
          const systemRagResult = await systemRagContextPrompt(
            personaId,
            profileId || null,
            query,
          );
          systemRagContent = systemRagResult.context;
        }
      }

      if (systemRagContent.length > 0) {
        const tokens = countTokens(systemRagContent, model);
        contexts.push({
          name: 'System Knowledge',
          content: systemRagContent,
          tokens,
          priority: 1,
          category: 'system',
        });
        console.log(
          `Context Assembler: System knowledge - ${tokens} tokens (Priority 1)`,
        );
      }
    }

    // 2. User Memories (High priority)
    if (!queryAnalysis || queryAnalysis.requiresMemories) {
      console.log(`Context Assembler: Retrieving user memories (limit: ${chunkLimits.memories})`);
      const memories = await findRelevantMemories(
        userId,
        query,
        chunkLimits.memories,
        0.5,
      );
      if (memories.length > 0) {
        const memoryResult = formatMemoriesForPrompt(memories);
        const memoryContent = memoryResult.formatted;
        const tokens = countTokens(memoryContent, model);
        contexts.push({
          name: 'User Memories',
          content: memoryContent,
          tokens,
          priority: 2,
          category: 'memory',
        });
        console.log(
          `Context Assembler: Memories - ${tokens} tokens (Priority 2)`,
        );
      }
    } else {
      console.log(
        `Context Assembler: Skipping memory retrieval (not required for query)`,
      );
    }

    // 3. Persona Documents (High priority)
    if (personaId) {
      console.log(`Context Assembler: Retrieving persona documents`);
      const personaRagResult = await personaRagContextPrompt(
        personaId,
        query,
        userId,
      );
      const personaRagContent = personaRagResult.context;
      if (personaRagContent.length > 0) {
        const tokens = countTokens(personaRagContent, model);
        contexts.push({
          name: 'Persona Documents',
          content: personaRagContent,
          tokens,
          priority: 3,
          category: 'persona',
        });
        console.log(
          `Context Assembler: Persona documents - ${tokens} tokens (Priority 3)`,
        );
      }
    }

    // 4. Conversation Summary (Medium priority)
    if (conversationSummary && conversationSummary.length > 0) {
      const tokens = countTokens(conversationSummary, model);
      contexts.push({
        name: 'Conversation History',
        content: conversationSummary,
        tokens,
        priority: 4,
        category: 'conversation',
      });
      console.log(
        `Context Assembler: Conversation summary - ${tokens} tokens (Priority 4)`,
      );
    }

    // 5. User Documents (Medium-low priority)
    if (!queryAnalysis || queryAnalysis.requiresUserContext) {
      console.log(`Context Assembler: Retrieving user documents`);
      const userRagContent = await userRagContextPrompt(userId, query);
      if (userRagContent.length > 0) {
        const tokens = countTokens(userRagContent, model);
        contexts.push({
          name: 'User Documents',
          content: userRagContent,
          tokens,
          priority: 5,
          category: 'user',
        });
        console.log(
          `Context Assembler: User documents - ${tokens} tokens (Priority 5)`,
        );
      }
    } else {
      console.log(
        `Context Assembler: Skipping user document retrieval (not required for query)`,
      );
    }

    // 6. Organization Knowledge (Medium-low priority)
    if (orgId && (!queryAnalysis || queryAnalysis.requiresUserContext)) {
      console.log(`Context Assembler: Retrieving org knowledge`);
      const orgRagResult = await getOrgRagContextWithMetadata(orgId, query);
      if (orgRagResult.context.length > 0) {
        const tokens = countTokens(orgRagResult.context, model);
        contexts.push({
          name: 'Organization Knowledge',
          content: orgRagResult.context,
          tokens,
          priority: 6,
          category: 'org',
        });
        console.log(
          `Context Assembler: Org knowledge - ${tokens} tokens (Priority 6)`,
        );
      }
    }

    // 7. Company Context (Lowest priority)
    const { companyContextPrompt } = await import('./prompts');
    const companyContent = await companyContextPrompt(userId);
    if (companyContent.length > 0) {
      const tokens = countTokens(companyContent, model);
      contexts.push({
        name: 'Company Information',
        content: companyContent,
        tokens,
        priority: 7,
        category: 'company',
      });
      console.log(
        `Context Assembler: Company context - ${tokens} tokens (Priority 7)`,
      );
    }
  } catch (error) {
    console.error('Context Assembler: Error retrieving contexts:', error);
  }

  // Sort by priority (lower number = higher priority)
  contexts.sort((a, b) => a.priority - b.priority);

  // Fit contexts within budget
  const included: ContextSource[] = [];
  const totalTokensBefore = contexts.reduce((sum, ctx) => sum + ctx.tokens, 0);

  console.log(
    `Context Assembler: Total context before budget: ${totalTokensBefore} tokens`,
  );
  console.log(
    `Context Assembler: Available budget: ${remainingBudget} tokens`,
  );

  for (const ctx of contexts) {
    if (ctx.tokens <= remainingBudget) {
      // Context fits - include it
      included.push(ctx);
      remainingBudget -= ctx.tokens;
      console.log(
        `Context Assembler: ✓ Included "${ctx.name}" (${ctx.tokens} tokens, ${remainingBudget} remaining)`,
      );
    } else if (ctx.priority <= 2) {
      // High priority context doesn't fit - try to compress
      console.log(
        `Context Assembler: ⚠ "${ctx.name}" too large (${ctx.tokens} tokens), attempting compression...`,
      );

      try {
        const { compressContext } = await import('./context-compressor');
        const compressed = await compressContext(ctx.content, remainingBudget);
        const compressedTokens = countTokens(compressed, model);

        if (compressedTokens <= remainingBudget) {
          included.push({
            ...ctx,
            content: compressed,
            tokens: compressedTokens,
          });
          remainingBudget -= compressedTokens;
          console.log(
            `Context Assembler: ✓ Compressed "${ctx.name}" (${ctx.tokens} → ${compressedTokens} tokens)`,
          );
        } else {
          droppedContexts.push(ctx);
          console.log(
            `Context Assembler: ✗ Dropped "${ctx.name}" (even compressed: ${compressedTokens} tokens)`,
          );
        }
      } catch (error) {
        console.error(
          `Context Assembler: Compression failed for "${ctx.name}":`,
          error,
        );
        droppedContexts.push(ctx);
      }
    } else {
      // Lower priority context doesn't fit - drop it
      droppedContexts.push(ctx);
      console.log(
        `Context Assembler: ✗ Dropped "${ctx.name}" (${ctx.tokens} tokens exceeds budget)`,
      );
    }
  }

  const totalTokens = included.reduce((sum, ctx) => sum + ctx.tokens, 0);
  const budgetUsed = (totalTokens / budget.systemPromptBudget) * 100;

  console.log(`Context Assembler: Final summary:`);
  console.log(`  - Included contexts: ${included.length}`);
  console.log(`  - Dropped contexts: ${droppedContexts.length}`);
  console.log(`  - Total tokens: ${totalTokens}`);
  console.log(`  - Budget used: ${budgetUsed.toFixed(1)}%`);
  console.log(`  - Remaining: ${remainingBudget} tokens`);

  if (queryAnalysis) {
    console.log(
      `  - Query complexity: ${queryAnalysis.complexity} - ${queryAnalysis.reasoningText}`,
    );
  }

  return {
    contexts: included,
    totalTokens,
    budgetUsed,
    budgetRemaining: remainingBudget,
    droppedContexts,
    model,
    queryAnalysis,
  };
}

/**
 * Extract content from assembled contexts by category
 * @param assembled - Assembled context result
 * @returns Content strings by category
 */
export function extractContextContent(assembled: AssembledContext): {
  systemRagContext: string;
  personaRagContext: string;
  userRagContext: string;
  orgRagContext: string;
  memoryContext: string;
  companyContext: string;
  conversationSummary: string;
} {
  const findContent = (category: ContextSource['category']) =>
    assembled.contexts.find((ctx) => ctx.category === category)?.content || '';

  return {
    systemRagContext: findContent('system'),
    personaRagContext: findContent('persona'),
    userRagContext: findContent('user'),
    orgRagContext: findContent('org'),
    memoryContext: findContent('memory'),
    companyContext: findContent('company'),
    conversationSummary: findContent('conversation'),
  };
}

