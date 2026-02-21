import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  dbSelect: vi.fn(),
  recentRows: [] as any[],
}));

vi.mock('@/lib/db', () => ({
  db: {
    select: mocks.dbSelect,
  },
}));

vi.mock('@/lib/db/schema', () => ({
  userMemory: {
    id: 'userMemory.id',
    userId: 'userMemory.userId',
    summary: 'userMemory.summary',
    content: 'userMemory.content',
    memoryType: 'userMemory.memoryType',
    confidence: 'userMemory.confidence',
    topic: 'userMemory.topic',
    createdAt: 'userMemory.createdAt',
    status: 'userMemory.status',
    expiresAt: 'userMemory.expiresAt',
  },
  userMemoryEmbedding: {
    embedding: 'userMemoryEmbedding.embedding',
    memoryId: 'userMemoryEmbedding.memoryId',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => ({ op: 'eq', args })),
  and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
  or: vi.fn((...args: unknown[]) => ({ op: 'or', args })),
  isNull: vi.fn((...args: unknown[]) => ({ op: 'isNull', args })),
  sql: vi.fn((...args: unknown[]) => ({ op: 'sql', args })),
}));

vi.mock('@ai-sdk/openai', () => ({
  openai: {
    embedding: vi.fn(() => 'mock-embedding-model'),
  },
}));

vi.mock('ai', () => ({
  embed: vi.fn(async () => ({ embedding: [0.1, 0.2, 0.3] })),
}));

import {
  findRelevantMemories,
  formatMemoriesForPrompt,
  getRecentMemories,
} from '@/lib/ai/memory-rag';

function mockRecentMemoryQuery() {
  return {
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        orderBy: vi.fn(() => ({
          limit: vi.fn(async () => mocks.recentRows),
        })),
      })),
    })),
  };
}

describe('memory rag provenance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.recentRows = [];
    mocks.dbSelect.mockImplementation(() => mockRecentMemoryQuery());
  });

  it('formats memory IDs and source counts for prompt metadata', () => {
    const result = formatMemoriesForPrompt([
      {
        id: 'm-semantic',
        summary: 'Semantic memory',
        content: 'Semantic memory content',
        memoryType: 'company',
        confidence: 90,
        topic: 'vision',
        relevance: 0.86,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        retrievalSource: 'semantic',
        similarity: 0.81,
      },
      {
        id: 'm-recent',
        summary: 'Recent memory',
        content: 'Recent memory content',
        memoryType: 'preference',
        confidence: 70,
        topic: null,
        relevance: 0,
        createdAt: new Date('2026-01-02T00:00:00.000Z'),
        retrievalSource: 'recent',
        similarity: null,
      },
      {
        id: 'm-unembedded',
        summary: 'Unembedded memory',
        content: null,
        memoryType: 'knowledge',
        confidence: 60,
        topic: null,
        relevance: 0.35,
        createdAt: new Date('2026-01-03T00:00:00.000Z'),
        retrievalSource: 'unembedded',
        similarity: null,
      },
    ]);

    expect(result.chunkCount).toBe(3);
    expect(result.memoryIds).toEqual(['m-semantic', 'm-recent', 'm-unembedded']);
    expect(result.sourceCounts).toEqual({
      semantic: 1,
      recent: 1,
      unembedded: 1,
    });
    expect(result.formatted).toContain('## USER MEMORIES');
  });

  it('counts semantic-fallback retrieval under semantic provenance', () => {
    const result = formatMemoriesForPrompt([
      {
        id: 'm-fallback',
        summary: 'Fallback semantic memory',
        content: null,
        memoryType: 'context',
        confidence: 80,
        topic: null,
        relevance: 0.52,
        createdAt: new Date('2026-02-01T00:00:00.000Z'),
        retrievalSource: 'semantic-fallback',
        similarity: 0.41,
      },
    ]);

    expect(result.sourceCounts).toEqual({
      semantic: 1,
      recent: 0,
      unembedded: 0,
    });
  });

  it('marks recency retrieval as non-semantic provenance', async () => {
    mocks.recentRows = [
      {
        id: 'recent-1',
        summary: 'Recent memory one',
        content: 'Recent memory content',
        memoryType: 'knowledge',
        confidence: 75,
        topic: null,
        createdAt: new Date('2026-02-01T00:00:00.000Z'),
      },
    ];

    const memories = await getRecentMemories('user-1', 5);

    expect(memories).toHaveLength(1);
    expect(memories[0].retrievalSource).toBe('recent');
    expect(memories[0].similarity).toBeNull();
    expect(memories[0].relevance).toBe(0);
  });

  it('returns an empty list when memory retrieval throws', async () => {
    mocks.dbSelect.mockImplementation(() => {
      throw new Error('db unavailable');
    });

    const memories = await findRelevantMemories('user-1', 'test query', 5, 0.5);
    expect(memories).toEqual([]);
  });
});
