import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  dbSelect: vi.fn(),
  selectQueue: [] as Array<() => any>,
  contextLog: null as any,
  memoryRows: [] as any[],
}));

vi.mock('next/server', () => ({
  NextResponse: {
    json: (data: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(data), {
        status: init?.status ?? 200,
        headers: {
          'Content-Type': 'application/json',
          ...(init?.headers || {}),
        },
      }),
  },
}));

vi.mock('@/app/(auth)/auth', () => ({
  auth: mocks.auth,
}));

vi.mock('@/lib/db', () => ({
  db: {
    select: mocks.dbSelect,
  },
}));

vi.mock('@/lib/db/schema', () => ({
  contextUsageLog: {
    messageId: 'contextUsageLog.messageId',
  },
  userDocuments: {
    id: 'userDocuments.id',
    fileName: 'userDocuments.fileName',
    category: 'userDocuments.category',
  },
  orgDocument: {
    id: 'orgDocument.id',
    fileName: 'orgDocument.fileName',
  },
  persona: {
    id: 'persona.id',
    name: 'persona.name',
  },
  personaProfile: {
    id: 'personaProfile.id',
    name: 'personaProfile.name',
  },
  userMemory: {
    id: 'userMemory.id',
    userId: 'userMemory.userId',
    summary: 'userMemory.summary',
    content: 'userMemory.content',
    memoryType: 'userMemory.memoryType',
    createdAt: 'userMemory.createdAt',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => ({ op: 'eq', args })),
  and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
  inArray: vi.fn((...args: unknown[]) => ({ op: 'inArray', args })),
  desc: vi.fn((...args: unknown[]) => ({ op: 'desc', args })),
}));

import { GET as getContextSources } from '@/app/api/messages/[id]/context-sources/route';

function queueContextLogSelect() {
  return {
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn(async () => [mocks.contextLog]),
      })),
    })),
  };
}

function queueTrackedMemorySelect() {
  return {
    from: vi.fn(() => ({
      where: vi.fn(async () => mocks.memoryRows),
    })),
  };
}

function queueFallbackMemorySelect() {
  return {
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        orderBy: vi.fn(() => ({
          limit: vi.fn(async () => mocks.memoryRows),
        })),
      })),
    })),
  };
}

describe('context sources memory fidelity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.selectQueue = [];
    mocks.contextLog = null;
    mocks.memoryRows = [];

    mocks.auth.mockResolvedValue({ user: { id: 'session-user' } });
    mocks.dbSelect.mockImplementation(() => {
      const next = mocks.selectQueue.shift();
      if (!next) {
        throw new Error('No queued db.select mock for this call');
      }
      return next();
    });
  });

  it('shows only tracked memory IDs in logged order', async () => {
    mocks.contextLog = {
      userId: 'session-user',
      userChunks: 0,
      personaChunks: 0,
      systemChunks: 0,
      memoryChunks: 2,
      conversationSummaryUsed: false,
      contextTokens: 123,
      model: 'claude-sonnet',
      metadata: {
        memoryIds: ['mem-2', 'mem-1'],
        memorySourceCounts: { semantic: 1, recent: 1, unembedded: 0 },
      },
    };
    mocks.memoryRows = [
      {
        id: 'mem-1',
        summary: 'First memory',
        content: 'First memory content',
        memoryType: 'company',
      },
      {
        id: 'mem-2',
        summary: 'Second memory',
        content: 'Second memory content',
        memoryType: 'preference',
      },
    ];
    mocks.selectQueue.push(queueContextLogSelect, queueTrackedMemorySelect);

    const response = await getContextSources(
      new Request('http://localhost/api/messages/msg-1/context-sources') as any,
      { params: Promise.resolve({ id: 'msg-1' }) },
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    const memorySource = payload.sources.find((s: any) => s.type === 'memory');

    expect(memorySource.label).toBe('Your Memories');
    expect(memorySource.description).toContain('Retrieved for response context');
    expect(memorySource.description).toContain('semantic: 1, recent: 1');
    expect(memorySource.items.map((item: any) => item.id)).toEqual([
      'mem-2',
      'mem-1',
    ]);
  });

  it('labels legacy fallback when memory IDs were not tracked', async () => {
    mocks.contextLog = {
      userId: 'session-user',
      userChunks: 0,
      personaChunks: 0,
      systemChunks: 0,
      memoryChunks: 1,
      conversationSummaryUsed: false,
      contextTokens: 90,
      model: 'claude-sonnet',
      metadata: {},
    };
    mocks.memoryRows = [
      {
        id: 'mem-latest',
        summary: 'Latest memory',
        content: 'Latest memory content',
        memoryType: 'knowledge',
      },
    ];
    mocks.selectQueue.push(queueContextLogSelect, queueFallbackMemorySelect);

    const response = await getContextSources(
      new Request('http://localhost/api/messages/msg-2/context-sources') as any,
      { params: Promise.resolve({ id: 'msg-2' }) },
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    const memorySource = payload.sources.find((s: any) => s.type === 'memory');

    expect(memorySource.label).toBe('Recent Memory Context (fallback)');
    expect(memorySource.description).toContain(
      'Exact memory IDs were not tracked for this older response.',
    );
    expect(memorySource.items).toHaveLength(1);
    expect(memorySource.items[0].id).toBe('mem-latest');
  });
});
