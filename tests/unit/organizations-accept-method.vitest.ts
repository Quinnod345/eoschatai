import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  validateInviteCode: vi.fn(),
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
  db: {},
}));

vi.mock('@/lib/db/schema', () => ({
  org: {},
  user: {},
  orgInvitation: {},
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  and: vi.fn(),
  sql: vi.fn(),
}));

import { GET as acceptInviteGet } from '@/app/api/organizations/accept/route';

describe('organizations accept method hardening', () => {
  it('GET only redirects to invite page and does not mutate', async () => {
    const response = await acceptInviteGet(
      new Request(
        'http://localhost/api/organizations/accept?code=abc123&email=user@example.com',
      ) as any,
    );

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toContain(
      '/invite/accept?code=abc123&email=user%40example.com',
    );
    expect(mocks.auth).not.toHaveBeenCalled();
    expect(mocks.validateInviteCode).not.toHaveBeenCalled();
  });
});
