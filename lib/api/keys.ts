/**
 * API Key Management
 *
 * This module handles API key generation, validation, and management
 * for the public EOSAI API.
 */

import { db } from '@/lib/db';
import { apiKey, apiKeyUsage, user, org } from '@/lib/db/schema';
import { eq, and, gt, sql } from 'drizzle-orm';
import crypto from 'node:crypto';

// API Key format: eosai_sk_<random_32_chars>
const API_KEY_PREFIX = 'eosai_sk_';
const KEY_LENGTH = 32;

/**
 * Generate a new API key
 * Returns both the raw key (to show user once) and the hash (to store)
 */
export function generateApiKey(): { rawKey: string; keyHash: string; keyPrefix: string } {
  // Generate random bytes and convert to hex
  const randomBytes = crypto.randomBytes(KEY_LENGTH);
  const randomPart = randomBytes.toString('base64url').slice(0, KEY_LENGTH);
  const rawKey = `${API_KEY_PREFIX}${randomPart}`;

  // Hash the key for storage
  const keyHash = hashApiKey(rawKey);

  // Store prefix for identification (without the eosai_sk_ part for cleaner display)
  const keyPrefix = `${API_KEY_PREFIX}${randomPart.slice(0, 4)}...`;

  return { rawKey, keyHash, keyPrefix };
}

/**
 * Hash an API key using SHA-256
 */
export function hashApiKey(rawKey: string): string {
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}

/**
 * Create a new API key in the database
 */
export async function createApiKey(params: {
  userId?: string;
  orgId?: string;
  name: string;
  description?: string;
  rateLimitRpm?: number;
  rateLimitRpd?: number;
  expiresAt?: Date;
  allowedModels?: string[];
  scopes?: string[];
}): Promise<{ apiKeyRecord: typeof apiKey.$inferSelect; rawKey: string }> {
  const { rawKey, keyHash, keyPrefix } = generateApiKey();

  const [apiKeyRecord] = await db
    .insert(apiKey)
    .values({
      keyHash,
      keyPrefix,
      userId: params.userId,
      orgId: params.orgId,
      name: params.name,
      description: params.description,
      rateLimitRpm: params.rateLimitRpm ?? 60,
      rateLimitRpd: params.rateLimitRpd ?? 1000,
      expiresAt: params.expiresAt,
      allowedModels: params.allowedModels,
      scopes: params.scopes ?? ['chat'],
    })
    .returning();

  return { apiKeyRecord, rawKey };
}

/**
 * Validate an API key and return the key record if valid
 */
export async function validateApiKey(rawKey: string): Promise<{
  valid: boolean;
  apiKey?: typeof apiKey.$inferSelect;
  user?: typeof user.$inferSelect;
  org?: typeof org.$inferSelect;
  error?: string;
}> {
  // Check key format
  if (!rawKey.startsWith(API_KEY_PREFIX)) {
    return { valid: false, error: 'Invalid API key format' };
  }

  // Hash the provided key
  const keyHash = hashApiKey(rawKey);

  // Look up the key
  const [result] = await db
    .select({
      apiKey: apiKey,
      user: user,
      org: org,
    })
    .from(apiKey)
    .leftJoin(user, eq(apiKey.userId, user.id))
    .leftJoin(org, eq(apiKey.orgId, org.id))
    .where(eq(apiKey.keyHash, keyHash))
    .limit(1);

  if (!result) {
    return { valid: false, error: 'Invalid API key' };
  }

  // Check if key is active
  if (!result.apiKey.isActive) {
    return { valid: false, error: 'API key is disabled' };
  }

  // Check if key is expired
  if (result.apiKey.expiresAt && result.apiKey.expiresAt < new Date()) {
    return { valid: false, error: 'API key has expired' };
  }

  return {
    valid: true,
    apiKey: result.apiKey,
    user: result.user ?? undefined,
    org: result.org ?? undefined,
  };
}

/**
 * Check rate limits for an API key
 * Returns true if the request is allowed, false if rate limited
 */
