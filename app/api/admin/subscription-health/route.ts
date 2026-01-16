import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin';
import {
  scanSubscriptionHealth,
  autoFixSubscriptionIssues,
  getSubscriptionStats,
} from '@/lib/billing/subscription-health';

/**
 * GET /api/admin/subscription-health
 * Scan for subscription health issues
 *
 * Admin access required (configured via ADMIN_EMAILS env var)
 */
export async function GET(request: Request) {
  try {
    // Check admin permission using centralized helper
    const adminError = await requireAdmin();
    if (adminError) return adminError;

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
 *
 * Admin access required (configured via ADMIN_EMAILS env var)
 */
export async function POST(request: Request) {
  try {
    // Check admin permission using centralized helper
    const adminError = await requireAdmin();
    if (adminError) return adminError;

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
