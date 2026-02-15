import { NextResponse, type NextRequest } from 'next/server';

import { FEATURE_FLAGS } from '@/lib/config/feature-flags';
import { reconcileCircleTierMemberships } from '@/lib/integrations/circle-sync';

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
  if (!FEATURE_FLAGS.circle_sync) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const authState = getCronAuthState(request);
  if (!authState.authorized) {
    console.warn('[cron.circle-sync] Unauthorized request', {
      reason: authState.reason,
      hasAuthorizationHeader: Boolean(request.headers.get('authorization')),
    });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = Date.now();
  try {
    const report = await reconcileCircleTierMemberships();
    return NextResponse.json({
      status: 'ok',
      durationMs: Date.now() - startedAt,
      ...report,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown reconciliation error';
    console.error('[cron.circle-sync] Reconciliation failed', {
      error: errorMessage,
    });

    return NextResponse.json(
      {
        error: 'Circle reconciliation failed',
        message: errorMessage,
      },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
