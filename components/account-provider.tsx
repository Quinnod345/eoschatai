'use client';

import { useCallback, useEffect, useRef } from 'react';

import { useAccountStore, type AccountBootstrap, type PriceSummary } from '@/lib/stores/account-store';
import { useUpgradeStore } from '@/lib/stores/upgrade-store';
import { UpgradeModal } from '@/components/upgrade-modal';
import type { UpgradeFeature } from '@/types/upgrade';

async function fetchBootstrap(): Promise<AccountBootstrap | null> {
  const response = await fetch('/api/me', { cache: 'no-store' });
  if (!response.ok) {
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
  const {
    ready,
    user,
    featureFlags,
    setBootstrap,
    setLoading,
    setError,
  } = useAccountStore();
  const { open, feature, onAutoRetry, closeModal } = useUpgradeStore();

  const refreshRef = useRef<() => Promise<void>>();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await fetchBootstrap();
      if (!payload) {
        setError('Failed to load account data');
        return;
      }

      let prices: PriceSummary[] | undefined;
      if (payload.feature_flags?.stripe_mvp) {
        try {
          prices = await fetchPrices();
        } catch (error) {
          console.warn('[account] Failed to load Stripe prices', error);
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
  }, [refresh]);

  useEffect(() => {
    if (!ready || !featureFlags.entitlements_ws || !user?.id) {
      return;
    }

    const eventSource = new EventSource(`/api/entitlements/events?user_id=${user.id}`);

    const handleMessage = () => {
      refreshRef.current?.().catch((error) => {
        console.error('[account] Failed to refresh after event', error);
      });
    };

    eventSource.addEventListener('message', handleMessage);
    eventSource.addEventListener('ready', () => {
      // no-op
    });
    eventSource.addEventListener('error', (event) => {
      console.warn('[account] SSE error', event);
    });

    return () => {
      eventSource.removeEventListener('message', handleMessage);
      eventSource.close();
    };
  }, [ready, featureFlags.entitlements_ws, user?.id]);

  return (
    <>
      {children}
      {feature ? (
        <UpgradeModal
          feature={feature as UpgradeFeature}
          open={open}
          onClose={closeModal}
          onAutoRetry={onAutoRetry ?? undefined}
        />
      ) : null}
    </>
  );
}
