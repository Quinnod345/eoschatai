import { NextResponse } from 'next/server';

import { getPriceSummaries } from '@/lib/billing/stripe';
import { FEATURE_FLAGS } from '@/lib/config/feature-flags';

export async function GET() {
  if (!FEATURE_FLAGS.stripe_mvp) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    // If Stripe is not configured, return mock prices for development
    if (!process.env.STRIPE_SECRET_KEY) {
      const mockPrices = [
        {
          id: 'price_mock_pro_monthly',
          plan: 'pro' as const,
          interval: 'monthly' as const,
          unitAmount: 4900, // $49.00
          currency: 'usd',
        },
        {
          id: 'price_mock_pro_annual',
          plan: 'pro' as const,
          interval: 'annual' as const,
          unitAmount: 49900, // $499.00
          currency: 'usd',
        },
        {
          id: 'price_mock_business_monthly',
          plan: 'business' as const,
          interval: 'monthly' as const,
          unitAmount: 9900, // $99.00 per seat
          currency: 'usd',
        },
        {
          id: 'price_mock_business_annual',
          plan: 'business' as const,
          interval: 'annual' as const,
          unitAmount: 99900, // $999.00 per seat
          currency: 'usd',
        },
      ];
      return NextResponse.json({ prices: mockPrices });
    }

    const prices = await getPriceSummaries();
    return NextResponse.json({ prices });
  } catch (error) {
    console.error('[billing.prices] Failed to load Stripe prices', error);
    return NextResponse.json(
      { error: 'Unable to load pricing' },
      { status: 500 },
    );
  }
}
