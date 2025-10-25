import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import {
  scanSubscriptionHealth,
  autoFixSubscriptionIssues,
  getSubscriptionStats,
} from '@/lib/billing/subscription-health';

/**
 * GET /api/admin/subscription-health
 * Scan for subscription health issues
 */
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // TODO: Add admin permission check
    // For now, only allow specific admin emails or roles
    const ADMIN_EMAILS = process.env.ADMIN_EMAILS?.split(',') || [];
    if (!ADMIN_EMAILS.includes(session.user.email || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'stats') {
      const stats = await getSubscriptionStats();
      return NextResponse.json(stats);
    }

    const report = await scanSubscriptionHealth();
    return NextResponse.json(report);
  } catch (error) {
    console.error('[subscription-health] Error:', error);
    return NextResponse.json(
      { error: 'Failed to scan subscription health' },
      { status: 500 },
    );
  }
}

/**
 * POST /api/admin/subscription-health
 * Auto-fix subscription issues
 */
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // TODO: Add admin permission check
    const ADMIN_EMAILS = process.env.ADMIN_EMAILS?.split(',') || [];
    if (!ADMIN_EMAILS.includes(session.user.email || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { dryRun = true } = body;

    const result = await autoFixSubscriptionIssues(dryRun);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[subscription-health] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fix subscription issues' },
      { status: 500 },
    );
  }
}
