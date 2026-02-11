import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  select: vi.fn(),
  createDocumentVersion: vi.fn(),
  getOrCreateEditSession: vi.fn(),
  updateEditSession: vi.fn(),
  getDocumentHistory: vi.fn(),
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

vi.mock('@/lib/db/document-history', () => ({
  createDocumentVersion: mocks.createDocumentVersion,
  getOrCreateEditSession: mocks.getOrCreateEditSession,
  updateEditSession: mocks.updateEditSession,
  getDocumentHistory: mocks.getDocumentHistory,
}));

vi.mock('@/lib/db', () => ({
  db: {
    select: mocks.select,
  },
}));

vi.mock('@/lib/db/schema', () => ({
  document: {
    id: 'document.id',
    userId: 'document.userId',
  },
  documentEditSession: {
    id: 'documentEditSession.id',
    documentId: 'documentEditSession.documentId',
    userId: 'documentEditSession.userId',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: mocks.eq,
  and: mocks.and,
}));

import { POST as createComposerHistory } from '@/app/api/composer-documents/[id]/history/route';

describe('composer history route validation hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: 'session-user' } });
  });

  it('returns 400 for malformed JSON payload', async () => {
    const response = await createComposerHistory(
      new Request('http://localhost/api/composer-documents/doc-1/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"title":"Draft"',
      }) as any,
      { params: Promise.resolve({ id: 'doc-1' }) },
    );

    expect(response.status).toBe(400);
    expect(mocks.createDocumentVersion).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid kind values', async () => {
    const response = await createComposerHistory(
      new Request('http://localhost/api/composer-documents/doc-1/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Draft',
          content: 'Body',
          kind: 'invalid-kind',
        }),
      }) as any,
      { params: Promise.resolve({ id: 'doc-1' }) },
    );

    expect(response.status).toBe(400);
    expect(mocks.select).not.toHaveBeenCalled();
    expect(mocks.createDocumentVersion).not.toHaveBeenCalled();
  });
});
