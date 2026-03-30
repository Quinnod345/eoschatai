type EdgeCaseLevel = 'success' | 'info' | 'warning' | 'error';

export type EdgeCaseActionType =
  | 'open_premium_modal'
  | 'open_circle_connect_flow'
  | 'open_settings_profile'
  | 'open_billing_portal'
  | 'reopen_invite_after_switch';

export type EdgeCaseAction = {
  type: EdgeCaseActionType;
  label: string;
  meta?: Record<string, string | undefined>;
};

export type EdgeCaseNotice = {
  level: EdgeCaseLevel;
  message: string;
  code?: string;
  duration?: number;
  action?: EdgeCaseAction;
};

type EdgeCasePayload = {
  code?: string;
  error?: string;
  message?: string;
  reason?: string;
  feature?: string;
  requiredPlan?: string;
  plan?: string;
  action?: string;
  warning?: string;
  warningCode?: string;
  warningAction?: string;
  notice?: string;
  targetEmail?: string;
  inviteCode?: string;
  [key: string]: unknown;
};

type ToastAction = { label: string; onClick: () => void };
type ToastOptions = { duration?: number; action?: ToastAction };

type ToastLike = {
  success: (message: string, options?: ToastOptions) => void;
  info: (message: string, options?: ToastOptions) => void;
  warning: (message: string, options?: ToastOptions) => void;
  error: (message: string, options?: ToastOptions) => void;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toPayload = (input: unknown): EdgeCasePayload | null => {
  if (isRecord(input)) {
    return input as EdgeCasePayload;
  }

  if (typeof input === 'string') {
    try {
      const parsed = JSON.parse(input) as unknown;
      if (isRecord(parsed)) {
        return parsed as EdgeCasePayload;
      }
    } catch {
      // no-op
    }

    return { message: input };
  }

  if (input instanceof Error) {
    const fromMessage = toPayload(input.message);
    if (fromMessage) {
      return fromMessage;
    }

    return { message: input.message };
  }

  return null;
};

const upgradeAction = (requiredPlan?: string): EdgeCaseAction => ({
  type: 'open_premium_modal',
  label:
    requiredPlan === 'business'
      ? 'Upgrade to Business'
      : requiredPlan === 'pro'
        ? 'Upgrade to Pro'
        : 'Upgrade Plan',
});

export const mapEdgeCaseNotice = (input: unknown): EdgeCaseNotice | null => {
  const payload = toPayload(input);
  if (!payload) return null;

  if (payload.warning) {
    if (payload.warningCode === 'REDUNDANT_STRIPE_SUBSCRIPTION') {
      return {
        level: 'warning',
        message: payload.warning,
        code: payload.warningCode,
        action: {
          type: 'open_billing_portal',
          label: 'Manage Billing',
        },
      };
    }

    return {
      level: 'warning',
      message: payload.warning,
      code: payload.warningCode,
    };
  }

  if (payload.notice) {
    return {
      level: 'info',
      message: payload.notice,
      code: payload.code,
    };
  }

  const code = payload.code ?? payload.error;
  const plan = typeof payload.plan === 'string' ? payload.plan : undefined;
  const requiredPlan =
    typeof payload.requiredPlan === 'string' ? payload.requiredPlan : undefined;
  const reason = typeof payload.reason === 'string' ? payload.reason : undefined;
  const message =
    typeof payload.message === 'string'
      ? payload.message
      : typeof payload.error === 'string'
        ? payload.error
        : undefined;

  switch (code) {
    case 'FEATURE_LOCKED':
      return {
        level: 'warning',
        message: message ?? 'This feature requires a paid plan.',
        code,
        action: upgradeAction(requiredPlan),
      };
    case 'LIMIT_REACHED':
      return {
        level: 'warning',
        message: message ?? 'You reached your current plan limit.',
        code,
        action: upgradeAction(requiredPlan),
      };
    case 'ENTITLEMENT_BLOCK':
      if (reason === 'limit_exceeded') {
        return {
          level: 'warning',
          message:
            message ??
            'You reached your usage limit for this feature. Upgrade for higher limits.',
          code,
          action: upgradeAction(requiredPlan),
        };
      }
      return {
        level: 'warning',
        message: message ?? 'This feature is not available on your current plan.',
        code,
        action: upgradeAction(requiredPlan),
      };
    case 'DAILY_LIMIT_REACHED':
      return {
        level: 'warning',
        message:
          message ?? 'Daily message limit reached. Your limit resets at midnight.',
        code,
        action: plan === 'free' ? upgradeAction('pro') : undefined,
      };
    case 'PERSONA_FALLBACK_TO_DEFAULT':
      return {
        level: 'info',
        message:
          message ??
          'Persona access is unavailable on your current plan, so we used the default assistant.',
        code,
        action: upgradeAction('pro'),
      };
    case 'CIRCLE_MEMBER_NOT_FOUND':
      return {
        level: 'warning',
        message:
          message ??
          'We could not find your Circle membership. Make sure your account emails match.',
        code,
        action: {
          type: 'open_settings_profile',
          label: 'Open Settings',
        },
      };
    case 'CIRCLE_MEMBERSHIP_NOT_FOUND':
      return {
        level: 'warning',
        message:
          message ??
          'We could not verify an active Circle membership. Your plan may have changed.',
        code,
        action: {
          type: 'open_circle_connect_flow',
          label: 'Reconnect Circle',
        },
      };
    case 'CIRCLE_VERIFY_TEMPORARY_FAILURE':
      return {
        level: 'info',
        message:
          message ??
          'Circle verification is temporarily unavailable. Your current plan was preserved.',
        code,
      };
    case 'CIRCLE_TIER_UNMAPPED':
      return {
        level: 'warning',
        message:
          message ??
          'Your Circle tier is not mapped yet. We preserved your current access for now.',
        code,
      };
    case 'INVALID_USER_EMAIL':
      return {
        level: 'warning',
        message:
          message ??
          'Your account email is invalid for verification. Update your profile email.',
        code,
        action: {
          type: 'open_settings_profile',
          label: 'Update Email',
        },
      };
    case 'ALREADY_IN_ORG':
      return {
        level: 'info',
        message: message ?? 'You are already a member of an organization.',
        code,
      };
    case 'INVITE_INVALID_OR_EXPIRED':
      return {
        level: 'error',
        message: message ?? 'Invite code is invalid or expired.',
        code,
      };
    case 'ORG_NOT_FOUND':
      return {
        level: 'error',
        message: message ?? 'Organization was not found.',
        code,
      };
    case 'ORG_SEAT_LIMIT_REACHED':
      return {
        level: 'warning',
        message:
          message ??
          'This organization has reached its seat limit. Ask the owner to add seats.',
        code,
      };
    case 'CIRCLE_PLAN_UPDATED':
      return {
        level: 'success',
        message: message ?? 'Your Circle plan has been synced successfully.',
        code,
      };
    case 'REDUNDANT_STRIPE_SUBSCRIPTION':
      return {
        level: 'warning',
        message:
          message ??
          'Your individual Stripe subscription may now be redundant. Consider canceling it.',
        code,
        action: {
          type: 'open_billing_portal',
          label: 'Manage Billing',
        },
      };
    case 'INVITE_WRONG_ACCOUNT': {
      const targetEmail =
        typeof payload.targetEmail === 'string' ? payload.targetEmail : undefined;
      const inviteCode =
        typeof payload.inviteCode === 'string' ? payload.inviteCode : undefined;
      return {
        level: 'warning',
        message: targetEmail
          ? `This invite is for ${targetEmail}. Switch accounts to continue.`
          : 'This invite is for a different account. Switch accounts to continue.',
        code,
        action: inviteCode
          ? {
              type: 'reopen_invite_after_switch',
              label: 'Switch Account',
              meta: { targetEmail, inviteCode },
            }
          : undefined,
      };
    }
    default:
      if (message) {
        return {
          level: 'error',
          message,
          code,
        };
      }
      return null;
  }
};

export const runEdgeCaseAction = async (action?: EdgeCaseAction) => {
  if (!action || typeof window === 'undefined') return;

  switch (action.type) {
    case 'open_premium_modal':
      window.dispatchEvent(new Event('open-premium-modal'));
      return;
    case 'open_circle_connect_flow':
      window.dispatchEvent(new Event('open-circle-connect-flow'));
      return;
    case 'open_settings_profile':
      window.location.href = '/chat?settings=profile';
      return;
    case 'open_billing_portal': {
      const response = await fetch('/api/billing/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = (await response.json()) as unknown;
      if (!response.ok || !isRecord(data) || typeof data.url !== 'string') {
        throw new Error(
          isRecord(data) && typeof data.error === 'string'
            ? data.error
            : 'Failed to open billing portal',
        );
      }
      window.location.href = data.url;
      return;
    }
    case 'reopen_invite_after_switch': {
      const inviteCode = action.meta?.inviteCode;
      const targetEmail = action.meta?.targetEmail;
      if (!inviteCode) return;

      const base = window.location.origin;
      const acceptUrl = new URL('/api/organizations/accept', base);
      acceptUrl.searchParams.set('code', inviteCode);
      if (targetEmail) {
        acceptUrl.searchParams.set('email', targetEmail);
      }

      window.location.href = `/login?callbackUrl=${encodeURIComponent(acceptUrl.toString())}`;
      return;
    }
    default:
      return;
  }
};

const recentEdgeCaseToasts = new Set<string>();

export const showEdgeCaseToast = async (
  toastApi: ToastLike,
  input: unknown,
  options?: {
    fallback?: string;
    onAction?: (action: EdgeCaseAction) => Promise<void> | void;
  },
): Promise<boolean> => {
  const notice = mapEdgeCaseNotice(input);
  if (!notice) {
    if (options?.fallback) {
      toastApi.error(options.fallback);
    }
    return false;
  }

  const dedupeKey = notice.code ?? notice.message;
  if (recentEdgeCaseToasts.has(dedupeKey)) {
    return true;
  }
  recentEdgeCaseToasts.add(dedupeKey);
  setTimeout(() => recentEdgeCaseToasts.delete(dedupeKey), 10000);

  const mappedAction = notice.action;
  const toastAction = mappedAction
    ? {
        label: mappedAction.label,
        onClick: () => {
          const handler = options?.onAction ?? runEdgeCaseAction;
          Promise.resolve(handler(mappedAction)).catch((error) => {
            const message =
              error instanceof Error ? error.message : 'Action failed';
            toastApi.error(message);
          });
        },
      }
    : undefined;

  toastApi[notice.level](notice.message, {
    duration: notice.duration,
    action: toastAction,
  });

  return true;
};
