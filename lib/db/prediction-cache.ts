// Optional Redis import - gracefully handle if not installed
let Redis: any;
let cache: any = null;

try {
  // Try to import Redis if available
  Redis = require('@upstash/redis').Redis;

  // Initialize Redis client if URL is available
  if (
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    cache = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
} catch (error) {
  // Redis package not installed - that's okay, we'll work without it
  console.log(
    'Redis cache not available for predictions - running without cache',
  );
}

interface PredictionCacheRecord {
  userId: string;
  prefix: string;
  predictions: string[];
  metadata?: Record<string, any>;
  expiresAt: Date;
}

const EXPIRATION_MINUTES = 10;

export async function getPredictionCache({
  userId,
  prefix,
}: {
  userId: string;
  prefix: string;
}): Promise<PredictionCacheRecord | null> {
  if (!cache) return null;

  try {
    const key = getCacheKey(userId, prefix);
    const cached = (await cache.get(key)) as PredictionCacheRecord;

    if (!cached) return null;

    if (new Date(cached.expiresAt) < new Date()) {
      await cache.delete(key).catch(() => {});
      return null;
    }

    return cached;
  } catch (error) {
    console.error('Failed to read prediction cache', error);
    return null;
  }
}

export async function upsertPredictionCache({
  userId,
  prefix,
  predictions,
  metadata,
}: {
  userId: string;
  prefix: string;
  predictions: string[];
  metadata?: Record<string, any>;
}): Promise<void> {
  if (!cache) return;

  try {
    const key = getCacheKey(userId, prefix);
    const expiresAt = new Date(Date.now() + EXPIRATION_MINUTES * 60 * 1000);
    const record: PredictionCacheRecord = {
      userId,
      prefix,
      predictions,
      metadata,
      expiresAt,
    };

    await cache.set(key, record, {
      ex: EXPIRATION_MINUTES * 60,
    });
  } catch (error) {
    console.error('Failed to upsert prediction cache', error);
  }
}

function getCacheKey(userId: string, prefix: string) {
  return `prediction:${userId}:${prefix}`;
}
