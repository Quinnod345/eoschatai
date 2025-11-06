import { NextResponse } from 'next/server';

import { auth } from '@/app/(auth)/auth';
import {
  resetUserDailyUsageCounters,
  resetDailyUsageCounters,
} from '@/lib/entitlements';

export async function POST(request: Request) {
  // Only allow in development or with specific debug flag
  const isDevelopment = process.env.NODE_ENV !== 'production';
  const allowDebug = process.env.ALLOW_DEBUG_ENDPOINTS === 'true';

  if (!isDevelopment && !allowDebug) {
    return NextResponse.json(
      { error: 'Debug endpoints not available in production' },
      { status: 403 },
    );
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { scope = 'self' } = body as { scope?: 'self' | 'all' };

    if (scope === 'all') {
      // Reset all users (admin only in production)
      if (!isDevelopment && !allowDebug) {
        return NextResponse.json(
          { error: 'Cannot reset all users in production' },
          { status: 403 },
        );
      }
      
      await resetDailyUsageCounters();
      console.log('[debug] Reset daily usage counters for all users');
      
      return NextResponse.json({
        ok: true,
        scope: 'all',
        message: 'Reset usage counters for all users',
      });
    } else {
      // Reset current user only
      await resetUserDailyUsageCounters(session.user.id);
      console.log(`[debug] Reset daily usage counters for user ${session.user.id}`);
      
      return NextResponse.json({
        ok: true,
        scope: 'self',
        userId: session.user.id,
        message: 'Reset your usage counters',
      });
    }
  } catch (error) {
    console.error('[debug] Failed to reset usage counters', error);
    return NextResponse.json(
      { error: 'Failed to reset usage counters' },
      { status: 500 },
    );
  }
}







