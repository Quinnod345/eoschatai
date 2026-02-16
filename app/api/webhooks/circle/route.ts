import { timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';

import { FEATURE_FLAGS } from '@/lib/config/feature-flags';
import {
  deriveCircleEventId,
  hasCircleWebhookBeenProcessed,
  logCircleSyncError,
  markCircleWebhookProcessed,
  processCirclePaymentEvent,
  type CircleSyncResult,
} from '@/lib/integrations/circle-sync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const hasValidWebhookSecret = (
  request: NextRequest,
  webhookSecret: string,
): boolean => {
  const providedSecret = request.headers.get('x-circle-webhook-secret');
  if (!providedSecret) {
    return false;
  }

  const expectedBuffer = Buffer.from(webhookSecret);
  const providedBuffer = Buffer.from(providedSecret);
  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  try {
    return timingSafeEqual(expectedBuffer, providedBuffer);
  } catch {
    return false;
  }
};

const toPayloadRecord = (
  payload: unknown,
  rawBody: string,
): Record<string, unknown> => {
  if (typeof payload === 'object' && payload !== null && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  return { rawBody };
};

export async function POST(request: NextRequest) {
  if (!FEATURE_FLAGS.circle_sync) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const webhookSecret = process.env.CIRCLE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('[circle.webhook] CIRCLE_WEBHOOK_SECRET is not configured');
    return NextResponse.json(
      { error: 'Webhook secret is not configured' },
      { status: 500 },
    );
  }

  if (!hasValidWebhookSecret(request, webhookSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rawBody = await request.text();
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const eventId = deriveCircleEventId({
    payload,
    rawBody,
    headers: request.headers,
  });

  if (await hasCircleWebhookBeenProcessed(eventId)) {
    return NextResponse.json({ received: true, deduplicated: true, eventId });
  }

  let result: CircleSyncResult | null = null;

  try {
    result = await processCirclePaymentEvent({
      eventId,
      payload,
      source: 'webhook',
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : 'Unknown error while processing Circle webhook';
    console.error('[circle.webhook] Processing failed', {
      eventId,
      error: errorMessage,
    });

    await logCircleSyncError({
      eventId,
      payload: toPayloadRecord(payload, rawBody),
      errorMessage,
    });

    result = {
      eventId,
      action: 'error',
      userId: null,
      tierPurchased: null,
      mappedPlan: null,
      errorMessage,
    };
  }

  await markCircleWebhookProcessed(eventId);

  return NextResponse.json({
    received: true,
    eventId,
    action: result.action,
    error: result.errorMessage,
  });
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: '/api/webhooks/circle',
    method: 'POST',
    message: 'Circle webhook endpoint is active. Send POST requests to process events.',
  });
}
