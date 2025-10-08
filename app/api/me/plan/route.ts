import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { getAccessContext } from '@/lib/entitlements';

/**
 * GET /api/me/plan - Get current user's plan and basic entitlements
 * Client-safe endpoint that doesn't trigger server-only imports
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const accessContext = await getAccessContext(session.user.id);

    return NextResponse.json({
      plan: accessContext.user.plan,
      orgId: accessContext.user.orgId,
      hasOrg: !!accessContext.org,
      canExport: accessContext.entitlements.features.export,
      canShare: accessContext.user.plan === 'business',
    });
  } catch (error) {
    console.error('Error fetching user plan:', error);
    return NextResponse.json(
      { error: 'Failed to fetch plan' },
      { status: 500 },
    );
  }
}


