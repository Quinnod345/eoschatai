import { db } from '@/lib/db';
import { userMemory, userMemoryEmbedding } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { openai } from '@ai-sdk/openai';
import { embed } from 'ai';

/**
 * Memory object structure returned by RAG retrieval
 */
export interface RelevantMemory {
  id: string;
  summary: string;
  content: string | null;
  memoryType: string;
  confidence: number;
  topic: string | null;
  relevance: number;
  createdAt: Date;
}

/**
 * Configuration for memory retrieval
 */
export interface MemorySearchConfig {
  limit?: number;
  threshold?: number;
  fallbackThreshold?: number;
  minConfidence?: number;
  boostRecent?: boolean;
  recencyBoostDays?: number;
}

const DEFAULT_CONFIG: Required<MemorySearchConfig> = {
  limit: 10,
  threshold: 0.4,
  fallbackThreshold: 0.2,
  minConfidence: 40,
  boostRecent: true,
  recencyBoostDays: 30,
};

/**
 * Calculate a combined relevance score considering similarity, confidence, and recency
 * @param similarity - Vector similarity score (0-1)
 * @param confidence - Memory confidence score (0-100)
 * @param createdAt - When the memory was created
 * @param config - Search configuration
 * @returns Combined relevance score (0-1)
 */
