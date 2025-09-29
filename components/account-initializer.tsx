'use client';

import { useEffect } from 'react';
import { useAccountStore } from '@/lib/stores/account-store';

async function fetchBootstrap() {
  const response = await fetch('/api/me', { cache: 'no-store' });
  if (!response.ok) {
    throw new Error('Failed to fetch account data');
  }
  return response.json();
}

async function fetchPrices() {
  const response = await fetch('/api/billing/prices', { cache: 'no-store' });
  if (!response.ok) {
    return [];
  }
  const data = await response.json();
  return data.prices ?? [];
}

export function AccountInitializer() {
  console.log('[AccountInitializer] Component mounting');
  const { ready, setBootstrap, setLoading, setError } = useAccountStore();

  useEffect(() => {
    if (ready) {
      console.log('[AccountInitializer] Already initialized, skipping');
      return;
    }

    console.log('[AccountInitializer] Starting immediate initialization');

    const init = async () => {
      setLoading(true);
      try {
        const payload = await fetchBootstrap();
        console.log('[AccountInitializer] Bootstrap fetched:', payload);

        let prices = [];
        if (payload.feature_flags?.stripe_mvp) {
          try {
            prices = await fetchPrices();
            console.log('[AccountInitializer] Prices fetched:', prices);
          } catch (error) {
            console.warn('[AccountInitializer] Failed to load prices', error);
          }
        }

        setBootstrap({ ...payload, prices });
        console.log('[AccountInitializer] Account initialized successfully');
      } catch (error) {
        console.error('[AccountInitializer] Bootstrap failed', error);
        setError('Failed to load account data');
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [ready, setBootstrap, setLoading, setError]);

  return null;
}
