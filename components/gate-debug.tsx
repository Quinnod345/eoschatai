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
  if (!entitlements) {
    console.log(`[Gate] No entitlements loaded yet for feature: ${feature}`);
    return false;
  }
  const { features } = entitlements;

  let enabled = false;
  switch (feature) {
    case 'export':
      enabled = features.export;
      break;
    case 'calendar_connect':
      enabled = features.calendar_connect;
      break;
    case 'recordings':
      enabled = features.recordings.enabled;
      break;
    case 'deep_research':
      enabled = features.deep_research.enabled;
      break;
    default:
      enabled = false;
  }

  console.log(`[Gate] Feature ${feature} enabled: ${enabled}`);
  return enabled;
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
  const { entitlements, usageCounters, user, ready } = useAccountStore(
    (state) => ({
      entitlements: state.entitlements,
      usageCounters: state.usageCounters,
      user: state.user,
      ready: state.ready,
    }),
  );
  const plan = user?.plan ?? 'free';

  const impressionTracked = useRef(false);

  useEffect(() => {
    console.log(`[Gate] Component state for ${feature}:`, {
      ready,
      user,
      entitlements,
      plan,
    });
  }, [feature, ready, user, entitlements, plan]);

  const enabled = useMemo(
    () => isFeatureEnabled(feature, entitlements),
    [feature, entitlements],
  );

  useEffect(() => {
    if (!enabled && ready) {
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
  }, [enabled, feature, plan, placement, mode, ready]);

  // If account data isn't loaded yet, show loading state
  if (!ready) {
    console.log(`[Gate] Account not ready for feature: ${feature}`);
    return <div className="animate-pulse">Loading...</div>;
  }

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
