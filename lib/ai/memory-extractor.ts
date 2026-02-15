import { generateText, embedMany } from 'ai';
import { openai } from '@ai-sdk/openai';
import { db } from '@/lib/db';
import { userMemory, userMemoryEmbedding } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { buildMemoryDedupeKey, saveUserMemory } from '@/lib/ai/memory';
import { createCustomProvider } from '@/lib/ai/providers';

// Valid memory types matching the schema enum
type MemoryType =
  | 'preference'
  | 'profile'
  | 'company'
  | 'task'
  | 'knowledge'
  | 'personal'
  | 'other';

const VALID_TYPES = new Set<MemoryType>([
  'preference',
  'profile',
  'company',
  'task',
  'knowledge',
  'personal',
  'other',
]);

interface ExtractedFact {
  summary: string;
  type: MemoryType;
  confidence: number;
}

interface DedupeResult {
  action: 'create' | 'boost' | 'skip';
  existingId?: string;
}

/**
 * Check if a memory is a duplicate using a pre-computed embedding.
 * Avoids redundant embedding generation by accepting the vector directly.
 */
async function deduplicateWithEmbedding(
  userId: string,
  embedding: number[],
  memoryType: string,
  summaryPreview: string,
): Promise<DedupeResult> {
  try {
    const similar = await db
      .select({
        id: userMemory.id,
        summary: userMemory.summary,
        memoryType: userMemory.memoryType,
        confidence: userMemory.confidence,
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
          sql`1 - (${userMemoryEmbedding.embedding} <=> ${JSON.stringify(embedding)}) > 0.85`,
        ),
      )
      .orderBy(
        sql`1 - (${userMemoryEmbedding.embedding} <=> ${JSON.stringify(embedding)}) DESC`,
      )
      .limit(1);

    if (similar.length === 0) {
      return { action: 'create' };
    }

    const match = similar[0];

    if (match.similarity > 0.92 && match.memoryType === memoryType) {
      console.log(
        `[AutoMemory] Skipping duplicate (${match.similarity.toFixed(3)}): "${summaryPreview}"`,
      );
      return { action: 'skip', existingId: match.id };
    }

    console.log(
      `[AutoMemory] Boosting existing (${match.similarity.toFixed(3)}): "${match.summary.substring(0, 60)}..."`,
    );
    return { action: 'boost', existingId: match.id };
  } catch (error) {
    console.error('[AutoMemory] Dedup check failed:', error);
    // Be conservative when dedup verification fails. The DB-level unique index
    // still guards against races in saveUserMemory, but this avoids noisy inserts
    // when similarity checks are temporarily unavailable.
    return { action: 'skip' };
  }
}

/**
 * Extract memorable facts from a conversation turn and save them.
 * Fully parallelized: batch-embeds all facts in one API call,
 * runs all dedup checks concurrently, then executes all writes concurrently.
 */
