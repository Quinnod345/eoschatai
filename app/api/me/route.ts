import { NextResponse } from 'next/server';

import { auth } from '@/app/(auth)/auth';
import { getAccessContext } from '@/lib/entitlements';
import { FEATURE_FLAGS } from '@/lib/config/feature-flags';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const context = await getAccessContext(session.user.id);

    return NextResponse.json({
      user: {
        id: context.user.id,
        email: context.user.email,
        plan: context.user.plan,
        orgId: context.user.orgId,
      },
      org: context.org,
      entitlements: context.entitlements,
      usage_counters: context.user.usageCounters,
      feature_flags: FEATURE_FLAGS,
    });
  } catch (error) {
    console.error('[me] Failed to load bootstrap payload', error);
    return NextResponse.json(
      { error: 'Failed to load account details' },
      { status: 500 },
    );
  }
}
