import { auth } from '@/app/(auth)/auth';
import { NextResponse } from 'next/server';
import { z } from 'zod/v3';
import { getSuggestions } from '@/lib/redis/autocomplete';
import { getUserSettings } from '@/lib/db/queries';

const requestSchema = z.object({
  prefix: z.string().min(1).max(512),
  context: z
    .object({
      chatId: z.string().optional(),
      personaId: z.string().optional(),
      personaName: z.string().optional(),
      composerDocumentId: z.string().optional(),
      composerKind: z.string().optional(),
      isNewChat: z.boolean().optional(),
      selectedModelId: z.string().optional(),
    })
    .optional(),
});

const INELIGIBLE_SUFFIX = /[.!?;:]$/;

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
    return NextResponse.json(
      { error: 'Invalid body', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const prefix = parsed.data.prefix.trim();

  if (
    prefix.length < 3 ||
    INELIGIBLE_SUFFIX.test(prefix) ||
    prefix.includes('\n')
  ) {
    return NextResponse.json({ predictions: [] });
  }

  try {
    const settings = await getUserSettings({ userId: session.user.id });
    if (settings?.autocompleteEnabled === false) {
      return NextResponse.json({ predictions: [] });
    }

    const redisResults = await getSuggestions(prefix, { max: 5, fuzzy: true });
    const prefixLower = prefix.toLowerCase();

    const predictions = (redisResults || [])
      .filter(
        (s) => typeof s === 'string' && s.toLowerCase().startsWith(prefixLower),
      )
      .map((s) => s.slice(prefix.length).replace(/^\s+/, ''))
      .filter((s) => s.length > 0 && s.length < 50)
      .slice(0, 3);

    const totalMs = Math.round(performance.now() - t0);

    return NextResponse.json({
      predictions,
      source: 'redis',
      timing: { totalMs },
    });
  } catch (error) {
    console.error('Predictions API error:', error);
    return NextResponse.json({ predictions: [] });
  }
}
