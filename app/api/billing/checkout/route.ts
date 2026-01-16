import { NextResponse } from 'next/server';
import { z } from 'zod/v3';

import { createCheckoutSession } from '@/lib/billing/stripe';
import { FEATURE_FLAGS } from '@/lib/config/feature-flags';

const payloadSchema = z.object({
  plan: z.enum(['pro', 'business']),
  billing: z.enum(['monthly', 'annual']),
  seats: z.number().int().positive().optional(),
  orgId: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  if (!FEATURE_FLAGS.stripe_mvp) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = payloadSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid payload', details: parsed.error.format() },
      { status: 400 },
    );
  }

  try {
    const url = await createCheckoutSession(parsed.data);
    return NextResponse.json({ url });
  } catch (error) {
    console.error('[billing.checkout] Failed to create session', error);
    const message = error instanceof Error ? error.message : 'Checkout failed';
    const status = message === 'Unauthorized' ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
