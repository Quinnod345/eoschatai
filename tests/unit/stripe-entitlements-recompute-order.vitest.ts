import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const callOrder: string[] = [];

  const invalidateUserEntitlementsCache = vi.fn(async (userId: string) => {
    callOrder.push(`invalidate:${userId}`);
  });
  const getUserEntitlements = vi.fn(async (userId: string) => {
    callOrder.push(`get:${userId}`);
  });
  const broadcastEntitlementsUpdated = vi.fn(async (userId: string) => {
    callOrder.push(`broadcast:${userId}`);
  });

  const dbSelectLimit = vi.fn();
  const dbInsertOnConflictDoNothing = vi.fn();

  return {
    callOrder,
    invalidateUserEntitlementsCache,
    getUserEntitlements,
    broadcastEntitlementsUpdated,
    listOrgUserIds: vi.fn(),
    resetOrgPlanToFree: vi.fn(),
    dbSelectLimit,
    dbInsertOnConflictDoNothing,
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

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Headers()),
}));

vi.mock('@/app/(auth)/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/db/users', () => ({
  getUserWithOrg: vi.fn(),
  listOrgUserIds: mocks.listOrgUserIds,
  findUserByStripeCustomerId: vi.fn(),
  updateUserPlan: vi.fn(),
  updateOrgSubscription: vi.fn(),
  resetOrgPlanToFree: mocks.resetOrgPlanToFree,
  resetUserPlanToFree: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: mocks.dbSelectLimit,
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoNothing: mocks.dbInsertOnConflictDoNothing,
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(async () => undefined),
      })),
    })),
  },
}));

vi.mock('@/lib/db/schema', () => ({
  webhookEvent: {
    id: 'webhookEvent.id',
    eventId: 'webhookEvent.eventId',
  },
  user: {
    id: 'user.id',
    email: 'user.email',
  },
  org: {
    id: 'org.id',
    stripeSubscriptionId: 'org.stripeSubscriptionId',
    ownerId: 'org.ownerId',
  },
}));

vi.mock('@/lib/entitlements', () => ({
  invalidateUserEntitlementsCache: mocks.invalidateUserEntitlementsCache,
  getUserEntitlements: mocks.getUserEntitlements,
  broadcastEntitlementsUpdated: mocks.broadcastEntitlementsUpdated,
}));

vi.mock('@/lib/server-constants', () => ({
  STRIPE_CONFIG: {
    webhookSecret: 'whsec_test',
    priceIds: {
      proMonthly: 'price_pro_monthly',
      proAnnual: 'price_pro_annual',
      businessSeatMonthly: 'price_business_monthly',
      businessSeatAnnual: 'price_business_annual',
    },
  },
}));

vi.mock('@/lib/utils/app-url', () => ({
  buildAppUrl: vi.fn(() => 'http://localhost'),
}));

vi.mock('@/lib/stripe/pricing', () => ({
  resolvePriceId: vi.fn(),
}));

vi.mock('@/lib/stripe/client', () => ({
  getStripeClient: vi.fn(() => null),
}));

vi.mock('@/lib/analytics', () => ({
  trackSubscriptionActivated: vi.fn(),
}));

vi.mock('@/lib/organizations/seat-enforcement', () => ({
  updateOrgSeatCount: vi.fn(),
}));

vi.mock('@/lib/redis/client', () => ({
  getRedisClient: vi.fn(() => null),
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => ({ op: 'eq', args })),
}));

import { handleStripeWebhook } from '@/lib/billing/stripe';

describe('stripe entitlement recompute ordering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.callOrder.length = 0;
    mocks.dbSelectLimit.mockResolvedValue([]);
    mocks.dbInsertOnConflictDoNothing.mockResolvedValue(undefined);
    mocks.listOrgUserIds.mockResolvedValue(['member-1', 'member-2']);
    mocks.resetOrgPlanToFree.mockResolvedValue(undefined);
  });

  it('invalidates cache before recompute for each org member', async () => {
    const response = await handleStripeWebhook({
      id: 'evt_test_1',
      type: 'customer.subscription.deleted',
      data: {
        object: {
          id: 'sub_test_1',
          metadata: {
            plan: 'business',
            org_id: 'org-1',
          },
          items: {
            data: [{ quantity: 2, price: { id: 'price_business_monthly' } }],
          },
          customer: 'cus_test_1',
          status: 'canceled',
        },
      },
    } as any);

    expect(response.status).toBe(200);
    expect(mocks.resetOrgPlanToFree).toHaveBeenCalledWith('org-1');
    expect(mocks.listOrgUserIds).toHaveBeenCalledWith('org-1');
    expect(mocks.callOrder).toEqual([
      'invalidate:member-1',
      'get:member-1',
      'broadcast:member-1',
      'invalidate:member-2',
      'get:member-2',
      'broadcast:member-2',
    ]);
  });
});
