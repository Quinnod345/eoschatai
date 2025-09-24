import { NextResponse } from 'next/server';

import { constructStripeEvent, handleStripeWebhook } from '@/lib/billing/stripe';
import { FEATURE_FLAGS } from '@/lib/config/feature-flags';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!FEATURE_FLAGS.stripe_mvp) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const event = await constructStripeEvent(request);
    if (!event) {
      return NextResponse.json({ error: 'Invalid event' }, { status: 400 });
    }

    return await handleStripeWebhook(event);
  } catch (error) {
    console.error('[billing.webhook] Failed to process webhook', error);
    return NextResponse.json({ error: 'Webhook error' }, { status: 400 });
  }
}
