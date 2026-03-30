import { NextResponse, type NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { user } from '@/lib/db/schema';
import { sendCircleUpgradeEmail } from '@/lib/integrations/circle-sync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/circle/send-upgrade
 *
 * Sends (or resends) the Circle upgrade notification email to an existing user.
 * Useful for testing or re-notifying users whose upgrade email was missed.
 *
 * Auth: Bearer <CIRCLE_WEBHOOK_TOKEN>
 * Body: { "email": "user@example.com", "tierName": "Mastery" }
 *       tierName is optional — defaults to the user's current plan tier name.
 */
export async function POST(request: NextRequest) {
  const webhookToken = process.env.CIRCLE_WEBHOOK_TOKEN;
  if (!webhookToken) {
    return NextResponse.json(
      { error: 'CIRCLE_WEBHOOK_TOKEN is not configured' },
      { status: 500 },
    );
  }

  const authHeader = request.headers.get('authorization');
  const provided = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  if (provided !== webhookToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let email: string | undefined;
  let tierNameOverride: string | undefined;
  try {
    const body = await request.json();
    email = typeof body?.email === 'string' ? body.email.trim() : undefined;
    tierNameOverride =
      typeof body?.tierName === 'string' ? body.tierName.trim() : undefined;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!email || !email.includes('@')) {
    return NextResponse.json(
      { error: 'A valid email address is required' },
      { status: 400 },
    );
  }

  const [existingUser] = await db
    .select({
      id: user.id,
      email: user.email,
      plan: user.plan,
    })
    .from(user)
    .where(eq(user.email, email.toLowerCase()))
    .limit(1);

  if (!existingUser) {
    return NextResponse.json(
      {
        error: `No EOS AI account found for ${email}.`,
      },
      { status: 404 },
    );
  }

  const tierName =
    tierNameOverride ||
    (existingUser.plan === 'business'
      ? 'Mastery'
      : existingUser.plan === 'pro'
        ? 'Strengthen'
        : 'Discover');

  const result = await sendCircleUpgradeEmail({
    toEmail: existingUser.email,
    memberName: null,
    tierName,
  });

  if (!result.success) {
    return NextResponse.json(
      { error: `Email failed to send: ${result.errorMessage}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    email: existingUser.email,
    plan: existingUser.plan,
    tierName,
    message: 'Upgrade notification email sent successfully.',
  });
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: '/api/admin/circle/send-upgrade',
    accepts: 'POST',
    body: '{ "email": "user@example.com", "tierName": "Mastery" }',
  });
}
