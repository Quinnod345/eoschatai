'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  useAccountStore,
  type AccountBootstrap,
  type PriceSummary,
} from '@/lib/stores/account-store';
import { useUpgradeStore } from '@/lib/stores/upgrade-store';
import { SimpleUpgradeModal } from '@/components/simple-upgrade-modal';
import { BusinessUpgradeFlow } from '@/components/business-upgrade-flow';
import type { UpgradeFeature } from '@/types/upgrade';
import { toast } from 'sonner';

async function fetchBootstrap(): Promise<AccountBootstrap | null> {
  const response = await fetch('/api/me', { cache: 'no-store' });
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
  console.log('[AccountProvider] Component mounting');

  const { ready, user, featureFlags, setBootstrap, setLoading, setError } =
    useAccountStore();
  const { open, feature, onAutoRetry, closeModal, openModal } =
    useUpgradeStore();
  const [showBusinessFlow, setShowBusinessFlow] = useState(false);

  useEffect(() => {
    console.log('[AccountProvider] Modal state changed:', {
      open,
      feature,
      time: new Date().toISOString(),
    });
  }, [open, feature]);

  // Listen for business flow events
  useEffect(() => {
    const handleOpenBusinessFlow = () => {
      console.log('[AccountProvider] Opening business flow from event');
      setShowBusinessFlow(true);
    };

    window.addEventListener('open-business-flow', handleOpenBusinessFlow);
    return () =>
      window.removeEventListener('open-business-flow', handleOpenBusinessFlow);
  }, []);

  const refreshRef = useRef<() => Promise<void>>();

  const refresh = useCallback(async () => {
    console.log('[AccountProvider] Refresh called', {
      time: new Date().toISOString(),
      ready,
      user: user?.email,
    });

    setLoading(true);
    try {
      const payload = await fetchBootstrap();
      console.log('[AccountProvider] Bootstrap payload:', payload);

      if (!payload) {
        setError('Failed to load account data');
        return;
      }

      let prices: PriceSummary[] | undefined;
      if (payload.feature_flags?.stripe_mvp) {
        try {
          prices = await fetchPrices();
          console.log('[AccountProvider] Prices loaded:', prices);
        } catch (error) {
          console.warn('[account] Failed to load Stripe prices', error);
        }
      }

      setBootstrap({ ...payload, prices });
      console.log('[AccountProvider] Bootstrap complete', {
        user: payload.user,
        entitlements: payload.entitlements,
        featureFlags: payload.feature_flags,
      });
    } catch (error) {
      console.error('[account] Bootstrap failed', error);
      setError('Failed to load account data');
    } finally {
      setLoading(false);
    }
  }, [setBootstrap, setError, setLoading, ready, user?.email]);

  refreshRef.current = refresh;

  useEffect(() => {
    console.log('[AccountProvider] Initial load effect triggered');
    refresh().catch((error) => {
      console.error('[account] Initial refresh failed', error);
    });
  }, [refresh]);

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
          toast.info('You are already in an organization.');
          break;
        case 'invalid':
          toast.error('Invitation link is invalid or has expired.');
          break;
        case 'org_missing':
          toast.error('Organization not found for this invitation.');
          break;
        case 'denied':
          toast.error(`Cannot join organization${reason ? `: ${reason}` : ''}`);
          break;
        case 'wrong_account': {
          const message = targetEmail
            ? `This invite was sent to ${targetEmail}. Please switch accounts.`
            : 'This invite is for a different account. Please switch accounts.';
          const id = toast.warning(message, {
            action: inviteCode
              ? {
                  label: 'Re-open after switch',
                  onClick: () => {
                    const base = window.location.origin;
                    const acceptUrl = new URL(
                      '/api/organizations/accept',
                      base,
                    );
                    if (inviteCode)
                      acceptUrl.searchParams.set('code', inviteCode);
                    if (targetEmail)
                      acceptUrl.searchParams.set('email', targetEmail);
                    window.location.href = `/login?callbackUrl=${encodeURIComponent(acceptUrl.toString())}`;
                  },
                }
              : undefined,
            duration: 8000,
          });
          // no-op using id for possible future flows
          void id;
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
      refreshRef.current?.();
    } catch {
      // ignore
    }
  }, []);

  // Listen for account refresh events
  useEffect(() => {
    const handleRefreshEvent = () => {
      console.log('[AccountProvider] Received account-refresh event');
      refresh();
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

  // Listen for manual refresh events
  useEffect(() => {
    const handleRefresh = () => {
      console.log('[AccountProvider] Manual refresh triggered');
      refresh().catch((error) => {
        console.error('[account] Manual refresh failed', error);
      });
    };

    window.addEventListener('account-refresh', handleRefresh);
    return () => {
      window.removeEventListener('account-refresh', handleRefresh);
    };
  }, [refresh]);

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
      {feature ? (
        <SimpleUpgradeModal
          feature={feature as UpgradeFeature}
          open={open}
          onClose={closeModal}
          onAutoRetry={onAutoRetry ?? undefined}
        />
      ) : null}
      <BusinessUpgradeFlow
        open={showBusinessFlow}
        onClose={() => setShowBusinessFlow(false)}
        onSuccess={() => {
          setShowBusinessFlow(false);
          // Refresh account data after successful upgrade
          refresh();
        }}
      />
    </>
  );
}
