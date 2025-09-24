import 'server-only';

import type { Redis } from '@upstash/redis';

let redisClient: Redis | null | undefined;

/**
 * Returns a shared Upstash Redis client instance if credentials are configured.
 */
export const getRedisClient = (): Redis | null => {
  if (redisClient !== undefined) {
    return redisClient;
  }

  try {
    const { UPSTASH_REDIS_REST_URL: url, UPSTASH_REDIS_REST_TOKEN: token } =
      process.env;

    if (!url || !token) {
      redisClient = null;
      return redisClient;
    }

    // Lazy import to avoid issues during build when dependency is optional.
    const { Redis } = require('@upstash/redis') as typeof import('@upstash/redis');
    redisClient = new Redis({ url, token });
  } catch (error) {
    console.warn('[redis] Failed to initialize client, continuing without cache', error);
    redisClient = null;
  }

  return redisClient;
};
