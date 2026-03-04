import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const claimedEventIds = new Set<string>();

  const claimCircleWebhookEvent = vi.fn(async (eventId: string) => {
    if (claimedEventIds.has(eventId)) return false;
    claimedEventIds.add(eventId);
    return true;
  });

  const releaseCircleWebhookEventClaim = vi.fn(async (eventId: string) => {
    claimedEventIds.delete(eventId);
  });

  return {
    claimedEventIds,
    verifyWebhookSignature: vi.fn(() => true),
    deriveCircleEventId: vi.fn(() => 'circle:evt-retry-1'),
    claimCircleWebhookEvent,
    processCirclePaymentEvent: vi.fn(),
    logCircleSyncError: vi.fn(async () => undefined),
    releaseCircleWebhookEventClaim,
  };
});

vi.mock('next/server', () => ({
  NextResponse: {
    json: (data: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(data), {
        status: init?.status ?? 200,
        headers: {
          'Content-Type': 'application/json',
          ...(init?.headers || {}),
        },
      }),
  },
}));

vi.mock('@/lib/config/feature-flags', () => ({
  FEATURE_FLAGS: { circle_sync: true },
}));

vi.mock('@/lib/integrations/circle', () => ({
  verifyWebhookSignature: mocks.verifyWebhookSignature,
}));

vi.mock('@/lib/integrations/circle-sync', () => ({
  deriveCircleEventId: mocks.deriveCircleEventId,
  claimCircleWebhookEvent: mocks.claimCircleWebhookEvent,
  processCirclePaymentEvent: mocks.processCirclePaymentEvent,
  logCircleSyncError: mocks.logCircleSyncError,
  releaseCircleWebhookEventClaim: mocks.releaseCircleWebhookEventClaim,
}));

import { POST as circleWebhookPost } from '@/app/api/webhooks/circle/route';

const buildWebhookRequest = (eventId: string) =>
  new Request('http://localhost/api/webhooks/circle', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-circle-event-id': eventId,
    },
    body: JSON.stringify({
      type: 'member.paywall_purchase.created',
      data: { id: 12345 },
    }),
  });

describe('circle webhook retry behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.claimedEventIds.clear();
    delete process.env.CIRCLE_WEBHOOK_SECRET;
    mocks.deriveCircleEventId.mockReturnValue('circle:evt-retry-1');
  });

  it('releases claim on transient failure and succeeds on second delivery', async () => {
    let attempt = 0;
    mocks.processCirclePaymentEvent.mockImplementation(async () => {
      attempt += 1;
      if (attempt === 1) {
        throw new Error('Temporary Circle API timeout');
      }
      return {
        eventId: 'circle:evt-retry-1',
        action: 'updated_plan',
        userId: 'user-1',
        tierPurchased: 'Mastery',
        mappedPlan: 'business',
        errorMessage: null,
      };
    });

    const firstResponse = await circleWebhookPost(
      buildWebhookRequest('evt-retry-1') as any,
    );
    const firstBody = await firstResponse.json();

    expect(firstResponse.status).toBe(500);
    expect(firstBody.retryable).toBe(true);
    expect(firstBody.eventId).toBe('circle:evt-retry-1');
    expect(mocks.releaseCircleWebhookEventClaim).toHaveBeenCalledWith(
      'circle:evt-retry-1',
    );

    const secondResponse = await circleWebhookPost(
      buildWebhookRequest('evt-retry-1') as any,
    );
    const secondBody = await secondResponse.json();

    expect(secondResponse.status).toBe(200);
    expect(secondBody.received).toBe(true);
    expect(secondBody.action).toBe('updated_plan');
    expect(mocks.processCirclePaymentEvent).toHaveBeenCalledTimes(2);
  });

  it('keeps claim for non-retriable failures', async () => {
    mocks.processCirclePaymentEvent.mockRejectedValueOnce(
      new Error('Unsupported Circle tier: Legacy'),
    );

    const response = await circleWebhookPost(
      buildWebhookRequest('evt-non-retry') as any,
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.retryable).toBe(false);
    expect(mocks.releaseCircleWebhookEventClaim).not.toHaveBeenCalled();
  });
});
