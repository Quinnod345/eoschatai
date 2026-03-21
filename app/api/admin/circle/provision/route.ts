import { NextResponse, type NextRequest } from 'next/server';
import { getMemberByEmail } from '@/lib/integrations/circle';
import { processCirclePaymentEvent } from '@/lib/integrations/circle-sync';
import { generateUUID } from '@/lib/utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/circle/provision
 *
 * Manually provisions an EOS AI account for a Circle member by email.
 * Useful for backfilling existing subscribers and for testing the webhook flow.
 *
 * Auth: Bearer <CIRCLE_WEBHOOK_TOKEN>
 * Body: { "email": "user@example.com" }
 */
export async function POST(request: NextRequest) {
  // Require the same token used to secure the Circle webhook URL
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
  try {
    const body = await request.json();
    email = typeof body?.email === 'string' ? body.email.trim() : undefined;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!email || !email.includes('@')) {
    return NextResponse.json(
      { error: 'A valid email address is required' },
      { status: 400 },
    );
  }

  // Look up the member in Circle to get their name, ID, and tier
  let member: Awaited<ReturnType<typeof getMemberByEmail>>;
  try {
    member = await getMemberByEmail(email);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Circle lookup failed';
    return NextResponse.json({ error: message }, { status: 502 });
  }

  if (!member) {
    return NextResponse.json(
      { error: `No Circle member found with email: ${email}` },
      { status: 404 },
    );
  }

  if (!member.mappedPlan) {
    return NextResponse.json(
      {
        error: `Circle member found but their tier ("${member.tierName}") does not map to an EOS AI plan. Check CIRCLE_TIER_BUSINESS / CIRCLE_TIER_PRO env vars.`,
        tierName: member.tierName,
      },
      { status: 422 },
    );
  }

  // Build a synthetic payload using the flat format that parseCircleWebhookPayload handles.
  // This lets us reuse the exact same user-creation and email logic as the webhook.
  const syntheticPayload = {
    type: 'admin_provision',
    email: member.email ?? email,
    tier_name: member.tierName,
    member_id: member.id ?? null,
    data: {},
  };

  const eventId = `admin-provision-${generateUUID()}`;

  try {
    const result = await processCirclePaymentEvent({
      eventId,
      payload: syntheticPayload,
      source: 'manual',
    });

    return NextResponse.json({
      success: true,
      action: result.action,
      userId: result.userId,
      plan: result.mappedPlan,
      tierName: result.tierPurchased,
      email,
      error: result.errorMessage,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Provisioning failed';
    console.error('[admin.circle.provision] Error', { email, error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
