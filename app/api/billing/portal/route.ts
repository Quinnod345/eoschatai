import { NextResponse } from 'next/server';

import { createCustomerPortalSession } from '@/lib/billing/stripe';
import { FEATURE_FLAGS } from '@/lib/config/feature-flags';

export async function GET() {
  if (!FEATURE_FLAGS.stripe_mvp) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const url = await createCustomerPortalSession();
    return NextResponse.json({ url });
  } catch (error) {
    console.error('[billing.portal] Failed to create portal session', error);
    const message = error instanceof Error ? error.message : 'Portal session failed';
    const status = message === 'Unauthorized' ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
