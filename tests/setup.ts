import { vi, afterEach } from 'vitest';
import '@testing-library/jest-dom';
import React from 'react';
import { cleanup } from '@testing-library/react';

// Make React available globally for jsdom environment
(globalThis as any).React = React;

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock framer-motion to avoid animations in tests
vi.mock('framer-motion', async () => {
  const actual = await vi.importActual('framer-motion');
  return {
    ...actual,
    motion: {
      div: ({ children, ...props }: any) => React.createElement('div', props, children),
      span: ({ children, ...props }: any) => React.createElement('span', props, children),
      button: ({ children, ...props }: any) => React.createElement('button', props, children),
      form: ({ children, ...props }: any) => React.createElement('form', props, children),
    },
    AnimatePresence: ({ children }: any) => children,
  };
});

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  redirect: vi.fn(),
}));

// Mock next-auth
vi.mock('next-auth/react', () => ({
  useSession: vi.fn(() => ({ 
    data: { user: { id: 'test-user', email: 'test@test.com' } }, 
    status: 'authenticated' 
  })),
  signIn: vi.fn(),
  signOut: vi.fn(),
  SessionProvider: ({ children }: any) => children,
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => {
  const createIcon = (name: string, symbol: string) => 
    (props: any) => React.createElement('span', { 'data-testid': `${name}-icon`, ...props }, symbol);
  
  return {
    Check: createIcon('check', '✓'),
    X: createIcon('x', '✕'),
    Loader2: createIcon('loader', '⟳'),
    ChevronDown: createIcon('chevron-down', '▼'),
    ChevronUp: createIcon('chevron-up', '▲'),
    Search: createIcon('search', '🔍'),
    Eye: createIcon('eye', '👁'),
    EyeOff: createIcon('eye-off', '👁'),
    AlertCircle: createIcon('alert-circle', '⚠'),
    Info: createIcon('info', 'ℹ'),
    AlertTriangle: createIcon('alert-triangle', '⚠'),
    CheckCircle: createIcon('check-circle', '✓'),
    XCircle: createIcon('x-circle', '✕'),
  };
});

vi.mock('server-only', () => ({}));

// Mock missing modules
vi.mock('@/lib/file-processing', () => ({
  processFile: vi.fn().mockResolvedValue({ text: 'Processed content', metadata: {} }),
  extractText: vi.fn().mockResolvedValue('Extracted text'),
  validateFile: vi.fn().mockReturnValue(true),
}));

vi.mock('@/lib/vector-store', () => ({
  storeEmbeddings: vi.fn().mockResolvedValue({ success: true }),
  searchDocuments: vi.fn().mockResolvedValue([]),
  deleteDocumentEmbeddings: vi.fn().mockResolvedValue({ success: true }),
}));

// Note: @/lib/ai/token-counter is NOT mocked here.
// The token-counter.vitest.ts tests have their own tiktoken mock.

vi.mock('@/lib/analytics', () => ({
  trackEntitlementsUpdated: vi.fn(),
  trackBlockedAction: vi.fn(),
}));

vi.mock('@/lib/redis/client', () => {
  let client: any = null;
  return {
    getRedisClient: () => client,
    __setRedisClient: (next: any) => {
      client = next;
    },
    __getRedisClient: () => client,
  };
});

vi.mock('@/lib/db', () => {
  type UsageCounters = import('@/lib/entitlements').UsageCounters;

  const buildDefaultCounters = (): UsageCounters => ({
    uploads_total: 0,
    chats_today: 0,
    asr_minutes_month: 0,
    exports_month: 0,
    deep_runs_day: 0,
    personas_created: 0,
    memories_stored: 0,
    concurrent_sessions_active: 0,
    storage_used_mb: 0,
  });

  const state = {
    usageCounters: buildDefaultCounters(),
    entitlements: null as unknown,
  };
  const executed: string[] = [];

  const makeWhere = () => vi.fn(async () => undefined);

  const updateImpl = vi.fn(() => ({
    set: (values: {
      usageCounters?: UsageCounters;
      entitlements?: unknown;
    }) => {
      if (values.usageCounters) {
        state.usageCounters = { ...values.usageCounters };
      }
      if ('entitlements' in values) {
        state.entitlements = values.entitlements;
      }
      return { where: makeWhere() };
    },
  }));

  const selectImpl = vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn(async () => [{ usageCounters: state.usageCounters }]),
      })),
    })),
  }));

  const transaction = vi.fn(async (callback: (tx: any) => Promise<any>) => {
    const tx = {
      select: selectImpl,
      update: updateImpl,
    };
    return await callback(tx);
  });

  const execute = vi.fn(async (sql: string) => {
    executed.push(sql);
  });

  const db = {
    update: updateImpl,
    transaction,
    execute,
  };

  const reset = () => {
    state.usageCounters = buildDefaultCounters();
    state.entitlements = null;
    executed.length = 0;
    updateImpl.mockClear();
    selectImpl.mockClear();
    transaction.mockClear();
    execute.mockClear();
  };

  return {
    db,
    __dbMock: {
      state,
      executed,
      updateImpl,
      selectImpl,
      transaction,
      execute,
      reset,
    },
  };
});
