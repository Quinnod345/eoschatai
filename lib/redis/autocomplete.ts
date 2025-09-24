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

// ZSET-based autocomplete implementation (lex index + rank index)
const LEX_KEY = 'auto:eos:lex';
const RANK_KEY = 'auto:eos:rank';

export const AUTOCOMPLETE_KEY = LEX_KEY; // kept for backward compatibility

export async function addSuggestion(phrase: string, score = 1, incr = false) {
  const redis = getRedis();
  const normalized = phrase.trim();
  if (!normalized) return 'OK';

  // Ensure present in lex set with constant score 0 to allow ZRANGEBYLEX
  await redis.zadd(LEX_KEY, { score: 0, member: normalized });

  // Maintain ranking in separate sorted set
  if (incr) {
    await redis.zincrby(RANK_KEY, score, normalized);
  } else {
    // If not exists, set initial score if higher than current
    const current = await redis.zscore(RANK_KEY, normalized);
    if (current === null || Number(current) < score) {
      await redis.zadd(RANK_KEY, { score, member: normalized });
    }
  }
  return 'OK';
}

export async function getSuggestions(
  prefix: string,
  opts?: { max?: number; fuzzy?: boolean },
) {
  const redis = getRedis();
  const max = Math.max(1, Math.min(opts?.max ?? 5, 20));
  const cleaned = prefix.trim();
  if (!cleaned) return [] as string[];

  // Lexicographic range: [prefix, prefix + \xff)
  const minLex = `[${cleaned}`;
  const maxLex = `[${cleaned}\xff`;

  // Fetch a small superset and then rank client-side
  let candidates: string[] = [];
  try {
    // Prefer lexicographic range if supported by client
    // @ts-ignore upstash client supports options object for zrange
    const res = await (redis as any).zrange(LEX_KEY, minLex, maxLex, {
      byLex: true,
      limit: { offset: 0, count: 200 },
    });
    candidates = Array.isArray(res) ? res : [];
  } catch {
    // Fallback: pull first N (lex-ordered due to equal scores) and filter by prefix
    const res = await redis.zrange(LEX_KEY, 0, 500);
    const all = Array.isArray(res) ? (res as string[]) : [];
    const lower = cleaned.toLowerCase();
    candidates = all.filter((c) => c.toLowerCase().startsWith(lower));
  }

  // Score by rank set
  // Use ZMSCORE if available via client typings, otherwise fallback per-member
  let scored: Array<{ phrase: string; score: number }> = [];
  if (candidates.length > 0) {
    try {
      // @ts-ignore
      const scores: (number | null)[] = await (redis as any).zmscore(
        RANK_KEY,
        ...candidates,
      );
      scored = candidates.map((c, i) => ({
        phrase: c,
        score: Number(scores?.[i] ?? 0) || 0,
      }));
    } catch {
      // Fallback to zscore per member
      const out: Array<{ phrase: string; score: number }> = [];
      for (const c of candidates) {
        const s = await redis.zscore(RANK_KEY, c);
        out.push({ phrase: c, score: Number(s ?? 0) || 0 });
      }
      scored = out;
    }
  }

  scored.sort((a, b) => b.score - a.score);
  let result = scored.map((s) => s.phrase).slice(0, max);

  // Naive fuzzy fallback: if asked, and results too few, widen using first char
  if (opts?.fuzzy && result.length < max && cleaned.length >= 2) {
    const first = cleaned[0];
    const min2 = `[${first}`;
    const max2 = `[${first}\xff`;
    let c2: string[] = [];
    try {
      // @ts-ignore
      const res2 = await (redis as any).zrange(LEX_KEY, min2, max2, {
        byLex: true,
        limit: { offset: 0, count: 500 },
      });
      c2 = Array.isArray(res2) ? res2 : [];
    } catch {
      const res2 = await redis.zrange(LEX_KEY, 0, 1000);
      const all2 = Array.isArray(res2) ? (res2 as string[]) : [];
      c2 = all2.filter((c) => c.toLowerCase().startsWith(first.toLowerCase()));
    }
    // compute simple edit distance and merge
    const extra = c2
      .filter((c) => levenshtein(c.toLowerCase(), cleaned.toLowerCase()) <= 2)
      .slice(0, 50);
    const merged = Array.from(new Set([...result, ...extra]));
    result = merged.slice(0, max);
  }

  return result;
}

export async function deleteSuggestion(phrase: string) {
  const redis = getRedis();
  const normalized = phrase.trim();
  if (!normalized) return 0;
  const [a, b] = await Promise.all([
    redis.zrem(LEX_KEY, normalized),
    redis.zrem(RANK_KEY, normalized),
  ]);
  return (Number(a) || 0) + (Number(b) || 0);
}

export async function lengthSuggestions() {
  const redis = getRedis();
  const n = await redis.zcard(LEX_KEY);
  return Number(n) || 0;
}

function levenshtein(a: string, b: string) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = new Array(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      if (a[i - 1] === b[j - 1]) dp[j] = prev;
      else dp[j] = Math.min(prev + 1, dp[j] + 1, dp[j - 1] + 1);
      prev = temp;
    }
  }
  return dp[n];
}
