import 'server-only';

import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import {
  type Org,
  type PlanType,
  type User,
  org,
  user,
} from '@/lib/db/schema';
import { trackEntitlementsUpdated } from '@/lib/analytics';
import { getRedisClient } from '@/lib/redis/client';
import { PLAN_VERSION } from './constants';
import type {
  FeatureEntitlements,
  NormalizedEntitlements,
  UsageCounters,
  UsageCounterKey,
} from './types';

export type {
  FeatureEntitlements,
  NormalizedEntitlements,
  UsageCounters,
  UsageCounterKey,
} from './types';

const DEFAULT_USAGE_COUNTERS: UsageCounters = {
  uploads_total: 0,
  chats_today: 0,
  asr_minutes_month: 0,
  exports_month: 0,
  deep_runs_day: 0,
};

const BASE_FEATURES: Record<PlanType, FeatureEntitlements> = {
  free: {
    export: false,
    calendar_connect: false,
    recordings: { enabled: false, minutes_month: 0 },
    deep_research: { enabled: false, lookups_per_run: 0 },
    chats_per_day: 20,
    context_uploads_total: 5,
  },
  pro: {
    export: true,
    calendar_connect: true,
    recordings: { enabled: true, minutes_month: 600 },
    deep_research: { enabled: true, lookups_per_run: 20 },
    chats_per_day: 200,
    context_uploads_total: 100,
  },
  business: {
    export: true,
    calendar_connect: true,
    recordings: { enabled: true, minutes_month: 3000 },
    deep_research: { enabled: true, lookups_per_run: 40 },
    chats_per_day: 1000,
    context_uploads_total: 1000,
  },
};

const ENTITLEMENTS_CACHE_TTL_SECONDS = 60 * 10; // 10 minutes

const DEEP_RESEARCH_REFILL_MS = 20_000;
const DEEP_RESEARCH_BUCKET_TTL_MS = 5 * 60 * 1000;

type MemoryBucketState = {
  tokens: number;
  lastRefill: number;
  active: number;
};

const getMemoryBuckets = () => {
  const globalAny = globalThis as Record<string, unknown>;
  const key = '__entitlementsDeepResearchBuckets';
  const current = globalAny[key];
  if (!(current instanceof Map)) {
    const map = new Map<string, MemoryBucketState>();
    globalAny[key] = map;
    return map;
  }

  return current as Map<string, MemoryBucketState>;
};

const buildCacheKey = (userId: string) => `entitlements:${userId}:${PLAN_VERSION}`;

const clone = <T>(value: T): T => {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
};

const deepMerge = <T extends Record<string, any>>(base: T, overrides?: Partial<T>): T => {
  if (!overrides) return clone(base);
  const result = clone(base);
  const target = result as Record<string, any>;
  const source = overrides as Record<string, any>;

  for (const [key, value] of Object.entries(source)) {
    if (value === undefined) continue;
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      typeof target[key] === 'object' &&
      target[key] !== null
    ) {
      target[key] = deepMerge(target[key] as Record<string, any>, value);
    } else {
      target[key] = value as any;
    }
  }

  return result;
};

const coerceEntitlements = (value: unknown): NormalizedEntitlements | null => {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as NormalizedEntitlements;
  if (
    candidate &&
    typeof candidate.plan_version === 'string' &&
    candidate.features &&
    typeof candidate.features === 'object'
  ) {
    return candidate;
  }

  return null;
};

export const computeEntitlements = (
  plan: PlanType,
  overrides?: Partial<FeatureEntitlements>,
): NormalizedEntitlements => {
  const base = BASE_FEATURES[plan] ?? BASE_FEATURES.free;
  const features = deepMerge(base, overrides);
  const source = overrides ? `plan:${plan}+overrides` : `plan:${plan}`;

  return {
    features,
    plan_version: PLAN_VERSION,
    source,
  };
};

const normalizeUsageCounters = (value: unknown): UsageCounters => {
  const normalized: UsageCounters = { ...DEFAULT_USAGE_COUNTERS };

  if (value && typeof value === 'object') {
    for (const key of Object.keys(DEFAULT_USAGE_COUNTERS) as UsageCounterKey[]) {
      const raw = (value as Record<string, unknown>)[key];
      const numeric = Number(raw);
      if (Number.isFinite(numeric) && numeric >= 0) {
        normalized[key] = Math.floor(numeric);
      }
    }
  }

  return normalized;
};

