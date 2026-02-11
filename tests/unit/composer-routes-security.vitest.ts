import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  return {
    auth: vi.fn(),
    undoDocumentChange: vi.fn(),
    select: vi.fn(),
    insert: vi.fn(),
    eq: vi.fn((...args: unknown[]) => ({ op: 'eq', args })),
    and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
    desc: vi.fn((...args: unknown[]) => ({ op: 'desc', args })),
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

vi.mock('@/app/(auth)/auth', () => ({
  auth: mocks.auth,
}));

vi.mock('@/lib/db/document-history', () => ({
  undoDocumentChange: mocks.undoDocumentChange,
}));

vi.mock('@/lib/db', () => ({
  db: {
    select: mocks.select,
    insert: mocks.insert,
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: mocks.eq,
  and: mocks.and,
  desc: mocks.desc,
}));

vi.mock('@/lib/db/schema', () => ({
  document: {
    id: 'document.id',
    userId: 'document.userId',
  },
  l10Meeting: {},
  l10AgendaItem: {},
  l10Issue: {},
  l10Todo: {},
  voiceRecording: {},
  voiceTranscript: {},
}));

import { POST as undoPost } from '@/app/api/composer-documents/[id]/history/undo/route';
import { POST as l10Post } from '@/app/api/l10/route';
import { PUT as l10Put } from '@/app/api/l10/route';

describe('composer route security', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: 'session-user' } });
  });

  it('uses session user for undo even with spoofed body userId', async () => {
    mocks.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          { id: 'doc-1', userId: 'session-user' },
        ]),
      }),
    });
    mocks.undoDocumentChange.mockResolvedValueOnce({ id: 'version-1' });

    const response = await undoPost(
      new Request('http://localhost/api/composer-documents/doc-1/history/undo', {
        method: 'POST',
        body: JSON.stringify({ userId: 'attacker-user' }),
      }) as any,
      { params: Promise.resolve({ id: 'doc-1' }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.undoDocumentChange).toHaveBeenCalledWith(
      'doc-1',
      'session-user',
    );
  });

  it('blocks undo when document is not owned by session user', async () => {
    mocks.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ id: 'doc-1', userId: 'other-user' }]),
      }),
    });

    const response = await undoPost(
      new Request('http://localhost/api/composer-documents/doc-1/history/undo', {
        method: 'POST',
      }) as any,
      { params: Promise.resolve({ id: 'doc-1' }) },
    );

    expect(response.status).toBe(403);
    expect(mocks.undoDocumentChange).not.toHaveBeenCalled();
  });

  it('requires composer ownership before creating an L10 meeting', async () => {
    mocks.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });

    const response = await l10Post(
      new Request('http://localhost/api/l10', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          composerId: 'not-owned-doc',
          title: 'Weekly L10',
          attendees: [],
        }),
      }) as any,
    );

    expect(response.status).toBe(404);
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it('returns 400 for malformed JSON when creating an L10 meeting', async () => {
    const response = await l10Post(
      new Request('http://localhost/api/l10', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"composerId":"doc-1"',
      }) as any,
    );

    expect(response.status).toBe(400);
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it('rejects unknown L10 update fields', async () => {
    const response = await l10Put(
      new Request('http://localhost/api/l10', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meetingId: '550e8400-e29b-41d4-a716-446655440000',
          updates: { unexpectedField: 'value' },
        }),
      }) as any,
    );

    expect(response.status).toBe(400);
    expect(mocks.select).not.toHaveBeenCalled();
  });
});