export async function checkRateLimit(apiKeyId: string, rateLimitRpm: number, rateLimitRpd: number): Promise<{
  allowed: boolean;
  remainingRpm: number;
  remainingRpd: number;
  resetAtRpm: Date;
  resetAtRpd: Date;
}> {
  const now = new Date();
  const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Count requests in the last minute
  const [rpmResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(apiKeyUsage)
    .where(
      and(
        eq(apiKeyUsage.apiKeyId, apiKeyId),
        gt(apiKeyUsage.createdAt, oneMinuteAgo)
      )
    );

  // Count requests in the last day
  const [rpdResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(apiKeyUsage)
    .where(
      and(
        eq(apiKeyUsage.apiKeyId, apiKeyId),
        gt(apiKeyUsage.createdAt, oneDayAgo)
      )
    );

  const rpmCount = rpmResult?.count ?? 0;
  const rpdCount = rpdResult?.count ?? 0;

  const remainingRpm = Math.max(0, rateLimitRpm - rpmCount);
  const remainingRpd = Math.max(0, rateLimitRpd - rpdCount);

  return {
    allowed: rpmCount < rateLimitRpm && rpdCount < rateLimitRpd,
    remainingRpm,
    remainingRpd,
    resetAtRpm: new Date(now.getTime() + 60 * 1000),
    resetAtRpd: new Date(now.getTime() + 24 * 60 * 60 * 1000),
  };
}

/**
 * Log API key usage
 */
export async function logApiKeyUsage(params: {
  apiKeyId: string;
  endpoint: string;
  method: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  statusCode?: number;
  responseTimeMs?: number;
  model?: string;
  errorMessage?: string;
}): Promise<void> {
  // Insert usage record
  await db.insert(apiKeyUsage).values({
    apiKeyId: params.apiKeyId,
    endpoint: params.endpoint,
    method: params.method,
    promptTokens: params.promptTokens ?? 0,
    completionTokens: params.completionTokens ?? 0,
    totalTokens: params.totalTokens ?? 0,
    statusCode: params.statusCode,
    responseTimeMs: params.responseTimeMs,
    model: params.model,
    errorMessage: params.errorMessage,
  });

  // Update usage counts on the API key
  await db
    .update(apiKey)
    .set({
      usageCount: sql`${apiKey.usageCount} + 1`,
      usageTokens: sql`${apiKey.usageTokens} + ${params.totalTokens ?? 0}`,
      lastUsedAt: new Date(),
    })
    .where(eq(apiKey.id, params.apiKeyId));
}

/**
 * Get usage statistics for an API key
 */
export async function getApiKeyUsageStats(apiKeyId: string, days = 30): Promise<{
  totalRequests: number;
  totalTokens: number;
  requestsByDay: Array<{ date: string; requests: number; tokens: number }>;
  requestsByEndpoint: Array<{ endpoint: string; requests: number }>;
  averageResponseTime: number;
  errorRate: number;
}> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // Get total counts
  const [totals] = await db
    .select({
      totalRequests: sql<number>`count(*)::int`,
      totalTokens: sql<number>`coalesce(sum(${apiKeyUsage.totalTokens}), 0)::int`,
      avgResponseTime: sql<number>`coalesce(avg(${apiKeyUsage.responseTimeMs}), 0)::int`,
      errorCount: sql<number>`count(case when ${apiKeyUsage.statusCode} >= 400 then 1 end)::int`,
    })
    .from(apiKeyUsage)
    .where(
      and(
        eq(apiKeyUsage.apiKeyId, apiKeyId),
        gt(apiKeyUsage.createdAt, startDate)
      )
    );

  // Get requests by day
  const byDay = await db
    .select({
      date: sql<string>`date_trunc('day', ${apiKeyUsage.createdAt})::date::text`,
      requests: sql<number>`count(*)::int`,
      tokens: sql<number>`coalesce(sum(${apiKeyUsage.totalTokens}), 0)::int`,
    })
    .from(apiKeyUsage)
    .where(
      and(
        eq(apiKeyUsage.apiKeyId, apiKeyId),
        gt(apiKeyUsage.createdAt, startDate)
      )
    )
    .groupBy(sql`date_trunc('day', ${apiKeyUsage.createdAt})`)
    .orderBy(sql`date_trunc('day', ${apiKeyUsage.createdAt})`);

  // Get requests by endpoint
  const byEndpoint = await db
    .select({
      endpoint: apiKeyUsage.endpoint,
      requests: sql<number>`count(*)::int`,
    })
    .from(apiKeyUsage)
    .where(
      and(
        eq(apiKeyUsage.apiKeyId, apiKeyId),
        gt(apiKeyUsage.createdAt, startDate)
      )
    )
    .groupBy(apiKeyUsage.endpoint)
    .orderBy(sql`count(*) desc`);

  const totalRequests = totals?.totalRequests ?? 0;
  const errorCount = totals?.errorCount ?? 0;

  return {
    totalRequests,
    totalTokens: totals?.totalTokens ?? 0,
    requestsByDay: byDay.map((d) => ({
      date: d.date,
      requests: d.requests,
      tokens: d.tokens,
    })),
    requestsByEndpoint: byEndpoint.map((e) => ({
      endpoint: e.endpoint,
      requests: e.requests,
    })),
    averageResponseTime: totals?.avgResponseTime ?? 0,
    errorRate: totalRequests > 0 ? errorCount / totalRequests : 0,
  };
}

/**
 * List API keys for a user or organization
 */
export async function listApiKeys(params: {
  userId?: string;
  orgId?: string;
}): Promise<Array<typeof apiKey.$inferSelect>> {
  const conditions = [];

  if (params.userId) {
    conditions.push(eq(apiKey.userId, params.userId));
  }
  if (params.orgId) {
    conditions.push(eq(apiKey.orgId, params.orgId));
  }

  if (conditions.length === 0) {
    return [];
  }

  return db
    .select()
    .from(apiKey)
    .where(conditions.length === 1 ? conditions[0] : and(...conditions))
    .orderBy(apiKey.createdAt);
}

/**
 * Revoke (disable) an API key
 */
export async function revokeApiKey(apiKeyId: string): Promise<void> {
  await db
    .update(apiKey)
    .set({ isActive: false })
    .where(eq(apiKey.id, apiKeyId));
}

/**
 * Delete an API key permanently
 */
export async function deleteApiKey(apiKeyId: string): Promise<void> {
  await db.delete(apiKey).where(eq(apiKey.id, apiKeyId));
}
