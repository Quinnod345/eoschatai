import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  rows: new Map<string, any>(),
  nextId: 1,
  lastConflictTarget: null as any,
}));

const schemaMocks = vi.hoisted(() => ({
  userMemory: {
    id: 'userMemory.id',
    userId: 'userMemory.userId',
    sourceMessageId: 'userMemory.sourceMessageId',
    summary: 'userMemory.summary',
    content: 'userMemory.content',
    topic: 'userMemory.topic',
    memoryType: 'userMemory.memoryType',
    confidence: 'userMemory.confidence',
    status: 'userMemory.status',
    dedupeKey: 'userMemory.dedupeKey',
    updatedAt: 'userMemory.updatedAt',
  },
  userMemoryEmbedding: {
    memoryId: 'userMemoryEmbedding.memoryId',
    chunk: 'userMemoryEmbedding.chunk',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => ({ op: 'eq', args })),
  sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
    strings,
    values,
  })),
}));

vi.mock('@/lib/db/schema', () => schemaMocks);

vi.mock('@/lib/ai/embeddings', () => ({
  generateChunks: vi.fn(() => []),
  generateEmbeddings: vi.fn(async () => []),
}));

vi.mock('@/lib/db', () => ({
  db: {
    insert: vi.fn((table: unknown) => {
      if (table === schemaMocks.userMemory) {
        return {
          values: (values: any) => ({
            onConflictDoUpdate: ({ target }: { target: any[] }) => {
              state.lastConflictTarget = target;
              const key = `${values.userId}|${values.memoryType}|${values.status}|${values.dedupeKey}`;
              const existing = state.rows.get(key);

              if (existing) {
                const merged = {
                  ...existing,
                  ...values,
                  id: existing.id,
                  confidence: Math.max(
                    Number(existing.confidence ?? 0),
                    Number(values.confidence ?? 0),
                  ),
                };
                state.rows.set(key, merged);
                return {
                  returning: async () => [merged],
                };
              }

              const inserted = {
                ...values,
                id: `memory-${state.nextId++}`,
              };
              state.rows.set(key, inserted);
              return {
                returning: async () => [inserted],
              };
            },
          }),
        };
      }

      if (table === schemaMocks.userMemoryEmbedding) {
        return {
          values: async () => [],
        };
      }

      throw new Error('Unexpected insert table in test');
    }),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(async () => []),
      })),
    })),
  },
}));

import {
  buildMemoryDedupeKey,
  normalizeMemorySummary,
  saveUserMemory,
} from '@/lib/ai/memory';

describe('memory duplicate prevention', () => {
  beforeEach(() => {
    state.rows.clear();
    state.nextId = 1;
    state.lastConflictTarget = null;
  });

  it('normalizes summary and generates stable dedupe keys', () => {
    expect(normalizeMemorySummary('  User   likes   Froot   Loops  ')).toBe(
      'User likes Froot Loops',
    );
    expect(buildMemoryDedupeKey('  User   likes   Froot   Loops  ')).toBe(
      'user likes froot loops',
    );
  });

  it('returns one row for repeated identical memory saves', async () => {
    const first = await saveUserMemory({
      userId: 'user-1',
      summary: 'User likes Froot Loops cereal',
      memoryType: 'preference',
      confidence: 75,
    });

    const second = await saveUserMemory({
      userId: 'user-1',
      summary: '  user likes   froot loops cereal ',
      memoryType: 'preference',
      confidence: 80,
    });

    expect(first.id).toBe(second.id);
    expect(state.rows.size).toBe(1);
    expect([...state.rows.values()][0].dedupeKey).toBe(
      'user likes froot loops cereal',
    );
  });

  it('keeps concurrent duplicate saves idempotent via conflict target', async () => {
    const payload = {
      userId: 'user-2',
      summary: 'Company has 500 employees',
      memoryType: 'company' as const,
      confidence: 70,
    };

    const [a, b] = await Promise.all([
      saveUserMemory(payload),
      saveUserMemory(payload),
    ]);

    expect(a.id).toBe(b.id);
    expect(state.rows.size).toBe(1);
    expect(state.lastConflictTarget).toEqual([
      schemaMocks.userMemory.userId,
      schemaMocks.userMemory.memoryType,
      schemaMocks.userMemory.status,
      schemaMocks.userMemory.dedupeKey,
    ]);
  });

  it('preserves a higher confidence on conflict update path', async () => {
    await saveUserMemory({
      userId: 'user-3',
      summary: 'User likes apples',
      memoryType: 'preference',
      confidence: 60,
    });

    const updated = await saveUserMemory({
      userId: 'user-3',
      summary: 'User likes apples',
      memoryType: 'preference',
      confidence: 90,
    });

    expect(updated.confidence).toBe(90);
    expect(state.rows.size).toBe(1);
  });
});
