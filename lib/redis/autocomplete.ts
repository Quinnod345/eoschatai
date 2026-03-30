import { Redis } from '@upstash/redis';

let redisClient: Redis | null = null;

function getRedis(): Redis {
  if (!redisClient) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) {
      throw new Error(
        'Redis is not configured (missing UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN)',
      );
    }
    redisClient = new Redis({ url, token });
  }
  return redisClient;
}

const LEX_KEY = 'auto:eos:lex';
const RANK_KEY = 'auto:eos:rank';
const RECENCY_KEY = 'auto:eos:recency';

export const AUTOCOMPLETE_KEY = LEX_KEY;

export async function addSuggestion(phrase: string, score = 1, incr = false) {
  const redis = getRedis();
  const normalized = phrase.trim();
  if (!normalized) return 'OK';

  const pipeline = redis.pipeline();
  pipeline.zadd(LEX_KEY, { score: 0, member: normalized });

  if (incr) {
    pipeline.zincrby(RANK_KEY, score, normalized);
  } else {
    pipeline.zadd(RANK_KEY, { score, member: normalized });
  }

  pipeline.zadd(RECENCY_KEY, { score: Date.now(), member: normalized });
  await pipeline.exec();
  return 'OK';
}

export interface ScoredCandidate {
  phrase: string;
  popularity: number;
  recency: number;
  blended: number;
}

const CANDIDATE_LIMIT = 30;
const FUZZY_CANDIDATE_LIMIT = 60;

export async function getSuggestions(
  prefix: string,
  opts?: { max?: number; fuzzy?: boolean },
): Promise<string[]> {
  const redis = getRedis();
  const max = Math.max(1, Math.min(opts?.max ?? 5, 20));
  const cleaned = prefix.trim();
  if (!cleaned) return [];

  const minLex = `[${cleaned}`;
  const maxLex = `[${cleaned}\xff`;

  let candidates: string[] = [];
  try {
    // @ts-ignore upstash client supports options object for zrange
    const res = await (redis as any).zrange(LEX_KEY, minLex, maxLex, {
      byLex: true,
      limit: { offset: 0, count: CANDIDATE_LIMIT },
    });
    candidates = Array.isArray(res) ? res : [];
  } catch {
    return [];
  }

  if (opts?.fuzzy && candidates.length < max && cleaned.length >= 2) {
    const caseInsensitiveCandidates = await getCaseInsensitiveFuzzy(
      redis,
      cleaned,
      FUZZY_CANDIDATE_LIMIT,
    );
    const existing = new Set(candidates);
    for (const c of caseInsensitiveCandidates) {
      if (!existing.has(c)) candidates.push(c);
    }
  }

  if (candidates.length === 0) return [];

  const scored = await scoreCandidates(redis, candidates);
  scored.sort((a, b) => b.blended - a.blended);
  return scored.map((s) => s.phrase).slice(0, max);
}

async function getCaseInsensitiveFuzzy(
  redis: Redis,
  prefix: string,
  limit: number,
): Promise<string[]> {
  const lower = prefix.toLowerCase();
  const upper = prefix.toUpperCase();
  const firstLower = lower[0];
  const firstUpper = upper[0];

  const ranges: string[][] = [];
  for (const ch of new Set([firstLower, firstUpper])) {
    try {
      // @ts-ignore
      const res = await (redis as any).zrange(LEX_KEY, `[${ch}`, `[${ch}\xff`, {
        byLex: true,
        limit: { offset: 0, count: limit },
      });
      if (Array.isArray(res)) ranges.push(res);
    } catch {
      /* skip */
    }
  }

  const prefixLower = lower;
  const merged: string[] = [];
  for (const arr of ranges) {
    for (const c of arr) {
      if (c.toLowerCase().startsWith(prefixLower)) {
        merged.push(c);
      }
    }
  }
  return merged;
}

async function scoreCandidates(
  redis: Redis,
  candidates: string[],
): Promise<ScoredCandidate[]> {
  let popularityScores: (number | null)[] = [];
  let recencyScores: (number | null)[] = [];

  try {
    // @ts-ignore
    [popularityScores, recencyScores] = await Promise.all([
      (redis as any).zmscore(RANK_KEY, ...candidates),
      (redis as any).zmscore(RECENCY_KEY, ...candidates),
    ]);
  } catch {
    const pipeline = redis.pipeline();
    for (const c of candidates) {
      pipeline.zscore(RANK_KEY, c);
      pipeline.zscore(RECENCY_KEY, c);
    }
    const results = await pipeline.exec();
    popularityScores = [];
    recencyScores = [];
    for (let i = 0; i < candidates.length; i++) {
      popularityScores.push(results[i * 2] as number | null);
      recencyScores.push(results[i * 2 + 1] as number | null);
    }
  }

  const now = Date.now();
  const ONE_HOUR = 3_600_000;

  return candidates.map((phrase, i) => {
    const popularity = Number(popularityScores?.[i] ?? 0) || 0;
    const recencyTs = Number(recencyScores?.[i] ?? 0) || 0;
    const hoursSinceUse = recencyTs > 0 ? (now - recencyTs) / ONE_HOUR : 168;
    const recencyBoost = Math.max(0, 1 - hoursSinceUse / 168);

    const blended = popularity * 0.7 + recencyBoost * 100 * 0.3;

    return { phrase, popularity, recency: recencyTs, blended };
  });
}

export async function deleteSuggestion(phrase: string) {
  const redis = getRedis();
  const normalized = phrase.trim();
  if (!normalized) return 0;
  const [a, b, c] = await Promise.all([
    redis.zrem(LEX_KEY, normalized),
    redis.zrem(RANK_KEY, normalized),
    redis.zrem(RECENCY_KEY, normalized),
  ]);
  return (Number(a) || 0) + (Number(b) || 0) + (Number(c) || 0);
}

export async function lengthSuggestions() {
  const redis = getRedis();
  const n = await redis.zcard(LEX_KEY);
  return Number(n) || 0;
}
