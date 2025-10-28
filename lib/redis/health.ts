import 'server-only';

import { getRedisClient } from './client';

let redisHealthy = true;
let lastHealthCheck = 0;
const HEALTH_CHECK_INTERVAL = 60000; // 1 minute

/**
 * Check if Redis is healthy and available
 * Caches result for 1 minute to avoid excessive pings
 */
export async function checkRedisHealth(): Promise<boolean> {
  const now = Date.now();

  // Return cached result if checked recently
  if (now - lastHealthCheck < HEALTH_CHECK_INTERVAL) {
    return redisHealthy;
  }

  const redis = getRedisClient();
  if (!redis) {
    redisHealthy = false;
    lastHealthCheck = now;
    return false;
  }

  try {
    await redis.ping();
    redisHealthy = true;
    lastHealthCheck = now;
    return true;
  } catch (error) {
    console.error('[redis] Health check failed:', error);
    redisHealthy = false;
    lastHealthCheck = now;
    return false;
  }
}

/**
 * Get current Redis health status (from cache, doesn't ping)
 */
export function isRedisHealthy(): boolean {
  return redisHealthy;
}

/**
 * Force Redis health check (ignores cache)
 */
export async function forceRedisHealthCheck(): Promise<boolean> {
  lastHealthCheck = 0;
  return await checkRedisHealth();
}























































