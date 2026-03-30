import * as dotenv from 'dotenv';
import path from 'node:path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { addSuggestion } from '@/lib/redis/autocomplete';
import { AUTOCOMPLETE_CORPUS } from '@/lib/predictive/corpus';
import { embed } from 'ai';
import { openai } from '@ai-sdk/openai';
import { Index } from '@upstash/vector';

const embeddingModel = openai.embedding('text-embedding-3-small');
const AUTOCOMPLETE_NAMESPACE = 'autocomplete';

async function seedRedis() {
  let added = 0;
  for (const { text, score } of AUTOCOMPLETE_CORPUS) {
    await addSuggestion(text, score, false);
    added++;
  }
  console.log(`Seeded ${added} phrases into Redis`);
}

async function seedVector() {
  const url = process.env.UPSTASH_VECTOR_REST_URL;
  const token = process.env.UPSTASH_VECTOR_REST_TOKEN;
  if (!url || !token) {
    console.log('Skipping vector seed (no UPSTASH_VECTOR credentials)');
    return;
  }

  const client = new Index({ url, token });
  const ns = client.namespace(AUTOCOMPLETE_NAMESPACE);

  const BATCH_SIZE = 10;
  let seeded = 0;

  for (let i = 0; i < AUTOCOMPLETE_CORPUS.length; i += BATCH_SIZE) {
    const batch = AUTOCOMPLETE_CORPUS.slice(i, i + BATCH_SIZE);
    const texts = batch.map((p) => p.text);

    const results = await Promise.all(
      texts.map((t) => embed({ model: embeddingModel, value: t })),
    );

    const vectors = batch.map((phrase, idx) => ({
      id: `ac-${i + idx}`,
      vector: results[idx].embedding,
      metadata: {
        text: phrase.text,
        popularity: phrase.score,
      },
    }));

    await ns.upsert(vectors);
    seeded += vectors.length;
    console.log(`  Vector batch: ${seeded}/${AUTOCOMPLETE_CORPUS.length}`);
  }

  console.log(`Seeded ${seeded} vectors into Upstash (${AUTOCOMPLETE_NAMESPACE})`);
}

async function main() {
  await seedRedis();
  await seedVector();
  console.log('Seeding complete');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
