import { NextResponse, type NextRequest } from 'next/server';

import { resetDailyUsageCounters } from '@/lib/entitlements';

const getCronAuthState = (request: NextRequest) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return { authorized: false, reason: 'missing_cron_secret' as const };
  }

  const authorizationHeader = request.headers.get('authorization');
  if (!authorizationHeader) {
    return {
      authorized: false,
      reason: 'missing_authorization_header' as const,
    };
  }

  if (authorizationHeader !== `Bearer ${secret}`) {
    return {
      authorized: false,
      reason: 'authorization_token_mismatch' as const,
    };
  }

  return { authorized: true as const };
};

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  console.log('[cron] Daily usage reset started at:', new Date().toISOString());

  const authState = getCronAuthState(request);
  if (!authState.authorized) {
    console.warn('[cron] Unauthorized request to daily usage reset', {
      reason: authState.reason,
      hasAuthorizationHeader: !!request.headers.get('authorization'),
    });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const resetCount = await resetDailyUsageCounters();
    const normalizedResetCount = Number.isFinite(resetCount) ? resetCount : 0;
    const duration = Date.now() - startTime;
    console.log(
      `[cron] Daily usage reset completed successfully in ${duration}ms`,
      {
        reset_count: normalizedResetCount,
      },
    );

    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      duration_ms: duration,
      reset_count: normalizedResetCount,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[cron] Failed to reset daily usage counters', {
      error,
      duration_ms: duration,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json(
      {
        error: 'Failed to reset usage counters',
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
