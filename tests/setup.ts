import { vi } from 'vitest';

vi.mock('server-only', () => ({}));

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
