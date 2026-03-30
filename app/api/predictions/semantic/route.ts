import { auth } from '@/app/(auth)/auth';
import { NextResponse } from 'next/server';
import { z } from 'zod/v3';
import { embed } from 'ai';
import { openai } from '@ai-sdk/openai';
import { Index } from '@upstash/vector';

const embeddingModel = openai.embedding('text-embedding-3-small');

let vectorClient: Index | null = null;

function getVectorClient(): Index | null {
  if (vectorClient) return vectorClient;
  const url = process.env.UPSTASH_VECTOR_REST_URL;
  const token = process.env.UPSTASH_VECTOR_REST_TOKEN;
  if (!url || !token) return null;
  vectorClient = new Index({ url, token });
  return vectorClient;
}

const AUTOCOMPLETE_NAMESPACE = 'autocomplete';

const requestSchema = z.object({
  prefix: z.string().min(2).max(256),
});

export async function POST(request: Request) {
  const t0 = performance.now();
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ predictions: [] });
  }

  const prefix = parsed.data.prefix.trim();
  if (prefix.length < 2) {
    return NextResponse.json({ predictions: [] });
  }

  try {
    const client = getVectorClient();
    if (!client) {
      return NextResponse.json({
        predictions: [],
        source: 'vector_unavailable',
      });
    }

    const { embedding } = await embed({
      model: embeddingModel,
      value: prefix,
    });

    const ns = client.namespace(AUTOCOMPLETE_NAMESPACE);
    const results = await ns.query({
      vector: embedding,
      topK: 8,
      includeMetadata: true,
      includeVectors: false,
    });

    const predictions = results
      .filter((r) => r.score >= 0.5 && r.metadata?.text)
      .map((r) => ({
        text: r.metadata!.text as string,
        score: r.score,
        popularity: (r.metadata?.popularity as number) ?? 0,
      }))
      .slice(0, 5);

    const totalMs = Math.round(performance.now() - t0);

    return NextResponse.json({
      predictions,
      source: 'vector',
      timing: { totalMs },
    });
  } catch (error) {
    console.error('Semantic predictions error:', error);
    return NextResponse.json({ predictions: [] });
  }
}
