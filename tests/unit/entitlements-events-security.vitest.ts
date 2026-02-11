import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getRedisClient: vi.fn(),
  subscribe: vi.fn(),
  subscriberOn: vi.fn(),
  subscriberRemoveAllListeners: vi.fn(),
  subscriberUnsubscribe: vi.fn(),
}));

vi.mock('@/app/(auth)/auth', () => ({
  auth: mocks.auth,
}));

vi.mock('@/lib/config/feature-flags', () => ({
  FEATURE_FLAGS: {
    entitlements_ws: true,
  },
}));

vi.mock('@/lib/redis/client', () => ({
  getRedisClient: mocks.getRedisClient,
}));

import { GET as getEntitlementEvents } from '@/app/api/entitlements/events/route';

describe('entitlements events security hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(global, 'setInterval').mockImplementation((() => 1) as any);
    vi.spyOn(global, 'clearInterval').mockImplementation((() => undefined) as any);

    mocks.subscribe.mockReturnValue({
      on: mocks.subscriberOn,
      removeAllListeners: mocks.subscriberRemoveAllListeners,
      unsubscribe: mocks.subscriberUnsubscribe.mockResolvedValue(undefined),
    });
    mocks.getRedisClient.mockReturnValue({
      subscribe: mocks.subscribe,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('requires an authenticated session', async () => {
    mocks.auth.mockResolvedValue(null);

    const response = await getEntitlementEvents(
      new Request('http://localhost/api/entitlements/events?user_id=attacker'),
    );

    expect(response.status).toBe(401);
    expect(mocks.subscribe).not.toHaveBeenCalled();
  });

  it('uses session user id instead of query user_id', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'session-user' } });

    const response = await getEntitlementEvents(
      new Request('http://localhost/api/entitlements/events?user_id=attacker'),
    );

    expect(response.status).toBe(200);
    expect(mocks.subscribe).toHaveBeenCalledWith('user:session-user');

    await response.body?.cancel();
    expect(mocks.subscriberUnsubscribe).toHaveBeenCalled();
  });
});
