import { NextRequest, NextResponse } from 'next/server';

import { resetMonthlyUsageCounters } from '@/lib/entitlements';

const isAuthorized = (request: NextRequest) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return request.headers.get('authorization') === `Bearer ${secret}`;
};

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await resetMonthlyUsageCounters();
    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('[cron] Failed to reset monthly usage counters', error);
    return NextResponse.json(
      { error: 'Failed to reset usage counters' },
      { status: 500 },
    );
  }
}