function calculateCombinedRelevance(
  similarity: number,
  confidence: number,
  createdAt: Date,
  config: Required<MemorySearchConfig>,
): number {
  // Normalize confidence to 0-1 scale
  const normalizedConfidence = (confidence || 60) / 100;

  // Calculate recency boost (memories from last N days get a slight boost)
  let recencyBoost = 0;
  if (config.boostRecent) {
    const ageInDays =
      (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
    if (ageInDays <= config.recencyBoostDays) {
      // Linear decay from 0.1 to 0 over recencyBoostDays
      recencyBoost = 0.1 * (1 - ageInDays / config.recencyBoostDays);
    }
  }

  // Weighted combination: 70% similarity, 20% confidence, 10% recency
  const combinedScore =
    similarity * 0.7 + normalizedConfidence * 0.2 + recencyBoost;

  return Math.min(1, combinedScore);
}

/**
 * Find relevant memories from the user's memory bank using vector similarity search
 * @param userId - The user's ID
 * @param query - The search query
 * @param limitOrConfig - Maximum number of memories OR config object
 * @param threshold - Minimum similarity threshold 0-1 (default: 0.4, more lenient than documents)
 * @returns Array of relevant memories with relevance scores
 */
export async function findRelevantMemories(
  userId: string,
  query: string,
  limitOrConfig: number | MemorySearchConfig = 10,
  threshold = 0.4,
): Promise<RelevantMemory[]> {
  // Support both old (limit, threshold) and new (config) signatures
  const config: Required<MemorySearchConfig> =
    typeof limitOrConfig === 'number'
      ? { ...DEFAULT_CONFIG, limit: limitOrConfig, threshold }
      : { ...DEFAULT_CONFIG, ...limitOrConfig };
  try {
    console.log(
      `Memory RAG: Searching for user ${userId} with query: "${query}"`,
    );

    // First, check if there are ANY memories with embeddings for this user
    const memoriesWithEmbeddings = await db
      .select({ count: sql<number>`count(DISTINCT ${userMemory.id})` })
      .from(userMemory)
      .innerJoin(
        userMemoryEmbedding,
        eq(userMemory.id, userMemoryEmbedding.memoryId),
      )
      .where(
        and(
          eq(userMemory.userId, userId),
          eq(userMemory.status, 'active'),
        ),
      );

    const memoryCount = memoriesWithEmbeddings[0]?.count || 0;
    console.log(
      `Memory RAG: User has ${memoryCount} memories with embeddings`,
    );

    if (memoryCount === 0) {
      console.log(
        'Memory RAG: No memories with embeddings found. Checking for memories without embeddings...',
      );

      // Fallback: Get all active memories (no vector search)
      const allMemories = await db
        .select()
        .from(userMemory)
        .where(
          and(
            eq(userMemory.userId, userId),
            eq(userMemory.status, 'active'),
          ),
        )
        .limit(config.limit);

      if (allMemories.length > 0) {
        console.log(
          `Memory RAG: Found ${allMemories.length} memories without embeddings (will be returned as-is)`,
        );
        console.warn(
          '⚠️  IMPORTANT: Memories found but missing embeddings. Run: pnpm tsx scripts/backfill-memory-embeddings.ts',
        );

        return allMemories.map((memory) => ({
          id: memory.id,
          summary: memory.summary,
          content: memory.content,
          memoryType: memory.memoryType || 'other',
          confidence: memory.confidence || 60,
          topic: memory.topic,
          relevance: 0.6, // Default relevance since we can't compute it
          createdAt: memory.createdAt,
        }));
      } else {
        console.log('Memory RAG: No memories found for this user');
        return [];
      }
    }

    // Generate embedding for the query
    const { embedding } = await embed({
      model: openai.embedding('text-embedding-ada-002'),
      value: query,
    });

    // Search for similar memories using pgvector cosine similarity
    // Only include active memories with confidence above minimum
    const results = await db
      .select({
        id: userMemory.id,
        summary: userMemory.summary,
        content: userMemory.content,
        memoryType: userMemory.memoryType,
        confidence: userMemory.confidence,
        topic: userMemory.topic,
        createdAt: userMemory.createdAt,
        similarity: sql<number>`1 - (${userMemoryEmbedding.embedding} <=> ${JSON.stringify(embedding)})`,
      })
      .from(userMemory)
      .innerJoin(
        userMemoryEmbedding,
        eq(userMemory.id, userMemoryEmbedding.memoryId),
      )
      .where(
        and(
          eq(userMemory.userId, userId),
          eq(userMemory.status, 'active'),
          sql`${userMemory.confidence} > ${config.minConfidence}`,
          sql`1 - (${userMemoryEmbedding.embedding} <=> ${JSON.stringify(embedding)}) > ${config.threshold}`,
        ),
      )
      .orderBy(
        sql`1 - (${userMemoryEmbedding.embedding} <=> ${JSON.stringify(embedding)}) DESC`,
      )
      .limit(config.limit);

    console.log(
      `Memory RAG: Found ${results.length} relevant memories for user (threshold: ${config.threshold})`,
    );

    if (results.length === 0) {
      console.log(
        `Memory RAG: No memories above threshold ${config.threshold}, trying fallback threshold ${config.fallbackThreshold}...`,
      );

      // Try again with lower fallback threshold
      const lowerResults = await db
        .select({
          id: userMemory.id,
          summary: userMemory.summary,
          content: userMemory.content,
          memoryType: userMemory.memoryType,
          confidence: userMemory.confidence,
          topic: userMemory.topic,
          createdAt: userMemory.createdAt,
          similarity: sql<number>`1 - (${userMemoryEmbedding.embedding} <=> ${JSON.stringify(embedding)})`,
        })
        .from(userMemory)
        .innerJoin(
          userMemoryEmbedding,
          eq(userMemory.id, userMemoryEmbedding.memoryId),
        )
        .where(
          and(
            eq(userMemory.userId, userId),
            eq(userMemory.status, 'active'),
            sql`${userMemory.confidence} > ${config.minConfidence}`,
            sql`1 - (${userMemoryEmbedding.embedding} <=> ${JSON.stringify(embedding)}) > ${config.fallbackThreshold}`,
          ),
        )
        .orderBy(
          sql`1 - (${userMemoryEmbedding.embedding} <=> ${JSON.stringify(embedding)}) DESC`,
        )
        .limit(config.limit);

      console.log(
        `Memory RAG: Found ${lowerResults.length} memories with fallback threshold ${config.fallbackThreshold}`,
      );

      // Return formatted memory objects with combined relevance scoring
      return lowerResults.map((result) => ({
        id: result.id,
        summary: result.summary,
        content: result.content,
        memoryType: result.memoryType || 'other',
        confidence: result.confidence || 60,
        topic: result.topic,
        relevance: calculateCombinedRelevance(
          result.similarity,
          result.confidence || 60,
          result.createdAt,
          config,
        ),
        createdAt: result.createdAt,
      }));
    }

    // Return formatted memory objects with combined relevance scoring
    return results.map((result) => ({
      id: result.id,
      summary: result.summary,
      content: result.content,
      memoryType: result.memoryType || 'other',
      confidence: result.confidence || 60,
      topic: result.topic,
      relevance: calculateCombinedRelevance(
        result.similarity,
        result.confidence || 60,
        result.createdAt,
        config,
      ),
      createdAt: result.createdAt,
    }));
  } catch (error) {
    console.error('Memory RAG: Error finding relevant memories:', error);
    return [];
  }
}

/**
 * Retrieve the N most recently created active memories for a user.
 * These are always included in context regardless of query similarity,
 * ensuring recent context is never lost (like reading today's notes).
 */
export async function getRecentMemories(
  userId: string,
  limit = 5,
): Promise<RelevantMemory[]> {
  try {
    const results = await db
      .select()
      .from(userMemory)
      .where(
        and(eq(userMemory.userId, userId), eq(userMemory.status, 'active')),
      )
      .orderBy(sql`${userMemory.createdAt} DESC`)
      .limit(limit);

    return results.map((memory) => ({
      id: memory.id,
      summary: memory.summary,
      content: memory.content,
      memoryType: memory.memoryType || 'other',
      confidence: memory.confidence || 60,
      topic: memory.topic,
      relevance: 0.7, // Default relevance for recency-based retrieval
      createdAt: memory.createdAt,
    }));
  } catch (error) {
    console.error('Memory RAG: Error fetching recent memories:', error);
    return [];
  }
}

/**
 * Format memories into a structured prompt section
 * @param memories - Array of relevant memories
 * @returns Formatted prompt string
 */
export function formatMemoriesForPrompt(memories: RelevantMemory[]): string {
  if (!memories || memories.length === 0) {
    return '';
  }

  // Group memories by type
  const groupedByType = memories.reduce(
    (acc, memory) => {
      const type = memory.memoryType;
      if (!acc[type]) {
        acc[type] = [];
      }
      acc[type].push(memory);
      return acc;
    },
    {} as Record<string, RelevantMemory[]>,
  );

  // Type labels for display
  const typeLabels: Record<string, string> = {
    preference: 'User Preferences',
    profile: 'Personal Profile',
    company: 'Company Information',
    task: 'Tasks & Actions',
    knowledge: 'Knowledge & Facts',
    personal: 'Personal Context',
    other: 'Other Information',
  };

  // Build the formatted output
  let output = `## USER MEMORIES
The following are facts remembered about this user from previous conversations:

`;

  // Sort types by priority
  const typePriority = [
    'preference',
    'company',
    'profile',
    'knowledge',
    'task',
    'personal',
    'other',
  ];

  for (const type of typePriority) {
    if (groupedByType[type] && groupedByType[type].length > 0) {
      const typeMemories = groupedByType[type];
      const avgConfidence = Math.round(
        typeMemories.reduce((sum, m) => sum + m.confidence, 0) /
          typeMemories.length,
      );

      output += `### ${typeLabels[type]} (Confidence: ${avgConfidence}%)\n`;

      for (const memory of typeMemories) {
        // Include both summary and content if available
        const text = memory.content || memory.summary;
        output += `- ${text}`;

        // Add topic if available and different from content
        if (memory.topic && !text.includes(memory.topic)) {
          output += ` [Topic: ${memory.topic}]`;
        }

        // Add relevance indicator for highly relevant memories
        if (memory.relevance > 0.8) {
          output += ` 🎯`;
        }

        output += '\n';
      }

      output += '\n';
    }
  }

  output += `**MEMORY INSTRUCTIONS:**
1. These facts were learned from previous conversations with this user
2. Reference them naturally — do NOT announce "I remember that..." unprompted
3. If a memory contradicts the current conversation, follow what the user says now
4. Use memories to personalize responses and maintain continuity

`;

  return output;
}

