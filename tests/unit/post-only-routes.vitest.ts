import { describe, expect, it, vi } from 'vitest';

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

vi.mock('@/lib/auth/admin', () => ({
  requireAdmin: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {},
}));

vi.mock('@/lib/billing/stripe', () => ({
  createCustomerPortalSession: vi.fn(),
}));

vi.mock('@/lib/config/feature-flags', () => ({
  FEATURE_FLAGS: { stripe_mvp: true },
}));

describe('mutating route methods', () => {
  it('db-migrations route exposes POST only', async () => {
    const route = await import('@/app/api/db-migrations/route');

    expect(typeof route.POST).toBe('function');
    expect((route as Record<string, unknown>).GET).toBeUndefined();
  });

  it('migrate-user-settings route exposes POST only', async () => {
    const route = await import('@/app/api/migrate-user-settings/route');

    expect(typeof route.POST).toBe('function');
    expect((route as Record<string, unknown>).GET).toBeUndefined();
  });

  it('billing portal route exposes POST only', async () => {
    const route = await import('@/app/api/billing/portal/route');

    expect(typeof route.POST).toBe('function');
    expect((route as Record<string, unknown>).GET).toBeUndefined();
  });
});
