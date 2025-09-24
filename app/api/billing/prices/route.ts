import { NextResponse } from 'next/server';

import { getPriceSummaries } from '@/lib/billing/stripe';
import { FEATURE_FLAGS } from '@/lib/config/feature-flags';

export async function GET() {
  if (!FEATURE_FLAGS.stripe_mvp) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const prices = await getPriceSummaries();
    return NextResponse.json({ prices });
  } catch (error) {
    console.error('[billing.prices] Failed to load Stripe prices', error);
    return NextResponse.json({ error: 'Unable to load pricing' }, { status: 500 });
  }
}
