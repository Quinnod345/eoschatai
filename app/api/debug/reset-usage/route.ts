import { NextResponse } from 'next/server';

import { auth } from '@/app/(auth)/auth';
import { requireAdmin } from '@/lib/auth/admin';
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
    let body: unknown = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const scopeInput = (body as { scope?: unknown })?.scope;
    const scope = scopeInput ?? 'self';
    if (scope !== 'self' && scope !== 'all') {
      return NextResponse.json(
        { error: 'scope must be either "self" or "all"' },
        { status: 400 },
      );
    }

    if (scope === 'all') {
      const adminError = await requireAdmin(session);
      if (adminError) return adminError;

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









