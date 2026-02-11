import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  updateContextFeedback: vi.fn(),
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

vi.mock('@/lib/db/context-tracking', () => ({
  updateContextFeedback: mocks.updateContextFeedback,
}));

import { POST as contextFeedbackPost } from '@/app/api/context-feedback/route';

describe('context feedback ownership hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: 'session-user' } });
  });

  it('binds feedback updates to the session user', async () => {
    mocks.updateContextFeedback.mockResolvedValue(true);

    const response = await contextFeedbackPost(
      new Request('http://localhost/api/context-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: '550e8400-e29b-41d4-a716-446655440000',
          wasHelpful: true,
        }),
      }) as any,
    );

    expect(response.status).toBe(200);
    expect(mocks.updateContextFeedback).toHaveBeenCalledWith(
      '550e8400-e29b-41d4-a716-446655440000',
      'session-user',
      'helpful',
    );
  });

  it('returns 404 when message is not owned by session user', async () => {
    mocks.updateContextFeedback.mockResolvedValue(false);

    const response = await contextFeedbackPost(
      new Request('http://localhost/api/context-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: '550e8400-e29b-41d4-a716-446655440000',
          wasHelpful: false,
        }),
      }) as any,
    );

    expect(response.status).toBe(404);
  });
});
