// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all required modules before imports
vi.mock('server-only', () => ({}));

vi.mock('@/app/(auth)/auth', () => ({
  auth: vi.fn(async () => ({ user: { id: 'test_user' } })),
}));

// Mock next/server (needed by next-auth)
vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((data, init) => ({
      json: async () => data,
      status: init?.status || 200,
      headers: init?.headers || {},
    })),
    redirect: vi.fn(),
  },
}));

vi.mock('@/lib/config/feature-flags', () => ({
  FEATURE_FLAGS: { stripe_mvp: true },
}));

vi.mock('@/lib/server-constants', () => ({
  STRIPE_CONFIG: {
    webhookSecret: 'test_webhook_secret',
    priceIds: {
      proMonthly: 'price_pro_monthly',
      proAnnual: 'price_pro_annual',
      businessSeatMonthly: 'price_business_monthly',
      businessSeatAnnual: 'price_business_annual',
    },
  },
}));

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => ({
    get: vi.fn((key: string) => {
      if (key === 'stripe-signature') return 'test_signature';
      return null;
    }),
  })),
}));

vi.mock('@/lib/stripe/client', () => ({
  getStripeClient: vi.fn(() => ({
    webhooks: {
      constructEvent: vi.fn((payload, signature, secret) => {
        const parsed = JSON.parse(payload);
        return {
          id: parsed.id || 'evt_test',
          type: parsed.type,
          data: { object: parsed.data?.object || {} },
        };
      }),
    },
    subscriptions: {
      retrieve: vi.fn(async () => ({
        id: 'sub_test',
        status: 'active',
        items: { data: [{ price: { id: 'price_pro_monthly' }, quantity: 1 }] },
        metadata: { user_id: 'user_123', plan: 'pro' },
        customer: 'cus_test',
      })),
    },
  })),
}));

vi.mock('@/lib/db/users', () => ({
  getUserWithOrg: vi.fn(),
  listOrgUserIds: vi.fn(async () => []),
  findUserByStripeCustomerId: vi.fn(),
  updateUserPlan: vi.fn(),
  updateOrgSubscription: vi.fn(),
  resetOrgPlanToFree: vi.fn(),
  resetUserPlanToFree: vi.fn(),
}));

vi.mock('@/lib/entitlements', () => ({
  broadcastEntitlementsUpdated: vi.fn(),
  getUserEntitlements: vi.fn(async () => ({})),
  invalidateUserEntitlementsCache: vi.fn(),
  resetUserDailyUsageCounters: vi.fn(),
}));

vi.mock('@/lib/analytics', () => ({
  trackSubscriptionActivated: vi.fn(),
}));

vi.mock('@/lib/organizations/seat-enforcement', () => ({
  updateOrgSeatCount: vi.fn(),
}));

vi.mock('@/lib/billing/notifications', () => ({
  notifyPaymentRequiresAction: vi.fn(),
  notifyTrialEnding: vi.fn(),
}));

vi.mock('@/lib/billing/grace-period', () => ({
  startGracePeriod: vi.fn(),
  endGracePeriod: vi.fn(),
}));

vi.mock('@/lib/redis/client', () => ({
  getRedisClient: vi.fn(() => null),
}));

// Mock the db for webhook event tracking
const mockWebhookEventState = new Set<string>();

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => {
            return [];
          }),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoNothing: vi.fn(async () => {}),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(async () => {}),
      })),
    })),
  },
}));

// Now import the functions we want to test
import { constructStripeEvent, handleStripeWebhook } from '@/lib/billing/stripe';
import { updateUserPlan, resetUserPlanToFree } from '@/lib/db/users';
import { trackSubscriptionActivated } from '@/lib/analytics';

describe('Billing Webhook Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWebhookEventState.clear();
  });

  describe('constructStripeEvent', () => {
    it('should construct a valid Stripe event from request', async () => {
      const mockRequest = {
        text: vi.fn(async () => JSON.stringify({
          id: 'evt_test_123',
          type: 'checkout.session.completed',
          data: { object: { id: 'cs_test', customer: 'cus_test' } },
        })),
      } as unknown as Request;

      const event = await constructStripeEvent(mockRequest);

      expect(event).toBeDefined();
      expect(event?.id).toBe('evt_test_123');
      expect(event?.type).toBe('checkout.session.completed');
    });
  });

  describe('handleStripeWebhook', () => {
    it('should handle checkout.session.completed event', async () => {
      const event = {
        id: 'evt_checkout_complete',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test',
            customer: 'cus_test_123',
            metadata: { user_id: 'user_123', plan: 'pro' },
          },
        },
      } as any;

      const response = await handleStripeWebhook(event);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.received).toBe(true);

      expect(updateUserPlan).toHaveBeenCalledWith(
        'user_123',
        'pro',
        'cus_test_123',
        'stripe',
      );
    });

    it('should handle customer.subscription.deleted event (Pro)', async () => {
      const event = {
        id: 'evt_sub_deleted',
        type: 'customer.subscription.deleted',
        data: {
          object: {
            id: 'sub_test',
            status: 'canceled',
            customer: 'cus_test_456',
            items: { data: [{ price: { id: 'price_pro_monthly' }, quantity: 1 }] },
            metadata: { user_id: 'user_456', plan: 'pro' },
          },
        },
      } as any;

      const response = await handleStripeWebhook(event);

      expect(response.status).toBe(200);
      expect(resetUserPlanToFree).toHaveBeenCalledWith('user_456');
    });

    it('should handle customer.subscription.created event for Pro plan', async () => {
      const event = {
        id: 'evt_sub_created',
        type: 'customer.subscription.created',
        data: {
          object: {
            id: 'sub_new',
            status: 'active',
            customer: 'cus_new',
            items: { data: [{ price: { id: 'price_pro_monthly' }, quantity: 1 }] },
            metadata: { user_id: 'user_new', plan: 'pro' },
          },
        },
      } as any;

      const response = await handleStripeWebhook(event);

      expect(response.status).toBe(200);
      expect(updateUserPlan).toHaveBeenCalled();
      expect(trackSubscriptionActivated).toHaveBeenCalledWith(
        expect.objectContaining({ plan: 'pro', user_id: 'user_new' })
      );
    });

    it('should ignore incomplete subscription status', async () => {
      const event = {
        id: 'evt_incomplete',
        type: 'customer.subscription.created',
        data: {
          object: {
            id: 'sub_incomplete',
            status: 'incomplete',
            customer: 'cus_incomplete',
            items: { data: [{ price: { id: 'price_pro_monthly' }, quantity: 1 }] },
            metadata: { user_id: 'user_incomplete', plan: 'pro' },
          },
        },
      } as any;

      const response = await handleStripeWebhook(event);

      expect(response.status).toBe(200);
      // Should NOT call updateUserPlan for incomplete subscriptions
      expect(updateUserPlan).not.toHaveBeenCalled();
    });

    it('should handle checkout.session.expired event gracefully', async () => {
      const event = {
        id: 'evt_expired',
        type: 'checkout.session.expired',
        data: {
          object: { id: 'cs_expired' },
        },
      } as any;

      const response = await handleStripeWebhook(event);

      expect(response.status).toBe(200);
      // Should not throw, just log
    });
  });
});
