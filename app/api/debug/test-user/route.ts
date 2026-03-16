import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { updateUserPlan } from '@/lib/db/users';
import { planTypeEnum } from '@/lib/db/schema';
import { requireAdmin } from '@/lib/auth/admin';
import {
  defaultUsageCounters,
  getAccessContext,
  invalidateUserEntitlementsCache,
  setUsageCounters,
} from '@/lib/entitlements';

type RequestBody =
  | { action: 'get-access-context' }
  | { action: 'set-plan'; plan: (typeof planTypeEnum.enumValues)[number] }
  | {
      action: 'set-usage';
      usageCounters: Record<string, number>;
    }
  | { action: 'reset-usage' };

function debugEndpointsEnabled() {
  const isDevelopment = process.env.NODE_ENV !== 'production';
  const allowDebug = process.env.ALLOW_DEBUG_ENDPOINTS === 'true';
  return isDevelopment || allowDebug;
}

export async function POST(request: Request) {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!debugEndpointsEnabled()) {
    return NextResponse.json(
      { error: 'Debug endpoints not available in production' },
      { status: 403 },
    );
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (isProduction) {
    const adminError = await requireAdmin(session);
    if (adminError) return adminError;
  }

  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const userId = session.user.id;

  try {
    if (body.action === 'get-access-context') {
      const accessContext = await getAccessContext(userId);
      return NextResponse.json({ ok: true, accessContext });
    }

    if (body.action === 'set-plan') {
      if (!planTypeEnum.enumValues.includes(body.plan)) {
        return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
      }

      await updateUserPlan(userId, body.plan);
      await invalidateUserEntitlementsCache(userId);
      const accessContext = await getAccessContext(userId);
      return NextResponse.json({ ok: true, accessContext });
    }

    if (body.action === 'set-usage') {
      const accessContext = await getAccessContext(userId);
      const mergedCounters = {
        ...defaultUsageCounters(),
        ...accessContext.user.usageCounters,
        ...body.usageCounters,
      };
      await setUsageCounters(userId, mergedCounters);
      const updatedAccessContext = await getAccessContext(userId);
      return NextResponse.json({ ok: true, accessContext: updatedAccessContext });
    }

    if (body.action === 'reset-usage') {
      await setUsageCounters(userId, defaultUsageCounters());
      const accessContext = await getAccessContext(userId);
      return NextResponse.json({ ok: true, accessContext });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('[debug/test-user] Failed action:', body, error);
    return NextResponse.json(
      { error: 'Failed to execute debug action' },
      { status: 500 },
    );
  }
}
