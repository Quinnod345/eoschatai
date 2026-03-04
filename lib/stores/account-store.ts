import { create } from 'zustand';

import type {
  NormalizedEntitlements,
  UsageCounters,
} from '@/lib/entitlements/types';

export type PlanName = 'free' | 'pro' | 'business';

export type AccountUser = {
  id: string;
  email: string;
  plan: PlanName;
  orgId: string | null;
  subscriptionSource: 'stripe' | 'circle';
};

export type AccountOrg = {
  id: string;
  name: string | null;
  plan: PlanName;
  seatCount: number;
  limits: unknown;
  subscriptionSource: 'stripe' | 'circle';
} | null;

export type FeatureFlagSnapshot = Record<string, boolean>;

export type PriceSummary = {
  id: string;
  plan: 'pro' | 'business';
  interval: 'monthly' | 'annual';
  unitAmount: number | null;
  currency: string | null;
};

export type AccountBootstrap = {
  user: AccountUser;
  org: AccountOrg;
  entitlements: NormalizedEntitlements;
  usage_counters: UsageCounters;
  feature_flags?: FeatureFlagSnapshot;
  prices?: PriceSummary[];
};

type AccountState = {
  ready: boolean;
  loading: boolean;
  user: AccountUser | null;
  org: AccountOrg;
  entitlements: NormalizedEntitlements | null;
  usageCounters: UsageCounters | null;
  featureFlags: FeatureFlagSnapshot;
  prices: PriceSummary[];
  lastError?: string;
  setBootstrap: (payload: AccountBootstrap) => void;
  setLoading: (value: boolean) => void;
  setError: (error?: string) => void;
  reset: () => void;
};

const INITIAL_STATE: Omit<
  AccountState,
  'setBootstrap' | 'setLoading' | 'setError' | 'reset'
> = {
  ready: false,
  loading: false,
  user: null,
  org: null,
  entitlements: null,
  usageCounters: null,
  featureFlags: {},
  prices: [],
  lastError: undefined,
};

export const useAccountStore = create<AccountState>((set) => ({
  ...INITIAL_STATE,
  setBootstrap: (payload) =>
    set(() => ({
      ready: true,
      loading: false,
      user: payload.user,
      org: payload.org,
      entitlements: payload.entitlements,
      usageCounters: payload.usage_counters,
      featureFlags: payload.feature_flags ?? {},
      prices: payload.prices ?? [],
      lastError: undefined,
    })),
  setLoading: (value) => set({ loading: value }),
  setError: (error) => set({ lastError: error }),
  reset: () => set({ ...INITIAL_STATE }),
}));
