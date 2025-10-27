import { NextRequest, NextResponse } from 'next/server';

import { resetDailyUsageCounters } from '@/lib/entitlements';

const isAuthorized = (request: NextRequest) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return request.headers.get('authorization') === `Bearer ${secret}`;
};

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  console.log('[cron] Daily usage reset started at:', new Date().toISOString());
  
  if (!isAuthorized(request)) {
    console.warn('[cron] Unauthorized request to daily usage reset');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await resetDailyUsageCounters();
    const duration = Date.now() - startTime;
    console.log(`[cron] Daily usage reset completed successfully in ${duration}ms`);
    
    return NextResponse.json({ 
      status: 'ok',
      timestamp: new Date().toISOString(),
      duration_ms: duration,
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
