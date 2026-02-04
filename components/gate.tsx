'use client';

import { useEffect, useMemo, useRef, type ReactNode } from 'react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type {
  NormalizedEntitlements,
  UsageCounters,
} from '@/lib/entitlements/types';
import { useAccountStore } from '@/lib/stores/account-store';
import type { UpgradeFeature } from '@/types/upgrade';
import { trackClientEvent } from '@/lib/analytics/client';

type GateMode = 'hard' | 'soft';

type GateProps = {
  feature: UpgradeFeature;
  fallback?: ReactNode;
  mode?: GateMode;
  usageKey?: keyof UsageCounters;
  limit?: number | null;
  className?: string;
  children: ReactNode;
  chipLabel?: string;
  placement?: string;
};

const isFeatureEnabled = (
  feature: UpgradeFeature,
  entitlements: NormalizedEntitlements | null,
) => {
  if (!entitlements) return false;
  const { features } = entitlements;

  switch (feature) {
    case 'export':
      return features.export;
    case 'calendar_connect':
      return features.calendar_connect;
    case 'recordings':
      return features.recordings.enabled;
    case 'deep_research':
      return features.deep_research.enabled;
    case 'api_access':
      return features.api_access;
    case 'premium':
      // For general premium, check if user has any premium features
      return (
        features.export ||
        features.calendar_connect ||
        features.recordings.enabled ||
        features.deep_research.enabled
      );
    default:
      return false;
  }
};

const deriveDefaultLimit = (
  feature: UpgradeFeature,
  entitlements: NormalizedEntitlements | null,
) => {
  if (!entitlements) return null;
  const { features } = entitlements;

  switch (feature) {
    case 'recordings':
      return features.recordings.minutes_month;
    case 'deep_research':
      return features.deep_research.lookups_per_run;
    case 'premium':
      return null; // No specific limit for general premium
    default:
      return null;
  }
};

export function Gate({
  feature,
  fallback = null,
  mode = 'hard',
  usageKey,
  limit,
  className,
  chipLabel,
  placement = 'unspecified',
  children,
}: GateProps) {
  const entitlements = useAccountStore((state) => state.entitlements);
  const usageCounters = useAccountStore((state) => state.usageCounters);
  const plan = useAccountStore((state) => state.user?.plan ?? 'free');

  const impressionTracked = useRef(false);

  const enabled = useMemo(
    () => isFeatureEnabled(feature, entitlements),
    [feature, entitlements],
  );

  useEffect(() => {
    if (!enabled) {
      if (!impressionTracked.current) {
        impressionTracked.current = true;
        // Only track analytics for valid analytics features (not 'premium')
        if (feature !== 'premium') {
          trackClientEvent({
            event: 'gate_impression',
            properties: {
              feature: feature as
                | 'export'
                | 'calendar_connect'
                | 'recordings'
                | 'deep_research',
              plan,
              placement,
              mode,
            },
          }).catch(() => {});
        }
      }
    } else {
      impressionTracked.current = false;
    }
  }, [enabled, feature, plan, placement, mode]);

  if (!enabled && mode !== 'soft') {
    return <>{fallback}</>;
  }

  if (!enabled) {
    return <>{fallback}</>;
  }

  const chip = (() => {
    if (mode !== 'soft' || !usageKey || !usageCounters) return null;
    const used = usageCounters[usageKey] ?? 0;
    const resolvedLimit = limit ?? deriveDefaultLimit(feature, entitlements);
    if (
      resolvedLimit === null ||
      resolvedLimit === undefined ||
      resolvedLimit <= 0
    ) {
      return null;
    }

    const label = chipLabel ?? `${used}/${resolvedLimit}`;
    return <Badge variant="secondary">{label}</Badge>;
  })();

  if (!chip) {
    return <>{children}</>;
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {children}
      {chip}
    </div>
  );
}
