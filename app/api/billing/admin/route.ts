import { NextResponse } from 'next/server';

import { auth } from '@/app/(auth)/auth';
import { updateUserPlan } from '@/lib/db/users';
import {
  broadcastEntitlementsUpdated,
  getUserEntitlements,
  invalidateUserEntitlementsCache,
} from '@/lib/entitlements';

export async function POST(request: Request) {
  // Guard: Only allow in non-production to prevent abuse
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Not available in production' },
      { status: 403 },
    );
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { action, plan } =
    (payload as { action?: string; plan?: 'free' | 'pro' | 'business' }) || {};
  if (action !== 'set_plan') {
    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
  }
  if (!plan || !['free', 'pro', 'business'].includes(plan)) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
  }

  try {
    await updateUserPlan(session.user.id, plan);
    // Recompute and broadcast entitlements changes
    await getUserEntitlements(session.user.id);
    await invalidateUserEntitlementsCache(session.user.id);
    await broadcastEntitlementsUpdated(session.user.id);
    return NextResponse.json({ ok: true, plan });
  } catch (error) {
    console.error('[billing.admin] Failed to set plan', error);
    return NextResponse.json(
      { error: 'Failed to update plan' },
      { status: 500 },
    );
  }
}

