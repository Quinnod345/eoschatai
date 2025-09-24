import { isProductionEnvironment } from '@/lib/constants';

type FlagEnvValue = string | undefined;

const coerceBoolean = (value: FlagEnvValue, fallback: boolean): boolean => {
  if (value === undefined) return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  return fallback;
};

const defaultEnabled = !isProductionEnvironment;

export const FEATURE_FLAGS = {
  free_gating_v1: coerceBoolean(process.env.FEATURE_FLAG_FREE_GATING_V1, defaultEnabled),
  stripe_mvp: coerceBoolean(process.env.FEATURE_FLAG_STRIPE_MVP, defaultEnabled),
  entitlements_ws: coerceBoolean(process.env.FEATURE_FLAG_ENTITLEMENTS_WS, defaultEnabled),
} as const satisfies Record<string, boolean>;

export type FeatureFlagKey = keyof typeof FEATURE_FLAGS;

export const isFeatureEnabled = (flag: FeatureFlagKey): boolean => FEATURE_FLAGS[flag];
