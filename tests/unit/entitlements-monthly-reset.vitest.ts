import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    execute: mocks.execute,
  },
}));

vi.mock('@/lib/db/schema', () => ({
  org: {
    id: 'org.id',
    name: 'org.name',
    plan: 'org.plan',
    limits: 'org.limits',
    seatCount: 'org.seatCount',
    stripeSubscriptionId: 'org.stripeSubscriptionId',
  },
  user: {
    id: 'user.id',
    plan: 'user.plan',
    orgId: 'user.orgId',
    usageCounters: 'user.usageCounters',
    entitlements: 'user.entitlements',
    stripeCustomerId: 'user.stripeCustomerId',
    email: 'user.email',
  },
}));

vi.mock('@/lib/analytics', () => ({
  trackEntitlementsUpdated: vi.fn(),
}));

vi.mock('@/lib/redis/client', () => ({
  getRedisClient: vi.fn(() => null),
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => ({ op: 'eq', args })),
}));

import { resetMonthlyUsageCounters } from '@/lib/entitlements';

describe('monthly usage reset', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resets both transcription and export monthly counters', async () => {
    await resetMonthlyUsageCounters();

    expect(mocks.execute).toHaveBeenCalledTimes(1);
    const sql = String(mocks.execute.mock.calls[0]?.[0] ?? '');
    expect(sql).toContain('{asr_minutes_month}');
    expect(sql).toContain('{exports_month}');
  });
});
