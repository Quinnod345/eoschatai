// Optional Redis import - gracefully handle if not installed
let Redis: any;
let redisClient: any = null;

try {
  // Try to import Redis if available
  Redis = require('@upstash/redis').Redis;

  // Initialize Redis client if URL is available
  if (
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    redisClient = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
} catch (error) {
  // Redis package not installed - that's okay, we'll work without it
  console.log('Redis cache not available - running without cache');
}

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  tags?: string[]; // Cache tags for invalidation
}

/**
 * Get cached data or fetch fresh data
 */
export async function getCachedData<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: CacheOptions = {},
): Promise<T> {
  const { ttl = 3600 } = options; // Default 1 hour TTL

  // If Redis is not available, just fetch fresh data
  if (!redisClient) {
    return fetcher();
  }

  try {
    // Try to get from cache
    const cached = await redisClient.get(key);
    if (cached) {
      console.log(`Cache hit for key: ${key}`);
      return cached as T;
    }

    // Fetch fresh data
    console.log(`Cache miss for key: ${key}`);
    const fresh = await fetcher();

    // Store in cache
    await redisClient.set(key, JSON.stringify(fresh), {
      ex: ttl,
    });

    // Store tags for invalidation
    if (options.tags && options.tags.length > 0) {
      for (const tag of options.tags) {
        await redisClient.sadd(`tag:${tag}`, key);
        await redisClient.expire(`tag:${tag}`, ttl);
      }
    }

    return fresh;
  } catch (error) {
    console.error('Cache error:', error);
    // Fallback to fetcher on error
    return fetcher();
  }
}

/**
 * Invalidate cache by key
 */
export async function invalidateCache(key: string): Promise<void> {
  if (!redisClient) return;

  try {
    await redisClient.del(key);
    console.log(`Invalidated cache for key: ${key}`);
  } catch (error) {
    console.error('Cache invalidation error:', error);
  }
}

/**
 * Invalidate cache by tag
 */
export async function invalidateCacheByTag(tag: string): Promise<void> {
  if (!redisClient) return;

  try {
    const keys = await redisClient.smembers(`tag:${tag}`);
    if (keys.length > 0) {
      await redisClient.del(...keys);
      await redisClient.del(`tag:${tag}`);
      console.log(`Invalidated ${keys.length} cache entries for tag: ${tag}`);
    }
  } catch (error) {
    console.error('Cache tag invalidation error:', error);
  }
}

/**
 * Cache key generators
 */
export const cacheKeys = {
  chat: (chatId: string) => `chat:${chatId}`,
  chatMessages: (chatId: string) => `chat:${chatId}:messages`,
  userChats: (userId: string, page?: number) =>
    `user:${userId}:chats${page ? `:page:${page}` : ''}`,
  userSettings: (userId: string) => `user:${userId}:settings`,
  persona: (personaId: string) => `persona:${personaId}`,
  userPersonas: (userId: string) => `user:${userId}:personas`,
  searchResults: (query: string, filters: any) =>
    `search:${query}:${JSON.stringify(filters)}`,
};

/**
 * Cache tags for invalidation groups
 */
export const cacheTags = {
  userChats: (userId: string) => `user:${userId}:chats`,
  chatData: (chatId: string) => `chat:${chatId}`,
  personas: (userId: string) => `user:${userId}:personas`,
};
