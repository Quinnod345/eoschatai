import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  processUserDocument: vi.fn(),
  eq: vi.fn((...args: unknown[]) => ({ op: 'eq', args })),
  and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
  desc: vi.fn((...args: unknown[]) => ({ op: 'desc', args })),
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
    insert: mocks.insert,
    update: mocks.update,
  },
}));

vi.mock('@/lib/db/schema', () => ({
  userDocuments: {
    id: 'userDocuments.id',
    userId: 'userDocuments.userId',
    version: 'userDocuments.version',
    fileName: 'userDocuments.fileName',
    fileUrl: 'userDocuments.fileUrl',
    fileSize: 'userDocuments.fileSize',
    content: 'userDocuments.content',
    contentHash: 'userDocuments.contentHash',
    updatedAt: 'userDocuments.updatedAt',
  },
  userDocumentVersion: {
    id: 'userDocumentVersion.id',
    documentId: 'userDocumentVersion.documentId',
    versionNumber: 'userDocumentVersion.versionNumber',
    fileName: 'userDocumentVersion.fileName',
    fileUrl: 'userDocumentVersion.fileUrl',
    fileSize: 'userDocumentVersion.fileSize',
    content: 'userDocumentVersion.content',
    contentHash: 'userDocumentVersion.contentHash',
    uploadedAt: 'userDocumentVersion.uploadedAt',
    uploadedBy: 'userDocumentVersion.uploadedBy',
    isActive: 'userDocumentVersion.isActive',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: mocks.eq,
  and: mocks.and,
  desc: mocks.desc,
}));

vi.mock('@/lib/ai/user-rag', () => ({
  processUserDocument: mocks.processUserDocument,
}));

vi.mock('@vercel/blob', () => ({
  put: vi.fn(),
}));

import { POST as manageVersions } from '@/app/api/documents/versions/route';

describe('document versions security hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: 'session-user' } });
  });

  it('rejects restore when versionId belongs to another document', async () => {
    mocks.select
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            {
              id: 'doc-a',
              userId: 'session-user',
              version: 3,
              fileName: 'current.md',
              fileUrl: 'https://example.com/current',
              fileSize: 123,
              content: 'current content',
              contentHash: 'current-hash',
              isContext: false,
              category: 'Other',
              fileType: 'text/plain',
            },
          ]),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            {
              id: 'ver-1',
              documentId: 'doc-b',
              fileName: 'old.md',
              fileUrl: 'https://example.com/old',
              fileSize: 100,
              content: 'old content',
              contentHash: 'old-hash',
            },
          ]),
        }),
      });

    const response = await manageVersions(
      new Request('http://localhost/api/documents/versions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'restore',
          documentId: 'doc-a',
          versionId: 'ver-1',
        }),
      }) as any,
    );

    expect(response.status).toBe(400);
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
