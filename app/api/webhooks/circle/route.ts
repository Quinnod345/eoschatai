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

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const toPayloadRecord = (
  payload: unknown,
  rawBody: string,
): Record<string, unknown> => {
  if (isRecord(payload)) {
    return payload;
  }
  return { rawBody };
};

/**
 * Unwrap Circle's webhook format.
 * Circle workflow webhooks wrap the event in {"body": {...actual event...}}.
 * This function returns the inner event object.
 */
const unwrapCirclePayload = (
  payload: unknown,
): Record<string, unknown> | null => {
  if (!isRecord(payload)) return null;

  if (isRecord(payload.body)) {
    return payload.body as Record<string, unknown>;
  }

  if (typeof payload.type === 'string' && isRecord(payload.data)) {
    return payload;
  }

  return payload;
};

/**
 * HEAD — Circle sends this first to verify the endpoint exists.
 * Must return 200.
 */
export async function HEAD() {
  return new Response(null, { status: 200 });
}

/**
 * GET — health check / verification.
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: '/api/webhooks/circle',
    accepts: 'POST',
  });
}

/**
 * POST — the actual webhook handler.
 */
export async function POST(request: NextRequest) {
  if (!FEATURE_FLAGS.circle_sync) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const rawBody = await request.text();

  if (!rawBody || rawBody.trim().length === 0) {
    return NextResponse.json({ received: true, test: true });
  }

  let outerPayload: unknown;
  try {
    outerPayload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON payload' },
      { status: 400 },
    );
  }

  if (outerPayload === null || outerPayload === undefined) {
    return NextResponse.json({ received: true, test: true });
  }

  if (isRecord(outerPayload) && outerPayload.body === null) {
    return NextResponse.json({ received: true, test: true });
  }

  const payload = unwrapCirclePayload(outerPayload);
  if (!payload) {
    return NextResponse.json({ received: true, test: true });
  }

  if (
    typeof payload.type === 'string' &&
    (payload.type === 'test' ||
      payload.type === 'webhooks.test' ||
      payload.type === 'ping')
  ) {
    return NextResponse.json({ received: true, test: true });
  }

  if (!payload.type || !isRecord(payload.data)) {
    console.warn(
      '[circle.webhook] Received payload without type/data, treating as test',
      { keys: Object.keys(payload) },
    );
    return NextResponse.json({ received: true, test: true });
  }

  const eventId = deriveCircleEventId({
    payload,
    rawBody,
    headers: request.headers,
  });

  if (await hasCircleWebhookBeenProcessed(eventId)) {
    return NextResponse.json({
      received: true,
      deduplicated: true,
      eventId,
    });
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

    try {
      await logCircleSyncError({
        eventId,
        payload: toPayloadRecord(payload, rawBody),
        errorMessage,
      });
    } catch (logError) {
      console.error(
        '[circle.webhook] Failed to log sync error',
        logError,
      );
    }

    result = {
      eventId,
      action: 'error',
      userId: null,
      tierPurchased: null,
      mappedPlan: null,
      errorMessage,
    };
  }

  try {
    await markCircleWebhookProcessed(eventId);
  } catch (markError) {
    console.error(
      '[circle.webhook] Failed to mark event processed',
      markError,
    );
  }

  return NextResponse.json({
    received: true,
    eventId,
    action: result.action,
    error: result.errorMessage,
  });
}