const extractOrgOverrides = (
  record: Pick<Org, 'plan' | 'limits'> | null,
): Partial<FeatureEntitlements> | undefined => {
  if (!record) return undefined;
  const raw = record.limits as any;
  if (!raw || typeof raw !== 'object') return undefined;

  if ('features' in raw && typeof raw.features === 'object') {
    return raw.features as Partial<FeatureEntitlements>;
  }

  return raw as Partial<FeatureEntitlements>;
};

const entitlementsEqual = (
  left: NormalizedEntitlements | null,
  right: NormalizedEntitlements | null,
) => JSON.stringify(left) === JSON.stringify(right);

export interface AccessContext {
  user: Pick<User, 'id' | 'plan' | 'orgId' | 'email'> & {
    usageCounters: UsageCounters;
  };
  org: Pick<Org, 'id' | 'plan' | 'limits' | 'seatCount'> | null;
  entitlements: NormalizedEntitlements;
}

type UserWithOrg = {
  user: Pick<
    User,
    |
      'id'
      | 'plan'
      | 'orgId'
      | 'usageCounters'
      | 'entitlements'
      | 'stripeCustomerId'
      | 'email'
  >;
  org: (Pick<Org, 'id' | 'plan' | 'limits' | 'seatCount' | 'stripeSubscriptionId'> & {
    limits: Org['limits'];
  }) | null;
};

const fetchUserRecord = async (userId: string): Promise<UserWithOrg | null> => {
  const [record] = await db
    .select({
      user: {
        id: user.id,
        plan: user.plan,
        orgId: user.orgId,
        usageCounters: user.usageCounters,
        entitlements: user.entitlements,
        stripeCustomerId: user.stripeCustomerId,
        email: user.email,
      },
      org: {
        id: org.id,
        plan: org.plan,
        limits: org.limits,
        seatCount: org.seatCount,
        stripeSubscriptionId: org.stripeSubscriptionId,
      },
    })
    .from(user)
    .leftJoin(org, eq(user.orgId, org.id))
    .where(eq(user.id, userId))
    .limit(1);

  return record ?? null;
};

const storeEntitlementsInCache = async (
  userId: string,
  payload: NormalizedEntitlements,
) => {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    await redis.set(buildCacheKey(userId), JSON.stringify(payload), {
      ex: ENTITLEMENTS_CACHE_TTL_SECONDS,
    });
  } catch (error) {
    console.warn('[entitlements] Failed to persist cache entry', error);
  }
};

const readEntitlementsFromCache = async (
  userId: string,
): Promise<NormalizedEntitlements | null> => {
  const redis = getRedisClient();
  if (!redis) return null;

  try {
    const cached = await redis.get<string>(buildCacheKey(userId));
    return cached ? (JSON.parse(cached) as NormalizedEntitlements) : null;
  } catch (error) {
    console.warn('[entitlements] Failed to read cache entry', error);
    return null;
  }
};

const updateStoredEntitlements = async (
  userId: string,
  entitlements: NormalizedEntitlements,
) => {
  await db
    .update(user)
    .set({ entitlements })
    .where(eq(user.id, userId));
};

const ensureUsageCountersPersisted = async (
  userId: string,
  counters: UsageCounters,
  current: unknown,
) => {
  const existing = normalizeUsageCounters(current);
  if (JSON.stringify(existing) === JSON.stringify(counters)) return;

  await db
    .update(user)
    .set({ usageCounters: counters })
    .where(eq(user.id, userId));
};

export const invalidateUserEntitlementsCache = async (userId: string) => {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    await redis.del(buildCacheKey(userId));
  } catch (error) {
    console.warn('[entitlements] Failed to delete cache entry', error);
  }
};

export const broadcastEntitlementsUpdated = async (userId: string) => {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    await redis.publish(
      `user:${userId}`,
      JSON.stringify({ type: 'entitlements_updated', id: randomUUID() }),
    );
  } catch (error) {
    console.warn('[entitlements] Failed to publish websocket event', error);
  }
};

