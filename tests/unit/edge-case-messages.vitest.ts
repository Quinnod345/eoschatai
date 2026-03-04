import { describe, expect, it, vi } from 'vitest';

import {
  mapEdgeCaseNotice,
  showEdgeCaseToast,
  type EdgeCaseAction,
} from '@/lib/ui/edge-case-messages';

const createToastMock = () => ({
  success: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
});

describe('edge-case message mapper', () => {
  it('maps FEATURE_LOCKED to upgrade warning', () => {
    const notice = mapEdgeCaseNotice({
      code: 'FEATURE_LOCKED',
      error: 'Personas require Pro',
      requiredPlan: 'pro',
    });

    expect(notice).not.toBeNull();
    expect(notice?.level).toBe('warning');
    expect(notice?.message).toBe('Personas require Pro');
    expect(notice?.action?.type).toBe('open_premium_modal');
    expect(notice?.action?.label).toBe('Upgrade to Pro');
  });

  it('maps Circle warning payloads to billing portal action', () => {
    const notice = mapEdgeCaseNotice({
      warning:
        'You still have an active Stripe Pro subscription. Cancel to avoid double billing.',
      warningCode: 'REDUNDANT_STRIPE_SUBSCRIPTION',
    });

    expect(notice).not.toBeNull();
    expect(notice?.level).toBe('warning');
    expect(notice?.action?.type).toBe('open_billing_portal');
  });

  it('maps wrong-account invite with action metadata', () => {
    const notice = mapEdgeCaseNotice({
      code: 'INVITE_WRONG_ACCOUNT',
      targetEmail: 'owner@company.com',
      inviteCode: 'ABC123',
    });

    expect(notice).not.toBeNull();
    expect(notice?.action?.type).toBe('reopen_invite_after_switch');
    expect(notice?.action?.meta?.targetEmail).toBe('owner@company.com');
    expect(notice?.action?.meta?.inviteCode).toBe('ABC123');
  });
});

describe('edge-case toast presenter', () => {
  it('uses mapped toast level and runs provided action handler', async () => {
    const toast = createToastMock();
    const onAction = vi.fn(async (_action: EdgeCaseAction) => undefined);

    const handled = await showEdgeCaseToast(
      toast,
      {
        code: 'FEATURE_LOCKED',
        error: 'Recordings require Pro',
        requiredPlan: 'pro',
      },
      { onAction },
    );

    expect(handled).toBe(true);
    expect(toast.warning).toHaveBeenCalledTimes(1);
    const options = toast.warning.mock.calls[0]?.[1];
    expect(options?.action?.label).toBe('Upgrade to Pro');

    options?.action?.onClick();
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('uses fallback message when payload is unmapped', async () => {
    const toast = createToastMock();

    const handled = await showEdgeCaseToast(
      toast,
      { unknown: true },
      { fallback: 'Generic failure' },
    );

    expect(handled).toBe(false);
    expect(toast.error).toHaveBeenCalledWith('Generic failure');
  });
});
