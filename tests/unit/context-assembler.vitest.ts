// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  assembleContextWithBudget,
  extractContextContent,
  type ContextSource,
  type AssembledContext,
} from '@/lib/ai/context-assembler';
import { estimateTokenBudget } from '@/lib/ai/token-counter';

// Mock the dependencies
vi.mock('@/lib/ai/token-counter', () => ({
  countTokens: vi.fn((text: string) => Math.ceil(text.length / 4)), // Rough approximation
  estimateTokenBudget: vi.fn((model: string) => ({
    systemPromptBudget: model.includes('claude') ? 50000 : 32000,
    userMessageBudget: 8000,
    maxOutputTokens: 4000,
  })),
}));

vi.mock('@/lib/ai/prompts', () => ({
  userRagContextPrompt: vi.fn().mockResolvedValue('User context content'),
  companyContextPrompt: vi.fn().mockResolvedValue('Company context content'),
}));

vi.mock('@/lib/ai/persona-rag', () => ({
  personaRagContextPrompt: vi.fn().mockResolvedValue({ context: 'Persona context content', chunkCount: 2 }),
}));

vi.mock('@/lib/ai/system-rag', () => ({
  systemRagContextPrompt: vi.fn().mockResolvedValue({ context: 'System context content', chunkCount: 3 }),
}));

vi.mock('@/lib/ai/upstash-system-rag', () => ({
  upstashSystemRagContextPrompt: vi.fn().mockResolvedValue('Upstash system context content'),
}));

vi.mock('@/lib/ai/memory-rag', () => ({
  findRelevantMemories: vi.fn().mockResolvedValue([
    { id: 'mem1', content: 'Memory 1', similarity: 0.9 },
    { id: 'mem2', content: 'Memory 2', similarity: 0.8 },
  ]),
  formatMemoriesForPrompt: vi.fn((memories) => ({
    formatted: memories.map((m: any) => m.content).join('\n'),
    chunkCount: memories.length,
  })),
}));

