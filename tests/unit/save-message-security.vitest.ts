import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  select: vi.fn(),
  saveMessages: vi.fn(),
  and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
  eq: vi.fn((...args: unknown[]) => ({ op: 'eq', args })),
}));

vi.mock('@/app/(auth)/auth', () => ({
  auth: mocks.auth,
}));

vi.mock('@/lib/db', () => ({
  db: {
    select: mocks.select,
  },
}));

vi.mock('@/lib/db/queries', () => ({
  saveMessages: mocks.saveMessages,
}));

vi.mock('drizzle-orm', () => ({
  and: mocks.and,
  eq: mocks.eq,
}));

vi.mock('@/lib/db/schema', () => ({
  chat: {
    id: 'chat.id',
    userId: 'chat.userId',
  },
}));

import { POST as saveMessagePost } from '@/app/api/chat/save-message/route';

describe('save-message ownership hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: 'session-user' } });
  });

  it('returns 403 when chat is not owned by session user', async () => {
    mocks.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    const response = await saveMessagePost(
      new Request('http://localhost/api/chat/save-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: '550e8400-e29b-41d4-a716-446655440000',
          messageId: 'client-message-id',
          message: {
            id: 'assistant-message-id',
            role: 'assistant',
            parts: [{ type: 'text', text: 'Hello world' }],
            createdAt: new Date().toISOString(),
          },
        }),
      }) as any,
    );

    expect(response.status).toBe(403);
    expect(mocks.saveMessages).not.toHaveBeenCalled();
  });
});
