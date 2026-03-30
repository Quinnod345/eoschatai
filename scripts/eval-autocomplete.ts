/**
 * Offline evaluation for autocomplete ranking quality.
 *
 * Tests both Tier 1 (instant local prefix match) and Tier 2 (vector semantic search).
 * Computes Recall@3 and MRR@3 for each tier and combined.
 *
 * Usage:
 *   npx tsx scripts/eval-autocomplete.ts
 */

import * as dotenv from 'dotenv';
import path from 'node:path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { AUTOCOMPLETE_CORPUS } from '@/lib/predictive/corpus';
import { embed } from 'ai';
import { openai } from '@ai-sdk/openai';
import { Index } from '@upstash/vector';

const embeddingModel = openai.embedding('text-embedding-3-small');
const AUTOCOMPLETE_NAMESPACE = 'autocomplete';

interface EvalCase {
  prefix: string;
  expectedPhrase: string;
}

const EVAL_CASES: EvalCase[] = [
  { prefix: 'What are my Level 10', expectedPhrase: 'What are my Level 10 meeting headlines today?' },
  { prefix: 'Show my EOS', expectedPhrase: 'Show my EOS Scorecard metrics for this week' },
  { prefix: 'Help me prepare', expectedPhrase: 'Help me prepare for our EOS quarterly planning session' },
  { prefix: 'Summarize the issues', expectedPhrase: 'Summarize the issues list from our last Level 10' },
  { prefix: 'Draft a follow', expectedPhrase: 'Draft a follow-up for the IDS topics we resolved' },
  { prefix: 'Create a rock', expectedPhrase: 'Create a rock for increasing weekly qualified leads' },
  { prefix: 'What measurables', expectedPhrase: 'What measurables are off track this week?' },
  { prefix: 'Show my rocks', expectedPhrase: 'Show my rocks for this quarter' },
  { prefix: 'Help me run', expectedPhrase: 'Help me run a better meeting' },
  { prefix: 'Review our V/TO', expectedPhrase: 'Review our V/TO core values' },
  { prefix: 'Help me write', expectedPhrase: 'Help me write a SMART rock' },
  { prefix: 'accountability gaps', expectedPhrase: 'Analyze accountability gaps from the People Analyzer' },
  { prefix: 'scorecard trends', expectedPhrase: 'Analyze scorecard trends over the last quarter' },
  { prefix: 'delegate', expectedPhrase: 'Help me delegate and elevate my tasks' },
  { prefix: 'meeting summary', expectedPhrase: 'Draft a meeting summary email' },
];

function localPrefixMatch(prefix: string): string[] {
  const lower = prefix.toLowerCase();
  return AUTOCOMPLETE_CORPUS
    .filter((p) => p.text.toLowerCase().startsWith(lower))
    .sort((a, b) => b.score - a.score)
    .map((p) => p.text)
    .slice(0, 3);
}

async function vectorMatch(prefix: string): Promise<string[]> {
  const url = process.env.UPSTASH_VECTOR_REST_URL;
  const token = process.env.UPSTASH_VECTOR_REST_TOKEN;
  if (!url || !token) return [];

  try {
    const client = new Index({ url, token });
    const ns = client.namespace(AUTOCOMPLETE_NAMESPACE);
    const { embedding } = await embed({ model: embeddingModel, value: prefix });
    const results = await ns.query({
      vector: embedding,
      topK: 5,
      includeMetadata: true,
      includeVectors: false,
    });
    return results
      .filter((r) => r.score >= 0.5 && r.metadata?.text)
      .map((r) => r.metadata!.text as string)
      .slice(0, 3);
  } catch {
    return [];
  }
}

function findRank(results: string[], expected: string): number {
  const expectedLower = expected.toLowerCase();
  return results.findIndex((r) => r.toLowerCase() === expectedLower);
}

async function evaluate() {
  console.log('=== Autocomplete Two-Tier Evaluation ===\n');
  console.log(`${EVAL_CASES.length} test cases\n`);

  let localRecall = 0;
  let localMRR = 0;
  let vectorRecall = 0;
  let vectorMRR = 0;
  let combinedRecall = 0;
  let combinedMRR = 0;
  let totalVectorMs = 0;

  for (const tc of EVAL_CASES) {
    const t0 = performance.now();
    const local = localPrefixMatch(tc.prefix);
    const localMs = performance.now() - t0;

    const tv0 = performance.now();
    const vector = await vectorMatch(tc.prefix);
    const vecMs = performance.now() - tv0;
    totalVectorMs += vecMs;

    const combined = [...local];
    const seenLower = new Set(local.map((t) => t.toLowerCase()));
    for (const v of vector) {
      if (combined.length >= 3) break;
      if (!seenLower.has(v.toLowerCase())) {
        combined.push(v);
        seenLower.add(v.toLowerCase());
      }
    }
    const combinedTop3 = combined.slice(0, 3);

    const lr = findRank(local, tc.expectedPhrase);
    const vr = findRank(vector, tc.expectedPhrase);
    const cr = findRank(combinedTop3, tc.expectedPhrase);

    if (lr >= 0) { localRecall++; localMRR += 1 / (lr + 1); }
    if (vr >= 0) { vectorRecall++; vectorMRR += 1 / (vr + 1); }
    if (cr >= 0) { combinedRecall++; combinedMRR += 1 / (cr + 1); }

    const status = cr >= 0 ? `HIT@${cr + 1}` : lr >= 0 ? `LOCAL@${lr + 1}` : vr >= 0 ? `VEC@${vr + 1}` : 'MISS';
    console.log(`  [${status}] "${tc.prefix}"`);
    console.log(`    local(${localMs.toFixed(0)}ms): ${local.length ? local.map((t, i) => `[${i + 1}] "${t.slice(0, 50)}"`).join(', ') : '(empty)'}`);
    console.log(`    vector(${vecMs.toFixed(0)}ms): ${vector.length ? vector.map((t, i) => `[${i + 1}] "${t.slice(0, 50)}"`).join(', ') : '(empty)'}`);
    console.log();
  }

  const n = EVAL_CASES.length;
  console.log('=== Summary ===');
  console.log(`  Local  Recall@3:  ${(localRecall / n * 100).toFixed(1)}%  MRR@3: ${(localMRR / n).toFixed(3)}`);
  console.log(`  Vector Recall@3:  ${(vectorRecall / n * 100).toFixed(1)}%  MRR@3: ${(vectorMRR / n).toFixed(3)}  avg: ${(totalVectorMs / n).toFixed(0)}ms`);
  console.log(`  Combined Recall@3: ${(combinedRecall / n * 100).toFixed(1)}%  MRR@3: ${(combinedMRR / n).toFixed(3)}`);
  console.log();
}

evaluate().catch((e) => {
  console.error('Evaluation failed:', e);
  process.exit(1);
});