export async function extractAndSaveMemories(opts: {
  userId: string;
  chatId: string;
  userMessage: string;
  assistantMessage: string;
  existingMemories?: string;
  sourceMessageId?: string;
}): Promise<{ saved: number; updated: number }> {
  const {
    userId,
    userMessage,
    assistantMessage,
    existingMemories,
    sourceMessageId,
  } = opts;

  try {
    const provider = createCustomProvider();

    // Step 1: Extract facts via Haiku
    const { text } = await generateText({
      model: provider.languageModel('preflight-model'),
      system: `You are a memory extraction system. Analyze the conversation turn below and extract ANY factual information, preferences, or personal details the USER shared or confirmed.

Be LIBERAL about what you extract. Even short or simple statements reveal something worth remembering.

EXTRACT (be inclusive — when in doubt, extract it):
- Personal preferences and likes/dislikes ("I like X", "I prefer Y", "I hate Z")
- Facts about the user's life, habits, family, pets, hobbies, or interests
- Factual statements about their company, team, role, or industry
- Communication or work style preferences
- Decisions or conclusions the user reached
- Important names, numbers, dates, or specifics the user shared
- Business metrics, goals, or challenges the user mentioned
- Opinions, values, or beliefs the user expressed

DO NOT EXTRACT:
- Pure greetings with zero informational content ("hi", "thanks", "ok", "got it")
- Information the AI provided that the user did NOT confirm or expand upon
- Anything already in the EXISTING MEMORIES section below

Even short statements like "I like apples" or "I have 2 dogs" or "We use Slack" contain meaningful personal facts — ALWAYS extract these.

Assign each fact:
- type: one of "preference", "profile", "company", "task", "knowledge", "personal"
- confidence: 60-90 based on how explicitly the user stated it (60=implied, 75=stated clearly, 90=emphasized/repeated)

Return a JSON array. If the user truly shared nothing personal or factual (e.g. just said "hi" or asked a generic question), return [].
Format: [{"summary":"...","type":"...","confidence":N}, ...]

EXISTING MEMORIES (do not re-extract these):
${existingMemories || 'None yet.'}`,
      prompt: `USER MESSAGE:\n${userMessage}\n\nASSISTANT RESPONSE:\n${assistantMessage.substring(0, 2000)}`,
      maxOutputTokens: 512,
      temperature: 0,
    });

    // Step 2: Parse facts
    console.log(
      `[AutoMemory] Raw extraction response: "${text.substring(0, 300)}"`,
    );
    let facts: ExtractedFact[] = [];
    try {
      const cleaned = text.trim().replace(/^```json\s*|\s*```$/g, '');
      let parsed: unknown;
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        // Haiku sometimes wraps the array in prose or markdown. Extract the
        // first top-level [...] block and retry.
        const firstBracket = cleaned.indexOf('[');
        const lastBracket = cleaned.lastIndexOf(']');
        if (firstBracket !== -1 && lastBracket > firstBracket) {
          try {
            parsed = JSON.parse(cleaned.slice(firstBracket, lastBracket + 1));
          } catch {
            console.log(
              `[AutoMemory] Failed to parse extraction response: "${cleaned.substring(0, 200)}"`,
            );
            return { saved: 0, updated: 0 };
          }
        } else {
          console.log(
            `[AutoMemory] No JSON array found in extraction response: "${cleaned.substring(0, 200)}"`,
          );
          return { saved: 0, updated: 0 };
        }
      }
      if (Array.isArray(parsed)) {
        facts = parsed.filter(
          (f: any) =>
            f &&
            typeof f.summary === 'string' &&
            f.summary.length > 5 &&
            typeof f.type === 'string' &&
            typeof f.confidence === 'number',
        );
      }
    } catch (e) {
      console.log('[AutoMemory] Unexpected parse error:', e);
      return { saved: 0, updated: 0 };
    }

    if (facts.length === 0) {
      console.log(
        `[AutoMemory] Model returned no extractable facts for: "${opts.userMessage.substring(0, 80)}"`,
      );
      return { saved: 0, updated: 0 };
    }

    // Drop duplicate facts returned by the extractor in this same turn.
    const seenFactKeys = new Set<string>();
    facts = facts.filter((fact) => {
      const memoryType: MemoryType = VALID_TYPES.has(fact.type as MemoryType)
        ? (fact.type as MemoryType)
        : 'other';
      const dedupeKey = buildMemoryDedupeKey(fact.summary);
      if (!dedupeKey) return false;

      const factKey = `${memoryType}:${dedupeKey}`;
      if (seenFactKeys.has(factKey)) return false;

      seenFactKeys.add(factKey);
      return true;
    });

    if (facts.length === 0) {
      console.log('[AutoMemory] Candidate facts collapsed to 0 after dedupe');
      return { saved: 0, updated: 0 };
    }

    console.log(
      `[AutoMemory] Extracted ${facts.length} candidate facts, batch-processing`,
    );

    // Step 3: Batch-embed ALL fact summaries in a single API call
    const { embeddings } = await embedMany({
      model: openai.embedding('text-embedding-3-small'),
      values: facts.map((f) => f.summary),
    });

    // Step 4: Run ALL dedup checks in parallel
    const dedupeResults = await Promise.all(
      facts.map((fact, i) => {
        const memoryType: MemoryType = VALID_TYPES.has(fact.type as MemoryType)
          ? (fact.type as MemoryType)
          : 'other';
        return deduplicateWithEmbedding(
          userId,
          embeddings[i],
          memoryType,
          fact.summary.substring(0, 60),
        );
      }),
    );

    // Step 5: Execute all writes in parallel (saves + boosts)
    const writeOps: Promise<void>[] = [];
    let saved = 0;
    let updated = 0;

    for (let i = 0; i < facts.length; i++) {
      const fact = facts[i];
      const result = dedupeResults[i];
      const memoryType: MemoryType = VALID_TYPES.has(fact.type as MemoryType)
        ? (fact.type as MemoryType)
        : 'other';

      switch (result.action) {
        case 'skip':
          break;

        case 'boost':
          if (result.existingId) {
            updated++;
            const memId = result.existingId;
            writeOps.push(
              db
                .update(userMemory)
                .set({
                  confidence: sql`LEAST(${userMemory.confidence} + 5, 95)`,
                  updatedAt: new Date(),
                })
                .where(eq(userMemory.id, memId))
                .then(() => undefined)
                .catch((e) => console.error('[AutoMemory] Boost failed:', e)),
            );
          }
          break;

        case 'create':
          saved++;
          writeOps.push(
            saveUserMemory({
              userId,
              sourceMessageId,
              summary: fact.summary,
              content: fact.summary,
              memoryType,
              confidence: Math.min(90, Math.max(60, fact.confidence)),
            })
              .then(() =>
                console.log(
                  `[AutoMemory] Saved: "${fact.summary.substring(0, 80)}..." (${memoryType})`,
                ),
              )
              .catch((e) =>
                console.error(
                  `[AutoMemory] Save failed for "${fact.summary.substring(0, 40)}...":`,
                  e,
                ),
              ),
          );
          break;
      }
    }

    // Wait for all writes to finish
    await Promise.all(writeOps);

    console.log(
      `[AutoMemory] Complete: ${saved} new, ${updated} boosted, ${facts.length - saved - updated} skipped`,
    );
    return { saved, updated };
  } catch (error) {
    console.error('[AutoMemory] Extraction failed:', error);
    return { saved: 0, updated: 0 };
  }
}
