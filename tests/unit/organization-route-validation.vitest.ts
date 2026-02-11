import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  dbSelect: vi.fn(),
  dbUpdate: vi.fn(),
  dbTransaction: vi.fn(),
  checkOrgPermission: vi.fn(),
  getOrgSeatUsage: vi.fn(),
  updateOrgSeatCount: vi.fn(),
}));

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

vi.mock('@/app/(auth)/auth', () => ({
  auth: mocks.auth,
}));

vi.mock('@/lib/db', () => ({
  db: {
    select: mocks.dbSelect,
    update: mocks.dbUpdate,
    transaction: mocks.dbTransaction,
  },
}));

vi.mock('@/lib/db/schema', () => ({
  org: { id: 'org.id', stripeSubscriptionId: 'org.stripeSubscriptionId' },
  user: { id: 'user.id', orgId: 'user.orgId' },
  orgMemberRole: { userId: 'orgMemberRole.userId', orgId: 'orgMemberRole.orgId' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => ({ op: 'eq', args })),
  and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
}));

vi.mock('@/lib/organizations/permissions', () => ({
  checkOrgPermission: mocks.checkOrgPermission,
}));

vi.mock('@/lib/organizations/seat-enforcement', () => ({
  getOrgSeatUsage: mocks.getOrgSeatUsage,
  updateOrgSeatCount: mocks.updateOrgSeatCount,
}));

vi.mock('@/lib/stripe/client', () => ({
  getStripeClient: vi.fn(() => null),
}));

vi.mock('@/lib/server-constants', () => ({
  STRIPE_CONFIG: {
    priceIds: {
      businessSeatMonthly: 'price_business_monthly',
      businessSeatAnnual: 'price_business_annual',
    },
  },
}));

import { PATCH as updateOrgSeats } from '@/app/api/organizations/[orgId]/seats/route';
import { POST as transferOwnership } from '@/app/api/organizations/[orgId]/transfer-ownership/route';
import { POST as switchOrganization } from '@/app/api/user/switch-organization/route';

describe('organization route validation hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: 'user-1' } });
  });

  it('returns 400 for invalid orgId in seats route', async () => {
    const response = await updateOrgSeats(
      new Request('http://localhost/api/organizations/not-a-uuid/seats', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seatCount: 4 }),
      }) as any,
      {
        params: Promise.resolve({ orgId: 'not-a-uuid' }),
      } as any,
    );

    expect(response.status).toBe(400);
    expect(mocks.checkOrgPermission).not.toHaveBeenCalled();
  });

  it('returns 400 for malformed JSON in switch-organization route', async () => {
    const response = await switchOrganization(
      new Request('http://localhost/api/user/switch-organization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{',
      }) as any,
    );

    expect(response.status).toBe(400);
    expect(mocks.dbSelect).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid newOwnerId in transfer-ownership route', async () => {
    const response = await transferOwnership(
      new Request(
        'http://localhost/api/organizations/11111111-1111-4111-8111-111111111111/transfer-ownership',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newOwnerId: 'not-a-uuid' }),
        },
      ) as any,
      {
        params: Promise.resolve({
          orgId: '11111111-1111-4111-8111-111111111111',
        }),
      } as any,
    );

    expect(response.status).toBe(400);
    expect(mocks.dbSelect).not.toHaveBeenCalled();
  });
});
