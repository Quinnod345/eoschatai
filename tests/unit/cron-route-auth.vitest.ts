import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resetDailyUsageCounters: vi.fn(),
  resetMonthlyUsageCounters: vi.fn(),
  scanSubscriptionHealth: vi.fn(),
  autoFixSubscriptionIssues: vi.fn(),
  sendGracePeriodReminders: vi.fn(),
  cleanupExpiredGracePeriods: vi.fn(),
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

vi.mock('@/lib/entitlements', () => ({
  resetDailyUsageCounters: mocks.resetDailyUsageCounters,
  resetMonthlyUsageCounters: mocks.resetMonthlyUsageCounters,
}));

vi.mock('@/lib/billing/subscription-health', () => ({
  scanSubscriptionHealth: mocks.scanSubscriptionHealth,
  autoFixSubscriptionIssues: mocks.autoFixSubscriptionIssues,
}));

vi.mock('@/lib/billing/grace-period', () => ({
  sendGracePeriodReminders: mocks.sendGracePeriodReminders,
  cleanupExpiredGracePeriods: mocks.cleanupExpiredGracePeriods,
}));

import {
  POST as dailyCronPost,
  GET as dailyCronGet,
} from '@/app/api/cron/usage/daily/route';
import {
  POST as monthlyCronPost,
  GET as monthlyCronGet,
} from '@/app/api/cron/usage/monthly/route';
import { GET as subscriptionHealthCron } from '@/app/api/cron/subscription-health-check/route';
import { GET as gracePeriodCron } from '@/app/api/cron/grace-period-reminders/route';

describe('cron route auth hardening', () => {
  const originalCronSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = '';
  });

  afterEach(() => {
    if (typeof originalCronSecret === 'string') {
      process.env.CRON_SECRET = originalCronSecret;
    } else {
      process.env.CRON_SECRET = '';
    }
  });

  it('rejects cron requests when CRON_SECRET is missing', async () => {
    const [dailyRes, monthlyRes, subscriptionRes, graceRes] = await Promise.all(
      [
        dailyCronPost(
          new Request('http://localhost/api/cron/usage/daily', {
            method: 'POST',
          }) as any,
        ),
        monthlyCronPost(
          new Request('http://localhost/api/cron/usage/monthly', {
            method: 'POST',
          }) as any,
        ),
        subscriptionHealthCron(
          new Request('http://localhost/api/cron/subscription-health-check'),
        ),
        gracePeriodCron(
          new Request('http://localhost/api/cron/grace-period-reminders'),
        ),
      ],
    );

    expect(dailyRes.status).toBe(401);
    expect(monthlyRes.status).toBe(401);
    expect(subscriptionRes.status).toBe(401);
    expect(graceRes.status).toBe(401);

    expect(mocks.resetDailyUsageCounters).not.toHaveBeenCalled();
    expect(mocks.resetMonthlyUsageCounters).not.toHaveBeenCalled();
    expect(mocks.scanSubscriptionHealth).not.toHaveBeenCalled();
    expect(mocks.sendGracePeriodReminders).not.toHaveBeenCalled();
  });

  it('rejects cron requests when bearer token mismatches CRON_SECRET', async () => {
    process.env.CRON_SECRET = 'expected-secret';

    const headers = { authorization: 'Bearer wrong-secret' };
    const [dailyRes, monthlyRes, subscriptionRes, graceRes] = await Promise.all(
      [
        dailyCronPost(
          new Request('http://localhost/api/cron/usage/daily', {
            method: 'POST',
            headers,
          }) as any,
        ),
        monthlyCronPost(
          new Request('http://localhost/api/cron/usage/monthly', {
            method: 'POST',
            headers,
          }) as any,
        ),
        subscriptionHealthCron(
          new Request('http://localhost/api/cron/subscription-health-check', {
            headers,
          }),
        ),
        gracePeriodCron(
          new Request('http://localhost/api/cron/grace-period-reminders', {
            headers,
          }),
        ),
      ],
    );

    expect(dailyRes.status).toBe(401);
    expect(monthlyRes.status).toBe(401);
    expect(subscriptionRes.status).toBe(401);
    expect(graceRes.status).toBe(401);

    expect(mocks.resetDailyUsageCounters).not.toHaveBeenCalled();
    expect(mocks.resetMonthlyUsageCounters).not.toHaveBeenCalled();
    expect(mocks.scanSubscriptionHealth).not.toHaveBeenCalled();
    expect(mocks.sendGracePeriodReminders).not.toHaveBeenCalled();
  });

  it('accepts authenticated GET requests for usage cron routes', async () => {
    process.env.CRON_SECRET = 'expected-secret';

    const headers = { authorization: 'Bearer expected-secret' };
    const [dailyRes, monthlyRes] = await Promise.all([
      dailyCronGet(
        new Request('http://localhost/api/cron/usage/daily', {
          method: 'GET',
          headers,
        }) as any,
      ),
      monthlyCronGet(
        new Request('http://localhost/api/cron/usage/monthly', {
          method: 'GET',
          headers,
        }) as any,
      ),
    ]);

    expect(dailyRes.status).toBe(200);
    expect(monthlyRes.status).toBe(200);
    expect(mocks.resetDailyUsageCounters).toHaveBeenCalledTimes(1);
    expect(mocks.resetMonthlyUsageCounters).toHaveBeenCalledTimes(1);
  });

  it('returns reset_count from the daily cron endpoint', async () => {
    process.env.CRON_SECRET = 'expected-secret';
    mocks.resetDailyUsageCounters.mockResolvedValueOnce(7);

    const res = await dailyCronPost(
      new Request('http://localhost/api/cron/usage/daily', {
        method: 'POST',
        headers: { authorization: 'Bearer expected-secret' },
      }) as any,
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.reset_count).toBe(7);
  });
});
