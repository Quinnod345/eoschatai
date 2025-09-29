import { NextResponse, type NextRequest } from 'next/server';

import { auth } from '@/app/(auth)/auth';
import { getAccessContext } from '@/lib/entitlements';
import { FEATURE_FLAGS } from '@/lib/config/feature-flags';

export async function GET(request: NextRequest) {
  // Check if this is a Meticulous session
  const isMeticulousSession =
    (process.env.NODE_ENV === 'development' ||
      process.env.VERCEL_ENV === 'preview') &&
    (request.nextUrl.searchParams.get('meticulous') === 'true' ||
      request.headers.get('x-meticulous-session') === 'true' ||
      request.cookies.get('meticulous-session')?.value === 'true');

  // Return mock data for Meticulous sessions
  if (isMeticulousSession) {
    return NextResponse.json({
      user: {
        id: 'meticulous-test-user',
        email: 'test@meticulous.ai',
        plan: 'premium',
        orgId: 'meticulous-test-org',
      },
      org: {
        id: 'meticulous-test-org',
        name: 'Meticulous Test Organization',
        plan: 'premium',
      },
      entitlements: {
        // All features enabled for testing
        export: { feature: 'export', entitled: true, type: 'boolean', used: 0 },
        calendar_connect: {
          feature: 'calendar_connect',
          entitled: true,
          type: 'boolean',
          used: 0,
        },
        recordings: {
          feature: 'recordings',
          entitled: true,
          type: 'boolean',
          used: 0,
        },
        deep_research: {
          feature: 'deep_research',
          entitled: true,
          type: 'boolean',
          used: 0,
        },
        premium: {
          feature: 'premium',
          entitled: true,
          type: 'boolean',
          used: 0,
        },
        personas: {
          feature: 'personas',
          entitled: true,
          type: 'boolean',
          used: 0,
        },
        document_uploads: {
          feature: 'document_uploads',
          entitled: true,
          type: 'boolean',
          used: 0,
        },
        nexus_mode: {
          feature: 'nexus_mode',
          entitled: true,
          type: 'boolean',
          used: 0,
        },
      },
      usage_counters: {},
      feature_flags: FEATURE_FLAGS,
    });
  }

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
