'use client';

import { useLayoutEffect, useRef } from 'react';
import { useAccountStore } from '@/lib/stores/account-store';

// Force immediate account loading without waiting for React lifecycle
if (typeof window !== 'undefined') {
  const loadAccount = async () => {
    const state = useAccountStore.getState();
    if (state.ready || state.loading) {
      console.log('[AccountForceLoader] Already loading or ready, skipping');
      return;
    }

    console.log('[AccountForceLoader] Force loading account data');
    state.setLoading(true);

    try {
      const [accountRes, pricesRes] = await Promise.all([
        fetch('/api/me', { cache: 'no-store' }),
        fetch('/api/billing/prices', { cache: 'no-store' }),
      ]);

      if (!accountRes.ok) {
        throw new Error('Failed to fetch account');
      }

      const account = await accountRes.json();
      const pricesData = pricesRes.ok ? await pricesRes.json() : { prices: [] };

      console.log('[AccountForceLoader] Account loaded:', account);

      state.setBootstrap({
        ...account,
        prices: pricesData.prices || [],
      });
    } catch (error) {
      console.error('[AccountForceLoader] Failed to load account:', error);
      state.setError('Failed to load account data');
      state.setLoading(false);
    }
  };

  // Start loading immediately
  loadAccount();
}

export function AccountForceLoader() {
  const mounted = useRef(false);
  const { ready, loading } = useAccountStore();

  useLayoutEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      console.log('[AccountForceLoader] Component mounted, state:', {
        ready,
        loading,
      });
    }
  }, [ready, loading]);

  return null;
}

