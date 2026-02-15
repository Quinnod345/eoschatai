import { anthropic } from '@ai-sdk/anthropic';
import { generateObject } from 'ai';
import { z } from 'zod/v3';
import { db } from '@/lib/db';
import { userMemory, userMemoryEmbedding } from '@/lib/db/schema';
import { generateChunks, generateEmbeddings } from '@/lib/ai/embeddings';
import { eq, sql } from 'drizzle-orm';

const MemoryDecisionSchema = z.object({
  shouldSave: z.boolean(),
  summary: z.string().optional(),
  memoryType: z
    .enum([
      'preference',
      'profile',
      'company',
      'task',
      'knowledge',
      'personal',
      'other',
    ])
    .optional(),
  topic: z.string().optional(),
  confidence: z.number().min(0).max(100).optional(),
});

export type MemoryDecision = z.infer<typeof MemoryDecisionSchema>;

export function normalizeMemorySummary(summary: string): string {
  return summary.replace(/\s+/g, ' ').trim();
}

export function buildMemoryDedupeKey(summary: string): string | null {
  const normalized = normalizeMemorySummary(summary).toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

export async function classifyMemoryCandidate(
  text: string,
): Promise<MemoryDecision> {
  const result = await generateObject({
    model: anthropic('claude-3-5-haiku-20241022'),
    schema: MemoryDecisionSchema,
    system:
      'You are a conservative memory classifier. Save only clear, stable, reusable facts/preferences. Avoid one-off or sensitive details. Return conservative confidence.',
    prompt: `User text to consider saving:\n${text}\nRespond with fields only.`,
  });
  return result.object;
}

export async function saveUserMemory(opts: {
  userId: string;
  sourceMessageId?: string;
  summary: string;
  content?: string;
  topic?: string;
  memoryType?:
    | 'preference'
    | 'profile'
    | 'company'
    | 'task'
    | 'knowledge'
    | 'personal'
    | 'other';
  confidence?: number;
}) {
  const now = new Date();
  const normalizedSummary = normalizeMemorySummary(opts.summary);
  const dedupeKey = buildMemoryDedupeKey(normalizedSummary);

  const [row] = await db
    .insert(userMemory)
    .values({
      userId: opts.userId,
      sourceMessageId: opts.sourceMessageId || null,
      summary: normalizedSummary,
      content: opts.content || null,
      topic: opts.topic || null,
      memoryType: (opts.memoryType || 'other') as any,
      confidence: typeof opts.confidence === 'number' ? opts.confidence : 60,
      status: 'active' as any,
      dedupeKey,
      tags: null,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        userMemory.userId,
        userMemory.memoryType,
        userMemory.status,
        userMemory.dedupeKey,
      ],
      set: {
        sourceMessageId: sql`COALESCE(excluded."sourceMessageId", ${userMemory.sourceMessageId})`,
        content: sql`COALESCE(excluded."content", ${userMemory.content})`,
        topic: sql`COALESCE(excluded."topic", ${userMemory.topic})`,
        confidence: sql`GREATEST(excluded."confidence", ${userMemory.confidence})`,
        updatedAt: now,
      },
    })
    .returning();

  // Create embeddings
  try {
    const text = `${row.summary}\n\n${row.content || ''}`.trim();
    const chunks = generateChunks(text, 512);
    const embeddings = await generateEmbeddings(chunks);
    const existingChunks = await db
      .select({ chunk: userMemoryEmbedding.chunk })
      .from(userMemoryEmbedding)
      .where(eq(userMemoryEmbedding.memoryId, row.id));

    const existingChunkSet = new Set(existingChunks.map((chunk) => chunk.chunk));
    const values = embeddings
      .filter((embedding) => !existingChunkSet.has(embedding.chunk))
      .map((embedding) => ({
        memoryId: row.id,
        chunk: embedding.chunk,
        embedding: embedding.embedding as any,
      })) as any[];

    if (values.length > 0) {
      await db.insert(userMemoryEmbedding).values(values);
    }
  } catch (e) {
    console.error('Memory: failed to embed memory', e);
  }

  return row;
}
