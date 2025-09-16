/**
 * Redis Storage for Firesearch
 * Handles session persistence and resumable research
 */

import { Redis } from '@upstash/redis';
import type {
  ResearchSession,
  ResearchCheckpoint,
  ResearchResult,
  ResearchPhase,
} from './types';

// Initialize Redis client
let redisClient: Redis | null = null;

function getRedisClient(): Redis | null {
  if (!redisClient) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
      console.warn('Redis not configured for Firesearch storage');
      return null;
    }

    redisClient = new Redis({ url, token });
  }
  return redisClient;
}

export class FiresearchRedisStorage {
  private readonly keyPrefix = 'firesearch';
  private readonly sessionTTL = 7200; // 2 hours

  /**
   * Save research session
   */
  async saveSession(session: ResearchSession): Promise<void> {
    const redis = getRedisClient();
    if (!redis) return;

    const key = this.getSessionKey(session.id);
    await redis.setex(key, this.sessionTTL, JSON.stringify(session));
  }

  /**
   * Load research session
   */
  async loadSession(sessionId: string): Promise<ResearchSession | null> {
    const redis = getRedisClient();
    if (!redis) return null;

    const key = this.getSessionKey(sessionId);
    const data = await redis.get(key);
    return data ? JSON.parse(data as string) : null;
  }

  /**
   * Update session status
   */
  async updateSessionStatus(
    sessionId: string,
    status: ResearchSession['status'],
  ): Promise<void> {
    const session = await this.loadSession(sessionId);
    if (session) {
      session.status = status;
      session.lastUpdate = Date.now();
      await this.saveSession(session);
    }
  }

  /**
   * Add checkpoint to session
   */
  async addCheckpoint(
    sessionId: string,
    checkpoint: ResearchCheckpoint,
  ): Promise<void> {
    const session = await this.loadSession(sessionId);
    if (session) {
      session.checkpoints.push(checkpoint);
      session.lastUpdate = Date.now();
      await this.saveSession(session);
    }
  }

  /**
   * Save research result
   */
  async saveResult(sessionId: string, result: ResearchResult): Promise<void> {
    const redis = getRedisClient();
    if (!redis) return;

    const session = await this.loadSession(sessionId);
    if (session) {
      session.result = result;
      session.status = 'completed';
      session.lastUpdate = Date.now();
      await this.saveSession(session);
    }

    // Also cache the result separately for quick access
    const resultKey = this.getResultKey(sessionId);
    await redis.setex(resultKey, 3600, JSON.stringify(result)); // 1 hour cache
  }

  /**
   * Get cached result
   */
  async getCachedResult(sessionId: string): Promise<ResearchResult | null> {
    const redis = getRedisClient();
    if (!redis) return null;

    const resultKey = this.getResultKey(sessionId);
    const data = await redis.get(resultKey);
    return data ? JSON.parse(data as string) : null;
  }

  /**
   * Rate limiting check
   */
  async checkRateLimit(userId: string): Promise<{
    allowed: boolean;
    remaining: number;
    resetAt: number;
  }> {
    const redis = getRedisClient();
    if (!redis) {
      return { allowed: true, remaining: 10, resetAt: Date.now() + 3600000 };
    }

    const key = this.getRateLimitKey(userId);
    const current = await redis.incr(key);

    if (current === 1) {
      // First request in the window
      await redis.expire(key, 3600); // 1 hour window
    }

    const ttl = await redis.ttl(key);
    const limit = 10; // 10 searches per hour
    const allowed = current <= limit;
    const remaining = Math.max(0, limit - current);
    const resetAt = Date.now() + ttl * 1000;

    if (!allowed) {
      // Decrement back if not allowed
      await redis.decr(key);
    }

    return { allowed, remaining, resetAt };
  }

  /**
   * Get user's active sessions
   */
  async getActiveSessions(
    userId: string,
    chatId?: string,
  ): Promise<ResearchSession[]> {
    const pattern = chatId
      ? `${this.keyPrefix}:session:${userId}:${chatId}:*`
      : `${this.keyPrefix}:session:${userId}:*`;

    // Note: SCAN/KEYS not available in Upstash, need to track sessions differently
    // For now, return empty array - in production, maintain a user sessions list
    return [];
  }

  /**
   * Clean up old sessions
   */
  async cleanupOldSessions(olderThan = 86400000): Promise<number> {
    // This would need to be implemented with a background job
    // that tracks session keys in a separate list
    return 0;
  }

  /**
   * Lock mechanism for concurrent access
   */
  async acquireLock(sessionId: string, ttl = 30): Promise<boolean> {
    const redis = getRedisClient();
    if (!redis) return true; // Allow if no Redis

    const key = this.getLockKey(sessionId);
    const result = await redis.set(key, '1', { ex: ttl, nx: true });
    return result === 'OK';
  }

  /**
   * Release lock
   */
  async releaseLock(sessionId: string): Promise<void> {
    const redis = getRedisClient();
    if (!redis) return;

    const key = this.getLockKey(sessionId);
    await redis.del(key);
  }

  /**
   * Save stream state for recovery
   */
  async saveStreamState(
    streamId: string,
    state: any,
    ttl = 7200,
  ): Promise<void> {
    const redis = getRedisClient();
    if (!redis) return;

    const key = this.getStreamKey(streamId);
    await redis.setex(key, ttl, JSON.stringify(state));
  }

  /**
   * Load stream state
   */
  async loadStreamState(streamId: string): Promise<any | null> {
    const redis = getRedisClient();
    if (!redis) return null;

    const key = this.getStreamKey(streamId);
    const data = await redis.get(key);
    return data ? JSON.parse(data as string) : null;
  }

  /**
   * Track search progress
   */
  async updateProgress(
    sessionId: string,
    progress: {
      phase: ResearchPhase['phase'];
      completedSearches: number;
      totalSearches: number;
      sourcesFound: number;
    },
  ): Promise<void> {
    const redis = getRedisClient();
    if (!redis) return;

    const key = this.getProgressKey(sessionId);
    await redis.setex(
      key,
      300,
      JSON.stringify({
        // 5 minutes TTL
        ...progress,
        lastUpdate: Date.now(),
      }),
    );
  }

  /**
   * Get current progress
   */
  async getProgress(sessionId: string): Promise<any | null> {
    const redis = getRedisClient();
    if (!redis) return null;

    const key = this.getProgressKey(sessionId);
    const data = await redis.get(key);
    return data ? JSON.parse(data as string) : null;
  }

  // Key generation helpers
  private getSessionKey(sessionId: string): string {
    return `${this.keyPrefix}:session:${sessionId}`;
  }

  private getResultKey(sessionId: string): string {
    return `${this.keyPrefix}:result:${sessionId}`;
  }

  private getRateLimitKey(userId: string): string {
    return `${this.keyPrefix}:ratelimit:${userId}`;
  }

  private getLockKey(sessionId: string): string {
    return `${this.keyPrefix}:lock:${sessionId}`;
  }

  private getStreamKey(streamId: string): string {
    return `${this.keyPrefix}:stream:${streamId}`;
  }

  private getProgressKey(sessionId: string): string {
    return `${this.keyPrefix}:progress:${sessionId}`;
  }
}
