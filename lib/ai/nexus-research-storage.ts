import { Redis } from '@upstash/redis';
import { db } from '@/lib/db';
import {
  nexusResearchSession,
  nexusResearchResult,
  nexusResearchEmbedding,
  nexusResearchReport,
  type NexusResearchSession,
  type NexusResearchResult,
  type NexusResearchReport,
} from '@/lib/db/schema';
import { eq, desc, and, sql } from 'drizzle-orm';
import { generateEmbedding, generateEmbeddings } from '@/lib/ai/embeddings';
import { put } from '@vercel/blob';

// Initialize Redis client
let redisClient: Redis | null = null;

function getRedisClient(): Redis | null {
  if (!redisClient) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
      console.warn('Redis not configured for Nexus research storage');
      return null;
    }

    redisClient = new Redis({ url, token });
  }

  return redisClient;
}

// Redis key generators
export const nexusRedisKeys = {
  // Real-time session tracking
  session: (sessionId: string) => `nexus:session:${sessionId}`,
  sessionProgress: (sessionId: string) => `nexus:session:${sessionId}:progress`,
  sessionPlan: (sessionId: string) => `nexus:session:${sessionId}:plan`,

  // Search progress tracking
  searchProgress: (sessionId: string, searchIndex: number) =>
    `nexus:search:${sessionId}:${searchIndex}:progress`,
  searchResults: (sessionId: string, searchIndex: number) =>
    `nexus:search:${sessionId}:${searchIndex}:results`,

  // Rate limiting
  rateLimit: (userId: string) => `nexus:ratelimit:${userId}`,

  // Cached results
  cachedSearch: (queryHash: string) => `nexus:cache:search:${queryHash}`,
  cachedReport: (sessionId: string, type: string) =>
    `nexus:cache:report:${sessionId}:${type}`,

  // User preferences
  userPreferences: (userId: string) => `nexus:user:${userId}:preferences`,

  // Active sessions
  activeSessions: () => 'nexus:sessions:active',
  userActiveSessions: (userId: string) => `nexus:sessions:user:${userId}`,
};

// Research plan structure
export interface ResearchPlan {
  mainQuery: string;
  subQuestions: string[];
  searchQueries: string[];
  researchApproach: 'comprehensive' | 'focused' | 'exploratory';
  estimatedDuration: number; // in seconds
  phases: {
    name: string;
    description: string;
    queries: string[];
  }[];
}

// Progress tracking structure
export interface ResearchProgress {
  phase: 'planning' | 'searching' | 'analyzing' | 'synthesizing' | 'generating';
  totalSearches: number;
  completedSearches: number;
  currentSearch?: string;
  currentSearchIndex?: number;
  sitesVisited: number;
  sourcesFound: number;
  startTime: number;
  estimatedTimeRemaining?: number;
  errors: string[];
}

// Create a new research session
export async function createResearchSession(
  userId: string,
  chatId: string | null,
  query: string,
  searchQueries: string[],
): Promise<string> {
  const session = await db
    .insert(nexusResearchSession)
    .values({
      userId,
      chatId,
      query,
      searchQueries,
      status: 'planning',
      totalSources: 0,
      completedSearches: 0,
    })
    .returning();

  const sessionId = session[0].id;
  const redis = getRedisClient();

  if (redis) {
    // Initialize Redis tracking
    const progress: ResearchProgress = {
      phase: 'planning',
      totalSearches: searchQueries.length,
      completedSearches: 0,
      sitesVisited: 0,
      sourcesFound: 0,
      startTime: Date.now(),
      errors: [],
    };

    await redis.setex(
      nexusRedisKeys.sessionProgress(sessionId),
      3600, // 1 hour TTL
      JSON.stringify(progress),
    );

    // Track active session
    await redis.sadd(nexusRedisKeys.activeSessions(), sessionId);
    await redis.sadd(nexusRedisKeys.userActiveSessions(userId), sessionId);

    // Set expiry on active session sets
    await redis.expire(nexusRedisKeys.userActiveSessions(userId), 3600);
  }

  return sessionId;
}

// Store research plan
export async function storeResearchPlan(
  sessionId: string,
  plan: ResearchPlan,
): Promise<void> {
  // Update database
  await db
    .update(nexusResearchSession)
    .set({
      researchPlan: plan,
      searchQueries: plan.searchQueries,
    })
    .where(eq(nexusResearchSession.id, sessionId));

  // Store in Redis for quick access
  const redis = getRedisClient();
  if (redis) {
    await redis.setex(
      nexusRedisKeys.sessionPlan(sessionId),
      3600,
      JSON.stringify(plan),
    );
  }
}

