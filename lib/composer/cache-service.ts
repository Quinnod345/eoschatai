import { getRedisClient } from '@/lib/redis/client';
import { db } from '@/lib/db';
import { document } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import type { ComposerKind } from '@/lib/mentions/types';

// Get redis client once at module load
const redis = getRedisClient();

/**
 * Cached composer data structure
 */
export interface CachedComposer {
  id: string;
  title: string;
  kind: ComposerKind;
  content: string | null;
  contentSummary: string | null;
  tags: string[];
  category: string | null;
  userId: string;
  createdAt: string;
  cachedAt: string;
}

/**
 * Cache configuration
 */
const CACHE_CONFIG = {
  // Cache TTL in seconds (5 minutes)
  TTL: 300,
  // Prefix for cache keys
  PREFIX: 'composer:',
  // Maximum number of composers to cache per user
  MAX_PER_USER: 50,
  // Recently accessed list key prefix
  RECENT_PREFIX: 'composer:recent:',
  // Maximum items in recently accessed list
  MAX_RECENT: 20,
};

/**
 * Generate cache key for a composer
 */
function getCacheKey(composerId: string, userId: string): string {
  return `${CACHE_CONFIG.PREFIX}${userId}:${composerId}`;
}

/**
 * Generate cache key for user's recently accessed composers
 */
function getRecentKey(userId: string): string {
  return `${CACHE_CONFIG.RECENT_PREFIX}${userId}`;
}

/**
 * Get a composer from cache
 */
export async function getComposerFromCache(
  composerId: string,
  userId: string,
): Promise<CachedComposer | null> {
  if (!redis) {
    return null;
  }

  try {
    const key = getCacheKey(composerId, userId);
    const cached = await redis.get<CachedComposer>(key);
    return cached;
  } catch (error) {
    console.error('Error getting composer from cache:', error);
    return null;
  }
}

/**
 * Set a composer in cache
 */
export async function setComposerInCache(
  composer: {
    id: string;
    title: string;
    kind: string;
    content: string | null;
    contentSummary: string | null;
    tags: any;
    category: string | null;
    userId: string;
    createdAt: Date;
  },
): Promise<void> {
  if (!redis) {
    return;
  }

  try {
    const key = getCacheKey(composer.id, composer.userId);
    const cached: CachedComposer = {
      id: composer.id,
      title: composer.title,
      kind: composer.kind as ComposerKind,
      content: composer.content,
      contentSummary: composer.contentSummary,
      tags: (composer.tags as string[]) || [],
      category: composer.category,
      userId: composer.userId,
      createdAt: composer.createdAt.toISOString(),
      cachedAt: new Date().toISOString(),
    };

    await redis.set(key, cached, { ex: CACHE_CONFIG.TTL });

    // Also add to recently accessed list
    await addToRecentlyAccessed(composer.userId, composer.id);
  } catch (error) {
    console.error('Error setting composer in cache:', error);
  }
}

/**
 * Invalidate a composer cache entry
 */
export async function invalidateComposerCache(
  composerId: string,
  userId: string,
): Promise<void> {
  if (!redis) {
    return;
  }

  try {
    const key = getCacheKey(composerId, userId);
    await redis.del(key);
  } catch (error) {
    console.error('Error invalidating composer cache:', error);
  }
}

/**
 * Add composer to recently accessed list
 */
async function addToRecentlyAccessed(
  userId: string,
  composerId: string,
): Promise<void> {
  if (!redis) {
    return;
  }

  try {
    const key = getRecentKey(userId);

    // Remove if already in list (to avoid duplicates)
    await redis.lrem(key, 0, composerId);

    // Add to front of list
    await redis.lpush(key, composerId);

    // Trim to max size
    await redis.ltrim(key, 0, CACHE_CONFIG.MAX_RECENT - 1);

    // Set TTL on the list (1 hour)
    await redis.expire(key, 3600);
  } catch (error) {
    console.error('Error adding to recently accessed:', error);
  }
}

/**
 * Get recently accessed composer IDs for a user
 */
export async function getRecentlyAccessedIds(
  userId: string,
  limit = 10,
): Promise<string[]> {
  if (!redis) {
    return [];
  }

  try {
    const key = getRecentKey(userId);
    const ids = await redis.lrange(key, 0, limit - 1);
    return ids;
  } catch (error) {
    console.error('Error getting recently accessed:', error);
    return [];
  }
}

/**
 * Get a composer with caching (cache-aside pattern)
 */
