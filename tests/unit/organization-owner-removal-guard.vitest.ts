import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const state = { memberCount: 1 };
  const dbSelect = vi.fn((selection?: Record<string, unknown>) => ({
    from: vi.fn(() => ({
      where: vi.fn(async () => {
        if (selection && typeof selection === 'object') {
          if ('orgId' in selection) {
            return [{ orgId: 'org-1' }];
          }
          if ('role' in selection) {
            return [{ role: 'owner' }];
          }
          if ('id' in selection) {
            return Array.from({ length: state.memberCount }, (_, idx) => ({
              id: `user-${idx + 1}`,
            }));
          }
          if ('ownerId' in selection) {
            return [{ ownerId: 'user-1' }];
          }
        }

        return [];
      }),
    })),
  }));

  return {
    state,
    dbSelect,
    dbInsert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoNothing: vi.fn(async () => undefined),
      })),
    })),
  };
});

vi.mock('@/lib/db', () => ({
  db: {
    select: mocks.dbSelect,
    insert: mocks.dbInsert,
  },
}));

vi.mock('@/lib/db/schema', () => ({
  user: { id: 'user.id', orgId: 'user.orgId' },
  org: { id: 'org.id', ownerId: 'org.ownerId' },
  orgMemberRole: {
    id: 'orgMemberRole.id',
    role: 'orgMemberRole.role',
    userId: 'orgMemberRole.userId',
    orgId: 'orgMemberRole.orgId',
    updatedAt: 'orgMemberRole.updatedAt',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => ({ op: 'eq', args })),
  and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
}));

import { canManageUser } from '@/lib/organizations/permissions';

describe('organization owner self-removal guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.state.memberCount = 1;
  });

  it('prevents removing the sole owner from an organization', async () => {
    mocks.state.memberCount = 1;

    const canRemove = await canManageUser('user-1', 'user-1', 'org-1', 'remove');

    expect(canRemove).toBe(false);
  });

  it('allows owner self-removal only when other members exist', async () => {
    mocks.state.memberCount = 2;

    const canRemove = await canManageUser('user-1', 'user-1', 'org-1', 'remove');

    expect(canRemove).toBe(true);
  });
});
