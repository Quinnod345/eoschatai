'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  useAccountStore,
  type AccountBootstrap,
  type PriceSummary,
} from '@/lib/stores/account-store';
import { useUpgradeStore } from '@/lib/stores/upgrade-store';
import { PremiumFeaturesModal } from '@/components/premium-features-modal';
import { BusinessUpgradeFlow } from '@/components/business-upgrade-flow';
import { CircleConnectFlow } from '@/components/circle-connect-flow';
import type { UpgradeFeature } from '@/types/upgrade';
import { toast } from 'sonner';
import { showEdgeCaseToast } from '@/lib/ui/edge-case-messages';

async function fetchBootstrap(forceNoCache = false): Promise<AccountBootstrap | null> {
  const response = await fetch('/api/me', forceNoCache ? { cache: 'no-store' } : undefined);
  if (!response.ok) {
    console.error(
      '[AccountProvider] Failed to fetch account data:',
      response.status,
    );
    return null;
  }

  return (await response.json()) as AccountBootstrap;
}

async function fetchPrices(): Promise<PriceSummary[]> {
  const response = await fetch('/api/billing/prices', { cache: 'no-store' });
  if (!response.ok) {
    return [];
  }

  const data = (await response.json()) as { prices?: PriceSummary[] };
  return data.prices ?? [];
}

