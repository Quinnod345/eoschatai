// @ts-nocheck
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

import {
  computeEntitlements,
  defaultUsageCounters,
  incrementUsageCounter,
  reserveDeepResearchSlot,
  resetDailyUsageCounters,
  resetMonthlyUsageCounters,
} from '@/lib/entitlements';
import { PLAN_VERSION } from '@/lib/entitlements/constants';
import { __dbMock } from '@/lib/db';
import { __setRedisClient } from '@/lib/redis/client';

describe('computeEntitlements', () => {
  it('returns the correct baseline features for each plan', () => {
    const free = computeEntitlements('free');
    const pro = computeEntitlements('pro');
    const business = computeEntitlements('business');

    expect(free.features.export).toBe(false);
    expect(free.features.chats_per_day).toBe(20);
    expect(pro.features.export).toBe(true);
    expect(pro.features.recordings.minutes_month).toBeGreaterThan(0);
    expect(business.features.deep_research.lookups_per_run).toBeGreaterThan(
      pro.features.deep_research.lookups_per_run,
    );

    [free, pro, business].forEach((entry) => {
      expect(entry.plan_version).toBe(PLAN_VERSION);
      expect(entry.source).toMatch(/^plan:/);
    });
  });

  it('applies overrides without mutating baseline definitions', () => {
    const override = computeEntitlements('free', {
      recordings: { 
        enabled: true, 
        minutes_month: 45,
        transcription: true,
        speaker_diarization: true,
        ai_summaries: true,
      },
      deep_research: { enabled: true, lookups_per_run: 8 },
    });

    expect(override.features.recordings.enabled).toBe(true);
    expect(override.features.recordings.minutes_month).toBe(45);
    expect(override.features.deep_research.enabled).toBe(true);
    expect(override.features.deep_research.lookups_per_run).toBe(8);

    const fresh = computeEntitlements('free');
    expect(fresh.features.recordings.enabled).toBe(false);
    expect(fresh.features.recordings.minutes_month).toBe(0);
  });
});

describe('usage counters', () => {
  beforeEach(() => {
    __dbMock.reset();
    __setRedisClient(null);
  });

  it('increments counters and persists the new value', async () => {
    __dbMock.state.usageCounters = {
      ...defaultUsageCounters(),
      exports_month: 2,
    };

    const updated = await incrementUsageCounter('user-1', 'exports_month', 3);

    expect(updated.exports_month).toBe(5);
    expect(__dbMock.state.usageCounters.exports_month).toBe(5);
    expect(__dbMock.updateImpl).toHaveBeenCalled();
  });

  it('clamps decrements so counters never drop below zero', async () => {
    __dbMock.state.usageCounters = {
      ...defaultUsageCounters(),
      chats_today: 1,
    };

    const updated = await incrementUsageCounter('user-1', 'chats_today', -5);

    expect(updated.chats_today).toBe(0);
    expect(__dbMock.state.usageCounters.chats_today).toBe(0);
  });

  it('emits the expected SQL when resetting daily counters', async () => {
    await resetDailyUsageCounters();

    expect(__dbMock.execute).toHaveBeenCalledTimes(1);
    const sql = __dbMock.executed.at(0) ?? '';
    expect(sql).toContain('chats_today');
    expect(sql).toContain('deep_runs_day');
  });

  it('emits the expected SQL when resetting monthly counters', async () => {
    await resetMonthlyUsageCounters();

    expect(__dbMock.execute).toHaveBeenCalledTimes(1);
    const sql = __dbMock.executed.at(0) ?? '';
    expect(sql).toContain('asr_minutes_month');
  });
});

describe('deep research reservations', () => {
  beforeEach(() => {
    __dbMock.reset();
    __setRedisClient(null);
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('enforces concurrency limits and refills tokens after cooldown', async () => {
    const first = await reserveDeepResearchSlot('user-123', 2);
    const second = await reserveDeepResearchSlot('user-123', 2);
    const third = await reserveDeepResearchSlot('user-123', 2);

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(third.allowed).toBe(false);
    expect(third.retryInMs).toBeGreaterThanOrEqual(0);

    await first.release();
    await second.release();

    vi.advanceTimersByTime(20_000);

    const fourth = await reserveDeepResearchSlot('user-123', 2);
    expect(fourth.allowed).toBe(true);
    await fourth.release();
  });
});
