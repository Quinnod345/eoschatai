import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  dbSelect: vi.fn(),
  getDocumentsById: vi.fn(),
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

vi.mock('@/app/(auth)/auth', () => ({
  auth: mocks.auth,
}));

vi.mock('@/lib/db', () => ({
  db: {
    select: mocks.dbSelect,
  },
}));

vi.mock('@/lib/db/schema', () => ({
  userDocuments: {
    id: 'userDocuments.id',
    userId: 'userDocuments.userId',
  },
  userDocumentVersion: {
    id: 'userDocumentVersion.id',
    documentId: 'userDocumentVersion.documentId',
    versionNumber: 'userDocumentVersion.versionNumber',
  },
  document: {
    id: 'document.id',
    userId: 'document.userId',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => ({ op: 'eq', args })),
  and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
  desc: vi.fn((...args: unknown[]) => ({ op: 'desc', args })),
  inArray: vi.fn((...args: unknown[]) => ({ op: 'inArray', args })),
}));

vi.mock('@/lib/ai/user-rag', () => ({
  processUserDocument: vi.fn(),
  deleteUserDocument: vi.fn(),
}));

vi.mock('@vercel/blob', () => ({
  del: vi.fn(),
}));

vi.mock('@/lib/storage/tracking', () => ({
  updateUserStorage: vi.fn(),
}));

vi.mock('@/lib/composer/content-parsers', () => ({
  isValidVtoContent: vi.fn(() => true),
}));

vi.mock('@/lib/db/document-service', () => ({
  saveDocumentWithVersion: vi.fn(),
  getDocumentVersionsAsDocuments: vi.fn(),
}));

vi.mock('@/lib/db/queries', () => ({
  getDocumentsById: mocks.getDocumentsById,
  deleteDocumentsByIdAfterTimestamp: vi.fn(),
  db: {
    delete: vi.fn(),
    update: vi.fn(),
  },
}));

import { GET as getDocumentVersions } from '@/app/api/documents/versions/route';
import { POST as bulkDelete } from '@/app/api/documents/bulk-delete/route';
import { GET as getComposerDocument } from '@/app/(chat)/api/document/route';

describe('UUID route validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: 'session-user' } });
  });

  it('returns 400 for invalid documentId on document versions route', async () => {
    const response = await getDocumentVersions(
      new Request('http://localhost/api/documents/versions?documentId=not-a-uuid') as any,
    );

    expect(response.status).toBe(400);
    expect(mocks.dbSelect).not.toHaveBeenCalled();
  });

  it('returns 400 when bulk delete receives non-UUID documentIds', async () => {
    const response = await bulkDelete(
      new Request('http://localhost/api/documents/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentIds: ['not-a-uuid'] }),
      }) as any,
    );

    expect(response.status).toBe(400);
    expect(mocks.dbSelect).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid composer document id', async () => {
    const response = await getComposerDocument(
      new Request('http://localhost/api/document?id=not-a-uuid') as any,
    );

    expect(response.status).toBe(400);
    expect(mocks.getDocumentsById).not.toHaveBeenCalled();
  });
});
