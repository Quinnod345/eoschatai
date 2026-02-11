import { NextResponse } from 'next/server';
import {
  sendGracePeriodReminders,
  cleanupExpiredGracePeriods,
} from '@/lib/billing/grace-period';

/**
 * Cron job to send grace period reminders and cleanup expired periods
 * Should be called daily
 *
 * Configure in vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/grace-period-reminders",
 *     "schedule": "0 9 * * *"
 *   }]
 * }
 */
export async function GET(request: Request) {
  try {
    // Verify this is a cron request (Vercel adds this header)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[cron] Starting grace period reminders and cleanup');

    // Send reminders
    const reminderResults = await sendGracePeriodReminders();
    console.log(
      `[cron] Grace period reminders: ${reminderResults.sent} sent, ${reminderResults.failed} failed`,
    );

    // Cleanup expired grace periods
    const cleanupResults = await cleanupExpiredGracePeriods();
    console.log(
      `[cron] Grace period cleanup: ${cleanupResults.cleaned} cleaned, ${cleanupResults.downgradedUsers} users downgraded, ${cleanupResults.downgradedOrgs} orgs downgraded`,
    );

    return NextResponse.json({
      success: true,
      reminders: reminderResults,
      cleanup: cleanupResults,
    });
  } catch (error) {
    console.error('[cron] Grace period cron failed:', error);
    return NextResponse.json(
      { error: 'Failed to process grace period cron' },
      { status: 500 },
    );
  }
}

// Allow POST as well for manual triggering
export async function POST(request: Request) {
  return GET(request);
}