export async function getComposerWithCache(
  composerId: string,
  userId: string,
): Promise<CachedComposer | null> {
  // Try cache first
  const cached = await getComposerFromCache(composerId, userId);
  if (cached) {
    return cached;
  }

  // Fetch from database
  try {
    const [composer] = await db
      .select({
        id: document.id,
        title: document.title,
        kind: document.kind,
        content: document.content,
        contentSummary: document.contentSummary,
        tags: document.tags,
        category: document.category,
        userId: document.userId,
        createdAt: document.createdAt,
      })
      .from(document)
      .where(and(eq(document.id, composerId), eq(document.userId, userId)))
      .limit(1);

    if (!composer) {
      return null;
    }

    // Cache the result
    await setComposerInCache(composer);

    return {
      id: composer.id,
      title: composer.title,
      kind: composer.kind as ComposerKind,
      content: composer.content,
      contentSummary: composer.contentSummary,
      tags: (composer.tags as string[]) || [],
      category: composer.category,
      userId: composer.userId,
      createdAt: composer.createdAt.toISOString(),
      cachedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error fetching composer:', error);
    return null;
  }
}

/**
 * Get multiple composers with caching
 */
export async function getComposersWithCache(
  composerIds: string[],
  userId: string,
): Promise<CachedComposer[]> {
  if (composerIds.length === 0) {
    return [];
  }

  const results: CachedComposer[] = [];
  const uncachedIds: string[] = [];

  // Check cache for each ID
  await Promise.all(
    composerIds.map(async (id) => {
      const cached = await getComposerFromCache(id, userId);
      if (cached) {
        results.push(cached);
      } else {
        uncachedIds.push(id);
      }
    }),
  );

  // Fetch uncached from database
  if (uncachedIds.length > 0) {
    try {
      const composers = await db
        .select({
          id: document.id,
          title: document.title,
          kind: document.kind,
          content: document.content,
          contentSummary: document.contentSummary,
          tags: document.tags,
          category: document.category,
          userId: document.userId,
          createdAt: document.createdAt,
        })
        .from(document)
        .where(and(eq(document.userId, userId)));

      type ComposerCacheRow = { id: string; title: string; kind: string; content: string | null; contentSummary: string | null; tags: unknown; category: string | null; userId: string; createdAt: Date };
      // Filter to only the IDs we need
      const filteredComposers = composers.filter((c: ComposerCacheRow) =>
        uncachedIds.includes(c.id),
      );

      // Cache and add to results
      await Promise.all(
        filteredComposers.map(async (composer: ComposerCacheRow) => {
          await setComposerInCache(composer);
          results.push({
            id: composer.id,
            title: composer.title,
            kind: composer.kind as ComposerKind,
            content: composer.content,
            contentSummary: composer.contentSummary,
            tags: (composer.tags as string[]) || [],
            category: composer.category,
            userId: composer.userId,
            createdAt: composer.createdAt.toISOString(),
            cachedAt: new Date().toISOString(),
          });
        }),
      );
    } catch (error) {
      console.error('Error fetching composers:', error);
    }
  }

  // Sort results to match input order
  return composerIds
    .map((id) => results.find((c) => c.id === id))
    .filter((c): c is CachedComposer => c !== undefined);
}

/**
 * Clear all cached composers for a user
 */
export async function clearUserComposerCache(userId: string): Promise<void> {
  if (!redis) {
    return;
  }

  try {
    // Get all keys for this user
    const pattern = `${CACHE_CONFIG.PREFIX}${userId}:*`;
    
    // Use scan to find keys (more memory efficient than keys)
    let cursor: string | number = 0;
    const keysToDelete: string[] = [];
    
    do {
      const result: [string | number, string[]] = await redis.scan(cursor, { match: pattern, count: 100 });
      cursor = result[0];
      keysToDelete.push(...result[1]);
    } while (cursor !== 0 && cursor !== '0');

    // Delete all found keys
    if (keysToDelete.length > 0) {
      await Promise.all(keysToDelete.map((key) => redis.del(key)));
    }

    // Also clear recently accessed list
    const recentKey = getRecentKey(userId);
    await redis.del(recentKey);
  } catch (error) {
    console.error('Error clearing user composer cache:', error);
  }
}

/**
 * Warm cache for user's frequently accessed composers
 */
export async function warmComposerCache(userId: string): Promise<number> {
  try {
    // Get recently accessed IDs
    const recentIds = await getRecentlyAccessedIds(userId, 10);

    if (recentIds.length === 0) {
      return 0;
    }

    // Fetch and cache these composers
    const composers = await getComposersWithCache(recentIds, userId);
    return composers.length;
  } catch (error) {
    console.error('Error warming composer cache:', error);
    return 0;
  }
}

/**
 * Get cache statistics for debugging
 */
export async function getCacheStats(userId: string): Promise<{
  cachedCount: number;
  recentCount: number;
}> {
  if (!redis) {
    return { cachedCount: 0, recentCount: 0 };
  }

  try {
    // Count cached composers
    const pattern = `${CACHE_CONFIG.PREFIX}${userId}:*`;
    let cachedCount = 0;
    let cursor: string | number = 0;
    
    do {
      const result: [string | number, string[]] = await redis.scan(cursor, { match: pattern, count: 100 });
      cursor = result[0];
      cachedCount += result[1].length;
    } while (cursor !== 0 && cursor !== '0');

    // Count recent
    const recentKey = getRecentKey(userId);
    const recentCount = await redis.llen(recentKey);

    return { cachedCount, recentCount };
  } catch (error) {
    console.error('Error getting cache stats:', error);
    return { cachedCount: 0, recentCount: 0 };
  }
}