// Update research progress
export async function updateResearchProgress(
  sessionId: string,
  updates: Partial<ResearchProgress>,
): Promise<void> {
  const redis = getRedisClient();

  if (redis) {
    const key = nexusRedisKeys.sessionProgress(sessionId);
    const currentProgress = await redis.get(key);

    const progress: ResearchProgress = currentProgress
      ? { ...JSON.parse(currentProgress as string), ...updates }
      : {
          phase: 'searching',
          totalSearches: 0,
          completedSearches: 0,
          sitesVisited: 0,
          sourcesFound: 0,
          startTime: Date.now(),
          errors: [],
          ...updates,
        };

    // Calculate estimated time remaining
    if (progress.completedSearches > 0 && progress.totalSearches > 0) {
      const elapsedTime = Date.now() - progress.startTime;
      const timePerSearch = elapsedTime / progress.completedSearches;
      const remainingSearches =
        progress.totalSearches - progress.completedSearches;
      progress.estimatedTimeRemaining = Math.round(
        (timePerSearch * remainingSearches) / 1000,
      );
    }

    await redis.setex(key, 3600, JSON.stringify(progress));
  }

  // Update database status if phase changed
  if (updates.phase) {
    const dbStatus =
      updates.phase === 'generating' ? 'synthesizing' : updates.phase;
    await db
      .update(nexusResearchSession)
      .set({
        status: dbStatus,
        completedSearches: updates.completedSearches || 0,
        totalSources: updates.sourcesFound || 0,
      })
      .where(eq(nexusResearchSession.id, sessionId));
  }
}

// Store research result
export async function storeResearchResult(
  sessionId: string,
  searchQuery: string,
  result: {
    url: string;
    title: string;
    snippet: string;
    content?: string;
    sourceType?:
      | 'web'
      | 'academic'
      | 'news'
      | 'documentation'
      | 'forum'
      | 'other';
    relevanceScore?: number;
  },
): Promise<string> {
  const [dbResult] = await db
    .insert(nexusResearchResult)
    .values({
      sessionId,
      searchQuery,
      url: result.url,
      title: result.title,
      snippet: result.snippet,
      content: result.content,
      sourceType: result.sourceType || 'web',
      relevanceScore: result.relevanceScore,
    })
    .returning();

  // Store embeddings if content is available
  if (result.content) {
    await storeResearchEmbeddings(sessionId, dbResult.id, result.content);
  }

  return dbResult.id;
}

// Store research embeddings
async function storeResearchEmbeddings(
  sessionId: string,
  resultId: string,
  content: string,
): Promise<void> {
  // Split content into chunks
  const chunks = splitIntoChunks(content, 1000, 200);

  // Generate embeddings for all chunks
  const embeddings = await generateEmbeddings(chunks);

  // Store in database
  const embeddingRecords = embeddings.map(({ chunk, embedding }) => ({
    sessionId,
    resultId,
    chunk,
    embedding,
  }));

  await db.insert(nexusResearchEmbedding).values(embeddingRecords);
}

// Helper function to split text into chunks
function splitIntoChunks(
  text: string,
  maxLength: number,
  overlap: number,
): string[] {
  const chunks = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + maxLength, text.length);
    chunks.push(text.slice(start, end));
    start = end - overlap;
  }

  return chunks;
}

// Store compiled research report
export async function storeResearchReport(
  sessionId: string,
  reportType: 'summary' | 'detailed' | 'technical' | 'executive',
  content: string,
  sections?: any,
  citations?: any[],
  visualizations?: any[],
): Promise<void> {
  // Store in database
  await db.insert(nexusResearchReport).values({
    sessionId,
    reportType,
    content,
    sections,
    citations,
    visualizations,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
  });

  // Cache in Redis
  const redis = getRedisClient();
  if (redis) {
    await redis.setex(
      nexusRedisKeys.cachedReport(sessionId, reportType),
      86400, // 24 hours
      JSON.stringify({ content, sections, citations, visualizations }),
    );
  }
}

// Get research progress
export async function getResearchProgress(
  sessionId: string,
): Promise<ResearchProgress | null> {
  const redis = getRedisClient();

  if (redis) {
    const progress = await redis.get(nexusRedisKeys.sessionProgress(sessionId));
    if (progress) {
      return JSON.parse(progress as string);
    }
  }

  // Fallback to database
  const session = await db
    .select()
    .from(nexusResearchSession)
    .where(eq(nexusResearchSession.id, sessionId))
    .limit(1);

  if (session.length === 0) return null;

  return {
    phase: session[0].status as any,
    totalSearches: (session[0].searchQueries as string[]).length,
    completedSearches: session[0].completedSearches || 0,
    sitesVisited: 0,
    sourcesFound: session[0].totalSources || 0,
    startTime: session[0].createdAt.getTime(),
    errors: [],
  };
}