export function AccountProvider({ children }: { children: React.ReactNode }) {
  const { ready, user, featureFlags, setBootstrap, setLoading, setError } =
    useAccountStore();
  const { open, feature, onAutoRetry, closeModal, openModal } =
    useUpgradeStore();
  const [showBusinessFlow, setShowBusinessFlow] = useState(false);
  const [showCircleFlow, setShowCircleFlow] = useState(false);

  // Listen for business flow and premium modal events
  useEffect(() => {
    const handleOpenBusinessFlow = () => {
      console.log('[AccountProvider] Opening business flow from event');
      setShowBusinessFlow(true);
    };

    const handleOpenPremiumModal = () => {
      console.log('[AccountProvider] Opening premium modal from event');
      // Open modal with generic 'premium' feature since event doesn't specify which feature
      openModal('premium');
    };

    const handleOpenCircleFlow = () => {
      console.log('[AccountProvider] Opening Circle connect flow from event');
      setShowCircleFlow(true);
    };

    window.addEventListener('open-business-flow', handleOpenBusinessFlow);
    window.addEventListener('open-premium-modal', handleOpenPremiumModal);
    window.addEventListener('open-circle-connect-flow', handleOpenCircleFlow);

    return () => {
      window.removeEventListener('open-business-flow', handleOpenBusinessFlow);
      window.removeEventListener('open-premium-modal', handleOpenPremiumModal);
      window.removeEventListener('open-circle-connect-flow', handleOpenCircleFlow);
    };
  }, [openModal]);

  const refreshRef = useRef<(() => Promise<void>) | null>(null);

  const refresh = useCallback(async (forceNoCache = false) => {
    setLoading(true);
    try {
      // Fire /api/me and Circle verify simultaneously — Circle verify returns fast
      // for non-Circle users (early exit on server), so it's safe to always call it.
      const [payload, verifyResult] = await Promise.all([
        fetchBootstrap(forceNoCache),
        fetch('/api/integrations/circle/verify', {
          method: 'POST',
          cache: 'no-store',
        })
          .then((r) => (r.ok ? (r.json() as Promise<{ verified?: boolean; changed?: boolean; plan?: string; code?: string; reason?: string }>) : null))
          .catch(() => null),
      ]);

      if (!payload) {
        setError('Failed to load account data');
        return;
      }

      // Show edge-case toasts for non-trivial Circle verify results
      if (
        verifyResult?.code &&
        verifyResult.code !== 'CIRCLE_PLAN_VERIFIED' &&
        verifyResult.code !== 'NOT_CIRCLE_SUBSCRIBER'
      ) {
        showEdgeCaseToast(toast, verifyResult).catch(() => {});
      }

      let prices: PriceSummary[] | undefined;
      if (payload.feature_flags?.stripe_mvp) {
        try {
          prices = await fetchPrices();
        } catch (error) {
          console.warn('[account] Failed to load Stripe prices', error);
        }
      }

      // If Circle verify detected a plan change, re-fetch bootstrap to get the updated plan
      if (verifyResult?.changed) {
        const refreshedPayload = await fetchBootstrap(true);
        if (refreshedPayload) {
          setBootstrap({ ...refreshedPayload, prices });
          return;
        }
      }

      setBootstrap({ ...payload, prices });
    } catch (error) {
      console.error('[account] Bootstrap failed', error);
      setError('Failed to load account data');
    } finally {
      setLoading(false);
    }
  }, [setBootstrap, setError, setLoading]);

  refreshRef.current = refresh;

  useEffect(() => {
    refresh().catch((error) => {
      console.error('[account] Initial refresh failed', error);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle invite acceptance/invalid states via query param
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const invite = url.searchParams.get('invite');
      const reason = url.searchParams.get('reason') || undefined;
      const targetEmail = url.searchParams.get('targetEmail') || undefined;
      const inviteCode = url.searchParams.get('code') || undefined;
      if (!invite) return;

      switch (invite) {
        case 'accepted':
          toast.success(
            'Invitation accepted. You have joined the organization.',
          );
          break;
        case 'already_in_org':
          void showEdgeCaseToast(toast, { code: 'ALREADY_IN_ORG' });
          break;
        case 'invalid':
          void showEdgeCaseToast(toast, {
            code: 'INVITE_INVALID_OR_EXPIRED',
          });
          break;
        case 'org_missing':
          void showEdgeCaseToast(toast, { code: 'ORG_NOT_FOUND' });
          break;
        case 'denied':
          void showEdgeCaseToast(
            toast,
            reason?.toLowerCase().includes('seat limit')
              ? {
                  code: 'ORG_SEAT_LIMIT_REACHED',
                  message: reason,
                }
              : {
                  message: `Cannot join organization${reason ? `: ${reason}` : ''}`,
                },
            {
              fallback: 'Cannot join organization.',
            },
          );
          break;
        case 'wrong_account': {
          void showEdgeCaseToast(toast, {
            code: 'INVITE_WRONG_ACCOUNT',
            targetEmail,
            inviteCode,
          });
          break;
        }
        default:
          break;
      }

      // Remove query params from the URL to keep things clean
      ['invite', 'reason', 'targetEmail', 'code'].forEach((k) =>
        url.searchParams.delete(k),
      );
      window.history.replaceState({}, '', url.toString());

      // Refresh account/org data after handling
      refreshRef.current?.().catch((error) => {
        console.error('[account] Refresh after invite flow failed', error);
      });
    } catch {
      // ignore
    }
  }, []);

  // Listen for account refresh events
  useEffect(() => {
    const handleRefreshEvent = () => {
      console.log('[AccountProvider] Received account-refresh event');
      refresh().catch((error) => {
        console.error('[account] Refresh event failed', error);
      });
    };

    window.addEventListener('account-refresh', handleRefreshEvent);
    return () =>
      window.removeEventListener('account-refresh', handleRefreshEvent);
  }, [refresh]);

  useEffect(() => {
    if (!ready || !featureFlags.entitlements_ws || !user?.id) {
      return;
    }

    const url = `/api/entitlements/events?user_id=${user.id}`;
    console.log('[account] Opening SSE', { url });
    const eventSource = new EventSource(url);

    const handleMessage = () => {
      refreshRef.current?.().catch((error) => {
        console.error('[account] Failed to refresh after event', error);
      });
    };

    eventSource.addEventListener('message', handleMessage);
    eventSource.addEventListener('open', () => {
      console.log('[account] SSE open');
    });
    eventSource.addEventListener('ready', () => {
      console.log('[account] SSE ready');
    });
    eventSource.addEventListener('error', (event) => {
      console.warn('[account] SSE error', event);
    });

    return () => {
      try {
        eventSource.removeEventListener('message', handleMessage);
      } catch {}
      eventSource.close();
    };
  }, [ready, featureFlags.entitlements_ws, user?.id]);

  // Dev-only helpers to force-open the upgrade modal for testing
  useEffect(() => {
    // Only enable in non-production to avoid accidental exposure
    if (process.env.NODE_ENV === 'production') return;

    // 1) Query param: ?openUpgrade=<feature>
    try {
      const params = new URLSearchParams(window.location.search);
      let requested = params.get('openUpgrade');
      const allowed: UpgradeFeature[] = [
        'export',
        'calendar_connect',
        'recordings',
        'deep_research',
        'premium',
      ];
      if (requested && !allowed.includes(requested as UpgradeFeature)) {
        const normalized = requested.trim().toLowerCase();
        if (normalized === '' || normalized === '1' || normalized === 'true') {
          requested = 'deep_research';
        } else {
          requested = null;
        }
      }
      if (requested && allowed.includes(requested as UpgradeFeature)) {
        // Defer slightly to allow bootstrap to populate store first
        setTimeout(() => openModal(requested as UpgradeFeature), 0);
      }
    } catch {
      // no-op
    }

    // Expose a global helper for console-driven testing: window.openUpgrade('export' | 'calendar_connect' | 'recordings' | 'deep_research')
    try {
      const allowed: UpgradeFeature[] = [
        'export',
        'calendar_connect',
        'recordings',
        'deep_research',
        'premium',
      ];
      (
        window as unknown as { openUpgrade?: (f?: UpgradeFeature) => void }
      ).openUpgrade = (f?: UpgradeFeature) => {
        const picked = f && allowed.includes(f) ? f : 'deep_research';
        openModal(picked);
      };
    } catch {
      // no-op
    }

    // Cleanup: Remove global helper when unmounted
    return () => {
      try {
        (window as unknown as { openUpgrade?: unknown }).openUpgrade =
          undefined;
      } catch {
        // no-op
      }
    };
  }, [openModal]);

  return (
    <>
      {children}
      <PremiumFeaturesModal open={open} onClose={closeModal} />
      <BusinessUpgradeFlow
        open={showBusinessFlow}
        onClose={() => setShowBusinessFlow(false)}
        onSuccess={() => {
          setShowBusinessFlow(false);
          // Refresh account data after successful upgrade
          refresh().catch((error) => {
            console.error('[account] Refresh after business upgrade failed', error);
          });
        }}
      />
      <CircleConnectFlow
        open={showCircleFlow}
        onClose={() => setShowCircleFlow(false)}
        onSuccess={() => {
          refresh().catch((error) => {
            console.error('[account] Refresh after Circle connect failed', error);
          });
        }}
      />
    </>
  );
}
