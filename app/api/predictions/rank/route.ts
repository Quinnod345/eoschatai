import { auth } from '@/app/(auth)/auth';
import { NextResponse } from 'next/server';
import { z } from 'zod/v3';
import { addSuggestion } from '@/lib/redis/autocomplete';

const requestSchema = z.object({
  phrase: z.string().min(1).max(512),
  prefix: z.string().max(512).optional(),
  continuation: z.string().max(256).optional(),
  source: z.string().max(32).optional(),
  position: z.number().int().min(0).max(10).optional(),
});

export async function POST(request: Request) {
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

  try {
    const { phrase, position } = parsed.data;
    const boost = position === 0 ? 3 : position === 1 ? 2 : 1;
    await addSuggestion(phrase, boost, true);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Rank API error', error);
    return NextResponse.json({ ok: false });
  }
}
