import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const selectQueue: unknown[] = [];
  const txSelectQueue: unknown[] = [];
  const txInsertCalls: Array<{ table: unknown; values: unknown }> = [];

  const dbSelect = vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(async () => (selectQueue.shift() as any) ?? []),
    })),
  }));

  const dbUpdate = vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn(async () => undefined),
    })),
  }));

  const dbTransaction = vi.fn(async (callback: (tx: any) => Promise<unknown>) => {
    const tx = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(async () => (txSelectQueue.shift() as any) ?? []),
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(async () => undefined),
        })),
      })),
      insert: vi.fn((table: unknown) => ({
        values: vi.fn((values: unknown) => {
          txInsertCalls.push({ table, values });
          return {
            onConflictDoNothing: vi.fn(async () => undefined),
          };
        }),
      })),
    };

    return callback(tx);
  });

  return {
    auth: vi.fn(),
    validateInviteCode: vi.fn(),
    invalidateUserEntitlementsCache: vi.fn(),
    getUserEntitlements: vi.fn(),
    broadcastEntitlementsUpdated: vi.fn(),
    selectQueue,
    txSelectQueue,
    txInsertCalls,
    dbSelect,
    dbUpdate,
    dbTransaction,
  };
});

const schemaRefs = vi.hoisted(() => ({
  org: {
    id: 'org.id',
    plan: 'org.plan',
    seatCount: 'org.seatCount',
  },
  user: {
    id: 'user.id',
    orgId: 'user.orgId',
    plan: 'user.plan',
    email: 'user.email',
  },
  orgInvitation: {
    orgId: 'orgInvitation.orgId',
    email: 'orgInvitation.email',
    inviteCode: 'orgInvitation.inviteCode',
    status: 'orgInvitation.status',
    acceptedAt: 'orgInvitation.acceptedAt',
  },
  orgMemberRole: {
    userId: 'orgMemberRole.userId',
    orgId: 'orgMemberRole.orgId',
    role: 'orgMemberRole.role',
  },
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
    redirect: (url: string | URL, init?: ResponseInit) =>
      new Response(null, {
        status: init?.status ?? 302,
        headers: {
          location: typeof url === 'string' ? url : url.toString(),
          ...(init?.headers || {}),
        },
      }),
  },
}));

vi.mock('@/lib/errors/api-wrapper', () => ({
  withErrorHandler: (handler: (...args: any[]) => Promise<Response>) => handler,
}));

vi.mock('@/app/(auth)/auth', () => ({
  auth: mocks.auth,
}));

vi.mock('@/lib/organizations/invite-codes', () => ({
  validateInviteCode: mocks.validateInviteCode,
}));

vi.mock('@/lib/db', () => ({
  db: {
    select: mocks.dbSelect,
    update: mocks.dbUpdate,
    transaction: mocks.dbTransaction,
  },
}));

vi.mock('@/lib/db/schema', () => schemaRefs);

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => ({ op: 'eq', args })),
  and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
  sql: vi.fn((strings: TemplateStringsArray) => strings.join('')),
}));

vi.mock('@/lib/entitlements', () => ({
  invalidateUserEntitlementsCache: mocks.invalidateUserEntitlementsCache,
  getUserEntitlements: mocks.getUserEntitlements,
  broadcastEntitlementsUpdated: mocks.broadcastEntitlementsUpdated,
}));

import { POST as acceptInvitePost } from '@/app/api/organizations/accept/route';

describe('organizations accept role insertion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.selectQueue.length = 0;
    mocks.txSelectQueue.length = 0;
    mocks.txInsertCalls.length = 0;

    mocks.auth.mockResolvedValue({ user: { id: 'user-1' } });
    mocks.validateInviteCode.mockResolvedValue({ orgId: 'org-1' });
  });

  it('creates OrgMemberRole record when accepting invite', async () => {
    mocks.selectQueue.push(
      [{ orgId: null }], // existing user check
      [{ id: 'org-1', plan: 'business', seatCount: 5 }], // organization lookup
    );
    mocks.txSelectQueue.push(
      [{ orgId: null }], // transaction re-check user org
      [{ id: 'org-1', plan: 'business', seatCount: 5, memberCount: 1 }], // seat check
    );

    const response = await acceptInvitePost(
      new Request('http://localhost/api/organizations/accept?code=ABCD') as any,
    );

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toContain('/chat?invite=accepted');

    expect(mocks.txInsertCalls).toContainEqual({
      table: schemaRefs.orgMemberRole,
      values: {
        userId: 'user-1',
        orgId: 'org-1',
        role: 'member',
      },
    });
  });
});