// Get cached research report
export async function getCachedReport(
  sessionId: string,
  reportType: string,
): Promise<{
  content: string;
  sections?: any;
  citations?: any[];
  visualizations?: any[];
} | null> {
  const redis = getRedisClient();

  if (redis) {
    const cached = await redis.get(
      nexusRedisKeys.cachedReport(sessionId, reportType),
    );
    if (cached) {
      return JSON.parse(cached as string);
    }
  }

  // Fallback to database
  const report = await db
    .select()
    .from(nexusResearchReport)
    .where(
      and(
        eq(nexusResearchReport.sessionId, sessionId),
        eq(nexusResearchReport.reportType, reportType as any),
      ),
    )
    .limit(1);

  if (report.length === 0) return null;

  return {
    content: report[0].content,
    sections: report[0].sections,
    citations: report[0].citations as any[],
    visualizations: report[0].visualizations as any[],
  };
}

// Search similar research results using embeddings
export async function searchSimilarResearch(
  query: string,
  userId?: string,
  limit = 10,
): Promise<
  Array<{
    sessionId: string;
    content: string;
    relevance: number;
    metadata: any;
  }>
> {
  const embedding = await generateEmbedding(query);

  // Query database for similar embeddings
  const baseQuery = db
    .select({
      session_id: nexusResearchEmbedding.sessionId,
      chunk: nexusResearchEmbedding.chunk,
      similarity: sql<number>`1 - (${nexusResearchEmbedding.embedding} <=> ${JSON.stringify(embedding)})`,
      query: nexusResearchSession.query,
      created_at: nexusResearchSession.createdAt,
    })
    .from(nexusResearchEmbedding)
    .innerJoin(
      nexusResearchSession,
      eq(nexusResearchEmbedding.sessionId, nexusResearchSession.id),
    )
    .orderBy(
      sql`1 - (${nexusResearchEmbedding.embedding} <=> ${JSON.stringify(embedding)}) DESC`,
    )
    .limit(limit);

  const results = userId
    ? await baseQuery.where(eq(nexusResearchSession.userId, userId))
    : await baseQuery;

  return results.map((row) => ({
    sessionId: row.session_id,
    content: row.chunk,
    relevance: row.similarity,
    metadata: {
      originalQuery: row.query,
      createdAt: row.created_at,
    },
  }));
}

// Clean up expired sessions
export async function cleanupExpiredSessions(): Promise<void> {
  const redis = getRedisClient();

  if (redis) {
    // Get all active sessions
    const activeSessions = await redis.smembers(
      nexusRedisKeys.activeSessions(),
    );

    for (const sessionId of activeSessions) {
      // Check if session still has progress data
      const progress = await redis.get(
        nexusRedisKeys.sessionProgress(sessionId),
      );

      if (!progress) {
        // Remove from active sessions
        await redis.srem(nexusRedisKeys.activeSessions(), sessionId);
      }
    }
  }

  // Clean up old database records
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Delete old reports
  await db
    .delete(nexusResearchReport)
    .where(eq(nexusResearchReport.expiresAt, thirtyDaysAgo));
}

// Store research source in blob storage
export async function storeResearchSource(
  sessionId: string,
  url: string,
  content: string,
  contentType = 'text/html',
): Promise<string> {
  try {
    const filename = `nexus-research/${sessionId}/${encodeURIComponent(url)}.html`;
    const blob = await put(filename, content, {
      access: 'public',
      contentType,
    });

    return blob.url;
  } catch (error) {
    console.error('Failed to store research source:', error);
    // Return empty string on error - non-critical
    return '';
  }
}

// Get user's recent research sessions
export async function getUserResearchSessions(
  userId: string,
  limit = 10,
): Promise<NexusResearchSession[]> {
  return await db
    .select()
    .from(nexusResearchSession)
    .where(eq(nexusResearchSession.userId, userId))
    .orderBy(desc(nexusResearchSession.createdAt))
    .limit(limit);
}

// Check rate limit for user
export async function checkRateLimit(
  userId: string,
): Promise<{ allowed: boolean; retryAfter?: number }> {
  const redis = getRedisClient();

  if (!redis) {
    // No rate limiting without Redis
    return { allowed: true };
  }

  const key = nexusRedisKeys.rateLimit(userId);
  const current = await redis.incr(key);

  if (current === 1) {
    // First request, set expiry
    await redis.expire(key, 3600); // 1 hour window
  }

  const limit = 10; // 10 nexus searches per hour

  if (current > limit) {
    const ttl = await redis.ttl(key);
    return { allowed: false, retryAfter: ttl };
  }

  return { allowed: true };
}
