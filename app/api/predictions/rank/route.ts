import { auth } from '@/app/(auth)/auth';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { addSuggestion } from '@/lib/redis/autocomplete';

const requestSchema = z.object({
  phrase: z.string().min(1).max(512),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid body', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    await addSuggestion(parsed.data.phrase, 1, true); // INCR score by 1
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Rank API error', error);
    return NextResponse.json({ ok: false });
  }
}