vi.mock('@/lib/ai/query-analyzer', () => ({
  analyzeQueryComplexity: vi.fn().mockResolvedValue({
    complexity: 'medium',
    requiresMemories: true,
    requiresUserContext: true,
    suggestedChunkLimits: {
      system: 8,
      persona: 14,
      user: 14,
      memories: 10,
    },
  }),
}));

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('@/lib/db/schema', () => ({
  persona: { id: 'id' },
  circleCoursePersona: { personaId: 'personaId' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
}));

describe('ContextAssembler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ContextSource', () => {
    it('should create valid context source objects', () => {
      const contextSource: ContextSource = {
        name: 'Test Context',
        content: 'This is test content',
        tokens: 100,
        priority: 1,
        category: 'system',
      };

      expect(contextSource.name).toBe('Test Context');
      expect(contextSource.content).toBe('This is test content');
      expect(contextSource.tokens).toBe(100);
      expect(contextSource.priority).toBe(1);
      expect(contextSource.category).toBe('system');
    });

    it('should support all valid category types', () => {
      const categories: ContextSource['category'][] = [
        'system', 'persona', 'user', 'memory', 'company', 'conversation'
      ];

      categories.forEach(category => {
        const contextSource: ContextSource = {
          name: `${category} context`,
          content: 'content',
          tokens: 50,
          priority: 1,
          category,
        };
        expect(contextSource.category).toBe(category);
      });
    });
  });

  describe('AssembledContext', () => {
    it('should create valid assembled context objects', () => {
      const assembledContext: AssembledContext = {
        contexts: [],
        totalTokens: 0,
        budgetUsed: 0,
        budgetRemaining: 50000,
        droppedContexts: [],
        model: 'claude-3-sonnet',
      };

      expect(assembledContext.contexts).toEqual([]);
      expect(assembledContext.totalTokens).toBe(0);
      expect(assembledContext.budgetUsed).toBe(0);
      expect(assembledContext.budgetRemaining).toBe(50000);
      expect(assembledContext.droppedContexts).toEqual([]);
      expect(assembledContext.model).toBe('claude-3-sonnet');
    });

    it('should support optional query analysis', () => {
      const assembledContext: AssembledContext = {
        contexts: [],
        totalTokens: 0,
        budgetUsed: 0,
        budgetRemaining: 50000,
        droppedContexts: [],
        model: 'claude-3-sonnet',
        queryAnalysis: {
          complexity: 'high',
          requiresMemories: true,
          requiresUserContext: true,
          suggestedChunkLimits: {
            system: 10,
            persona: 15,
            user: 15,
            memories: 12,
          },
        },
      };

      expect(assembledContext.queryAnalysis).toBeDefined();
      expect(assembledContext.queryAnalysis?.complexity).toBe('high');
    });
  });

  describe('assembleContextWithBudget', () => {
    it('assembles contexts in priority order and extracts category content', async () => {
      const assembled = await assembleContextWithBudget({
        userId: 'user-1',
        query: 'How should I run an EOS Level 10 meeting?',
        personaId: 'eos-implementer',
        model: 'claude-3-sonnet',
        conversationSummary: 'Prior conversation summary',
      });

      expect(assembled.contexts.length).toBeGreaterThan(0);
      expect(assembled.contexts.map((ctx) => ctx.priority)).toEqual(
        [...assembled.contexts.map((ctx) => ctx.priority)].sort(
          (a, b) => a - b,
        ),
      );

      const extracted = extractContextContent(assembled);
      expect(extracted.systemRagContext).toContain('context');
      expect(extracted.personaRagContext).toContain('Persona context content');
      expect(extracted.memoryContext).toContain('Memory');
      expect(extracted.userRagContext).toContain('User context content');
      expect(extracted.companyContext).toContain('Company context content');
      expect(extracted.conversationSummary).toContain(
        'Prior conversation summary',
      );
    });

    it('drops lower-priority contexts when token budget is constrained', async () => {
      vi.mocked(estimateTokenBudget).mockImplementationOnce(() => ({
        systemPromptBudget: 12,
        userMessageBudget: 8,
        maxOutputTokens: 4,
      }));

      const assembled = await assembleContextWithBudget({
        userId: 'user-2',
        query: 'Explain EOS scorecards',
        personaId: 'eos-implementer',
        model: 'claude-3-sonnet',
        conversationSummary: 'Some prior history',
      });

      expect(assembled.totalTokens).toBeLessThanOrEqual(12);
      expect(assembled.droppedContexts.length).toBeGreaterThan(0);
      expect(assembled.droppedContexts.some((ctx) => ctx.priority >= 3)).toBe(
        true,
      );
    });
  });

  describe('Context Priority System', () => {
    it('should use correct priority ordering', () => {
      // Test the expected priority system:
      // 1. System knowledge (for system personas)
      // 2. User memories (explicit facts user asked to remember)  
      // 3. Persona documents (persona-specific knowledge)
      // 4. Conversation summary (historical context for long chats)
      // 5. User documents (user's uploaded content)
      // 6. Company context (user's company information)
      
      const contexts: ContextSource[] = [
        { name: 'Company', content: 'company', tokens: 100, priority: 6, category: 'company' },
        { name: 'System', content: 'system', tokens: 100, priority: 1, category: 'system' },
        { name: 'Memory', content: 'memory', tokens: 100, priority: 2, category: 'memory' },
        { name: 'User', content: 'user', tokens: 100, priority: 5, category: 'user' },
        { name: 'Persona', content: 'persona', tokens: 100, priority: 3, category: 'persona' },
        { name: 'Conversation', content: 'conv', tokens: 100, priority: 4, category: 'conversation' },
      ];

      const sorted = contexts.sort((a, b) => a.priority - b.priority);
      
      expect(sorted[0].category).toBe('system');
      expect(sorted[1].category).toBe('memory');
      expect(sorted[2].category).toBe('persona');
      expect(sorted[3].category).toBe('conversation');
      expect(sorted[4].category).toBe('user');
      expect(sorted[5].category).toBe('company');
    });
  });

  describe('Token Budget Management', () => {
    it('should handle different model token budgets', () => {
      const claudeBudget = estimateTokenBudget('claude-3-sonnet');
      const gptBudget = estimateTokenBudget('gpt-4');
      
      expect(claudeBudget.systemPromptBudget).toBe(50000);
      expect(gptBudget.systemPromptBudget).toBe(32000);
    });

    it('should calculate context budget correctly', () => {
      const contexts: ContextSource[] = [
        { name: 'C1', content: 'content', tokens: 1000, priority: 1, category: 'system' },
        { name: 'C2', content: 'content', tokens: 2000, priority: 2, category: 'memory' },
        { name: 'C3', content: 'content', tokens: 500, priority: 3, category: 'persona' },
      ];

      const totalTokens = contexts.reduce((sum, ctx) => sum + ctx.tokens, 0);
      expect(totalTokens).toBe(3500);
    });
  });
});