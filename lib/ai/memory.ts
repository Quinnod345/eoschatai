import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod/v3';
import { db } from '@/lib/db';
import { userMemory, userMemoryEmbedding } from '@/lib/db/schema';
import { generateChunks, generateEmbeddings } from '@/lib/ai/embeddings';

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

export async function classifyMemoryCandidate(
  text: string,
): Promise<MemoryDecision> {
  const result = await generateObject({
    model: openai('gpt-5-mini'),
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
  const [row] = await db
    .insert(userMemory)
    .values({
      userId: opts.userId,
      sourceMessageId: opts.sourceMessageId || null,
      summary: opts.summary,
      content: opts.content || null,
      topic: opts.topic || null,
      memoryType: (opts.memoryType || 'other') as any,
      confidence: typeof opts.confidence === 'number' ? opts.confidence : 60,
      status: 'active' as any,
      tags: null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  // Create embeddings
  try {
    const text = `${row.summary}\n\n${row.content || ''}`.trim();
    const chunks = generateChunks(text, 512);
    const embeddings = await generateEmbeddings(chunks);
    const values = embeddings.map((e) => ({
      memoryId: row.id,
      chunk: e.chunk,
      embedding: e.embedding as any,
    })) as any[];
    if (values.length > 0) await db.insert(userMemoryEmbedding).values(values);
  } catch (e) {
    console.error('Memory: failed to embed memory', e);
  }

  return row;
}
