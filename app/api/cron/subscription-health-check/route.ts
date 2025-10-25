import { NextResponse } from 'next/server';
import {
  scanSubscriptionHealth,
  autoFixSubscriptionIssues,
} from '@/lib/billing/subscription-health';

/**
 * Cron job to automatically scan and fix subscription health issues
 * Should be called weekly
 *
 * Configure in vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/subscription-health-check",
 *     "schedule": "0 2 * * 0"
 *   }]
 * }
 */
export async function GET(request: Request) {
  try {
    // Verify this is a cron request
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[cron] Starting subscription health check');

    // Scan for issues
    const report = await scanSubscriptionHealth();
    console.log(
      `[cron] Health check found ${report.summary.total} issues (${report.summary.critical} critical, ${report.summary.autoFixable} auto-fixable)`,
    );

    // Auto-fix issues (not dry run)
    const AUTO_FIX_ENABLED = process.env.AUTO_FIX_SUBSCRIPTIONS === 'true';

    let fixResults: Awaited<ReturnType<typeof autoFixSubscriptionIssues>>;
    if (AUTO_FIX_ENABLED) {
      console.log('[cron] Auto-fix enabled, fixing issues...');
      fixResults = await autoFixSubscriptionIssues(false);
      console.log(
        `[cron] Auto-fix complete: ${fixResults.fixed} fixed, ${fixResults.failed} failed, ${fixResults.skipped} skipped`,
      );
    } else {
      console.log('[cron] Auto-fix disabled, dry run only');
      fixResults = await autoFixSubscriptionIssues(true);
    }

    // Log critical issues for manual review
    const criticalIssues = report.issues.filter(
      (i) => i.severity === 'critical',
    );
    if (criticalIssues.length > 0) {
      console.warn(
        `[cron] CRITICAL: ${criticalIssues.length} critical subscription issues found:`,
      );
      criticalIssues.forEach((issue) => {
        console.warn(`  - ${issue.type}: ${issue.description}`);
      });
    }

    return NextResponse.json({
      success: true,
      report: {
        total: report.summary.total,
        critical: report.summary.critical,
        high: report.summary.high,
        autoFixable: report.summary.autoFixable,
      },
      fixes: {
        enabled: AUTO_FIX_ENABLED,
        fixed: fixResults.fixed,
        failed: fixResults.failed,
        skipped: fixResults.skipped,
      },
      stats: report.stats,
    });
  } catch (error) {
    console.error('[cron] Subscription health check failed:', error);
    return NextResponse.json(
      { error: 'Failed to run subscription health check' },
      { status: 500 },
    );
  }
}

// Allow POST as well for manual triggering
export async function POST(request: Request) {
  return GET(request);
}