export const getUserEntitlements = async (
  userId: string,
  preloaded?: UserWithOrg | null,
): Promise<NormalizedEntitlements> => {
  const cached = await readEntitlementsFromCache(userId);
  if (cached) return cached;

  const record = preloaded ?? (await fetchUserRecord(userId));
  if (!record) {
    throw new Error(`User ${userId} not found`);
  }

  const overrides = extractOrgOverrides(record.org);
  const computed = computeEntitlements(record.user.plan, overrides);
  const previous = coerceEntitlements(record.user.entitlements);

  if (!entitlementsEqual(previous, computed)) {
    await updateStoredEntitlements(userId, computed);
    await trackEntitlementsUpdated({
      user_id: record.user.id,
      org_id: record.org?.id ?? null,
      from: previous,
      to: computed,
    });
  }

  await storeEntitlementsInCache(userId, computed);

  return computed;
};

export const getAccessContext = async (
  userId: string,
): Promise<AccessContext> => {
  const record = await fetchUserRecord(userId);
  if (!record) {
    throw new Error(`User ${userId} not found`);
  }

  const usageCounters = normalizeUsageCounters(record.user.usageCounters);
  await ensureUsageCountersPersisted(userId, usageCounters, record.user.usageCounters);

  const entitlements = await getUserEntitlements(userId, record);

  return {
    user: {
      id: record.user.id,
      plan: record.user.plan,
      orgId: record.user.orgId,
      email: record.user.email,
      usageCounters,
    },
    org: record.org
      ? {
          id: record.org.id,
          plan: record.org.plan,
          limits: record.org.limits,
          seatCount: record.org.seatCount,
        }
      : null,
    entitlements,
  };
};

export const setUsageCounters = async (userId: string, counters: UsageCounters) => {
  await db
    .update(user)
    .set({ usageCounters: counters })
    .where(eq(user.id, userId));
};

export const updateUsageCounters = async (
  userId: string,
  mutate: (current: UsageCounters) => UsageCounters,
): Promise<UsageCounters> => {
  return await db.transaction(async (tx) => {
    const [currentRow] = await tx
      .select({ usageCounters: user.usageCounters })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    const currentCounters = normalizeUsageCounters(currentRow?.usageCounters);
    const next = mutate(currentCounters);

    await tx.update(user).set({ usageCounters: next }).where(eq(user.id, userId));

    return next;
  });
};

export const incrementUsageCounter = async (
  userId: string,
  field: UsageCounterKey,
  delta: number,
): Promise<UsageCounters> => {
  return await updateUsageCounters(userId, (current) => {
    const nextValue = Math.max(0, current[field] + delta);
    return {
      ...current,
      [field]: nextValue,
    };
  });
};

