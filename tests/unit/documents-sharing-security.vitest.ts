import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  select: vi.fn(),
  delete: vi.fn(),
  update: vi.fn(),
  eq: vi.fn((...args: unknown[]) => ({ op: 'eq', args })),
  and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
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
    select: mocks.select,
    delete: mocks.delete,
    update: mocks.update,
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: mocks.eq,
  and: mocks.and,
}));

vi.mock('@/lib/db/schema', () => ({
  userDocuments: {
    id: 'userDocuments.id',
    userId: 'userDocuments.userId',
  },
  documentShareUser: {
    id: 'documentShareUser.id',
    documentId: 'documentShareUser.documentId',
    sharedWithId: 'documentShareUser.sharedWithId',
    permission: 'documentShareUser.permission',
    createdAt: 'documentShareUser.createdAt',
    expiresAt: 'documentShareUser.expiresAt',
  },
  documentShareOrg: {
    id: 'documentShareOrg.id',
    documentId: 'documentShareOrg.documentId',
    orgId: 'documentShareOrg.orgId',
    permission: 'documentShareOrg.permission',
    createdAt: 'documentShareOrg.createdAt',
  },
  user: {
    id: 'user.id',
    orgId: 'user.orgId',
    email: 'user.email',
  },
}));

import {
  DELETE as deleteSharing,
  PATCH as patchSharing,
} from '@/app/api/documents/sharing/route';

describe('documents sharing security hardening', () => {
  const documentId = '550e8400-e29b-41d4-a716-446655440000';
  const shareId = '550e8400-e29b-41d4-a716-446655440001';

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: 'session-user' } });
    mocks.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          { id: documentId, userId: 'session-user' },
        ]),
      }),
    });
  });

  it('returns 404 when DELETE shareId is not scoped to documentId', async () => {
    mocks.delete.mockReturnValueOnce({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([]),
      }),
    });

    const response = await deleteSharing(
      new Request('http://localhost/api/documents/sharing', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId,
          shareId,
          shareType: 'user',
        }),
      }) as any,
    );

    expect(response.status).toBe(404);
    expect(mocks.eq).toHaveBeenCalledWith(
      'documentShareUser.documentId',
      documentId,
    );
  });

  it('returns 404 when PATCH shareId is not scoped to documentId', async () => {
    mocks.update.mockReturnValueOnce({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    const response = await patchSharing(
      new Request('http://localhost/api/documents/sharing', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId,
          shareId,
          shareType: 'user',
          permission: 'view',
        }),
      }) as any,
    );

    expect(response.status).toBe(404);
    expect(mocks.eq).toHaveBeenCalledWith(
      'documentShareUser.documentId',
      documentId,
    );
  });
});
