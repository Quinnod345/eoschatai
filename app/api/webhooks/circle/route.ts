import { NextResponse, type NextRequest } from 'next/server';

import { FEATURE_FLAGS } from '@/lib/config/feature-flags';
import { verifyWebhookSignature } from '@/lib/integrations/circle';
import {
  claimCircleWebhookEvent,
  deriveCircleEventId,
  logCircleSyncError,
  processCirclePaymentEvent,
  releaseCircleWebhookEventClaim,
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

const isNonRetriableProcessingError = (message: string): boolean => {
  const normalized = message.toLowerCase();
  return (
    normalized.includes('unsupported circle tier') ||
    normalized.includes('missing tier/paywall name') ||
    normalized.includes('unable to match or create user without email') ||
    normalized.includes('has no email in api response') ||
    normalized.includes('could not resolve paywall name') ||
    normalized.includes('invalid json')
  );
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

  // Verify signature if CIRCLE_WEBHOOK_SECRET is configured.
  // In production-like environments, reject unsigned requests entirely.
  const signatureSecret = process.env.CIRCLE_WEBHOOK_SECRET;
  if (signatureSecret) {
    const signature =
      request.headers.get('x-circle-signature') ||
      request.headers.get('circle-signature') ||
      request.headers.get('x-signature');
    const valid = verifyWebhookSignature(rawBody, signature, signatureSecret);
    if (!valid) {
      console.warn('[circle.webhook] Rejected request with invalid signature', {
        hasSignature: Boolean(signature),
      });
      return NextResponse.json(
        { error: 'Invalid webhook signature' },
        { status: 401 },
      );
    }
  } else if (process.env.NODE_ENV === 'production') {
    console.error(
      '[circle.webhook] CIRCLE_WEBHOOK_SECRET is not configured in production',
    );
    return NextResponse.json(
      { error: 'Circle webhook is not configured securely' },
      { status: 500 },
    );
  }

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

  // Atomically claim event - if another process already claimed it, skip.
  const claimed = await claimCircleWebhookEvent(eventId);
  if (!claimed) {
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

    if (!isNonRetriableProcessingError(errorMessage)) {
      try {
        await releaseCircleWebhookEventClaim(eventId);
      } catch (releaseError) {
        console.error(
          '[circle.webhook] Failed to release event claim after transient failure',
          { eventId, releaseError },
        );
      }
      return NextResponse.json(
        {
          received: false,
          eventId,
          action: 'error',
          retryable: true,
          error: errorMessage,
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        received: true,
        eventId,
        action: 'error',
        retryable: false,
        error: errorMessage,
      },
      { status: 400 },
    );
  }

  return NextResponse.json({
    received: true,
    eventId,
    action: result.action,
    error: result.errorMessage,
  });
}