export const reserveDeepResearchSlot = async (
  userId: string,
  limit: number,
): Promise<{ allowed: boolean; retryInMs: number; release: () => Promise<void> }> => {
  const capacity = Math.max(1, limit || 1);
  const now = Date.now();
  let released = false;
  const redis = getRedisClient();

  if (redis) {
    const bucketKey = `entitlements:deep_research:bucket:${userId}`;
    const activeKey = `entitlements:deep_research:active:${userId}`;
    const ttlMs = Math.max(
      DEEP_RESEARCH_BUCKET_TTL_MS,
      DEEP_RESEARCH_REFILL_MS * capacity * 4,
    );

    try {
      const result = (await redis.eval(
        `local bucketKey = KEYS[1]
local activeKey = KEYS[2]
local now = tonumber(ARGV[1])
local capacity = tonumber(ARGV[2])
local refillMs = tonumber(ARGV[3])
local ttlMs = tonumber(ARGV[4])

local bucket = redis.call('hmget', bucketKey, 'tokens', 'last_refill')
local tokens = tonumber(bucket[1])
local lastRefill = tonumber(bucket[2])

if not tokens then
  tokens = capacity
end

if not lastRefill then
  lastRefill = now
end

if now > lastRefill then
  local elapsed = now - lastRefill
  local refill = math.floor(elapsed / refillMs)
  if refill > 0 then
    tokens = math.min(capacity, tokens + refill)
    lastRefill = lastRefill + (refill * refillMs)
  end
end

local active = tonumber(redis.call('get', activeKey) or '0')
local retryIn = 0

if tokens <= 0 then
  retryIn = refillMs - (now - lastRefill)
  if retryIn < 0 then retryIn = 0 end
end

if active >= capacity then
  if retryIn < refillMs then
    retryIn = refillMs
  end
end

if tokens <= 0 or active >= capacity then
  redis.call('hmset', bucketKey, 'tokens', tokens, 'last_refill', lastRefill)
  redis.call('pexpire', bucketKey, ttlMs)
  redis.call('pexpire', activeKey, ttlMs)
  return {0, retryIn}
end

tokens = tokens - 1
active = active + 1

redis.call('hmset', bucketKey, 'tokens', tokens, 'last_refill', lastRefill)
redis.call('pexpire', bucketKey, ttlMs)
redis.call('set', activeKey, active, 'PX', ttlMs)

return {1, retryIn}`,
        [bucketKey, activeKey],
        [
          now.toString(),
          capacity.toString(),
          DEEP_RESEARCH_REFILL_MS.toString(),
          ttlMs.toString(),
        ],
      )) as [number, number];

      const allowed = Array.isArray(result) && Number(result[0]) === 1;
      const retryInMs = Array.isArray(result)
        ? Math.max(0, Number(result[1]) || 0)
        : DEEP_RESEARCH_REFILL_MS;

      if (!allowed) {
        return { allowed: false, retryInMs, release: async () => {} };
      }

      return {
        allowed: true,
        retryInMs,
        release: async () => {
          if (released) return;
          released = true;
          try {
            await redis.eval(
              `local active = tonumber(redis.call('get', KEYS[1]) or '0')
if active <= 1 then
  redis.call('del', KEYS[1])
  return 0
end
active = active - 1
redis.call('set', KEYS[1], active, 'PX', ARGV[1])
return active`,
              [activeKey],
              [ttlMs.toString()],
            );
          } catch (error) {
            console.warn('[entitlements] Failed to release deep research slot', error);
          }
        },
      };
    } catch (error) {
      console.warn(
        '[entitlements] Redis reservation failed, using in-memory fallback',
        error,
      );
    }
  }

  const buckets = getMemoryBuckets();
  let state = buckets.get(userId);
  if (!state) {
    state = { tokens: capacity, lastRefill: now, active: 0 };
  } else if (now > state.lastRefill) {
    const elapsed = now - state.lastRefill;
    const refill = Math.floor(elapsed / DEEP_RESEARCH_REFILL_MS);
    if (refill > 0) {
      state.tokens = Math.min(capacity, state.tokens + refill);
      state.lastRefill = state.lastRefill + refill * DEEP_RESEARCH_REFILL_MS;
    }
  }

  let retryInMs = 0;
  if (state.tokens <= 0) {
    retryInMs = Math.max(0, DEEP_RESEARCH_REFILL_MS - (now - state.lastRefill));
  }
  if (state.active >= capacity) {
    retryInMs = Math.max(retryInMs, DEEP_RESEARCH_REFILL_MS);
  }

  if (state.tokens <= 0 || state.active >= capacity) {
    buckets.set(userId, state);
    return { allowed: false, retryInMs, release: async () => {} };
  }

  state.tokens -= 1;
  state.active += 1;
  buckets.set(userId, state);

  return {
    allowed: true,
    retryInMs,
    release: async () => {
      if (released) return;
      released = true;
      const current = buckets.get(userId);
      if (!current) return;
      current.active = Math.max(0, current.active - 1);
      buckets.set(userId, current);
    },
  };
};

export const resetDailyUsageCounters = async () => {
  await db.execute(`
    UPDATE "User"
    SET "usageCounters" = jsonb_set(
      jsonb_set(COALESCE("usageCounters", '{}'::jsonb), '{chats_today}', '0'::jsonb, true),
      '{deep_runs_day}',
      '0'::jsonb,
      true
    )
  `);
};

export const resetMonthlyUsageCounters = async () => {
  await db.execute(`
    UPDATE "User"
    SET "usageCounters" = jsonb_set(
      COALESCE("usageCounters", '{}'::jsonb),
      '{asr_minutes_month}',
      '0'::jsonb,
      true
    )
  `);
};

export const handlePlanChange = async (userId: string) => {
  await invalidateUserEntitlementsCache(userId);
  await broadcastEntitlementsUpdated(userId);
};

export const ensureUsageCounters = normalizeUsageCounters;
export const defaultUsageCounters = (): UsageCounters => ({ ...DEFAULT_USAGE_COUNTERS });
