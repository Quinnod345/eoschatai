'use client';

import { useCallback, useState } from 'react';
import { useAccountStore } from '@/lib/stores/account-store';
import type { FeatureEntitlements } from '@/lib/entitlements';

export type FeatureKey =
  | 'export'
  | 'calendar_connect'
  | 'recordings'
  | 'recordings.transcription'
  | 'recordings.speaker_diarization'
  | 'recordings.ai_summaries'
  | 'deep_research'
  | 'personas.custom'
  | 'personas.shared'
  | 'composer.advanced'
  | 'memory'
  | 'memory.embeddings'
  | 'version_history'
  | 'message_features.pin'
  | 'message_features.bookmark'
  | 'message_features.edit_history'
  | 'search.advanced'
  | 'search.cross_chat'
  | 'search.semantic'
  | 'analytics'
  | 'analytics.team_analytics'
  | 'l10_meetings'
  | 'organization'
  | 'api_access'
  | 'priority_support';

interface FeatureAccessResult {
  hasAccess: boolean;
  limit?: number;
  used?: number;
  remaining?: number;
  requiredPlan?: 'pro' | 'business';
  showUpgradeModal: () => void;
}

export function useFeatureAccess(feature: FeatureKey): FeatureAccessResult {
  const entitlements = useAccountStore((state) => state.entitlements);
  const user = useAccountStore((state) => state.user);
  const usageCounters = useAccountStore((state) => state.usageCounters);
  const [shouldShowUpgrade, setShouldShowUpgrade] = useState(false);

  const checkAccess = useCallback((): Omit<
    FeatureAccessResult,
    'showUpgradeModal'
  > => {
    if (!entitlements?.features) {
      return { hasAccess: false, requiredPlan: 'pro' };
    }

    const features = entitlements.features;
    const parts = feature.split('.') as (keyof FeatureEntitlements)[];

    // Simple boolean features
    if (parts.length === 1) {
      const value = features[parts[0]];
      if (typeof value === 'boolean') {
        return {
          hasAccess: value,
          requiredPlan: value ? undefined : 'pro',
        };
      }
    }

    // Nested features
    if (parts.length === 2) {
      const parent = features[parts[0] as keyof FeatureEntitlements] as any;
      if (parent && typeof parent === 'object') {
        const value = parent[parts[1]];
        if (typeof value === 'boolean') {
          return {
            hasAccess: value,
            requiredPlan: value ? undefined : 'pro',
          };
        }
        if (typeof value === 'number') {
          return {
            hasAccess: value > 0 || value === -1,
            limit: value === -1 ? Number.POSITIVE_INFINITY : value,
            requiredPlan: value > 0 || value === -1 ? undefined : 'pro',
          };
        }
      }
    }

    // Special cases
    switch (feature) {
      case 'recordings':
        return {
          hasAccess: features.recordings.enabled,
          limit: features.recordings.minutes_month,
          used: usageCounters?.asr_minutes_month ?? 0,
          remaining: Math.max(
            0,
            features.recordings.minutes_month -
              (usageCounters?.asr_minutes_month ?? 0),
          ),
          requiredPlan: features.recordings.enabled ? undefined : 'pro',
        };

      case 'deep_research':
        return {
          hasAccess: features.deep_research.enabled,
          limit: features.deep_research.lookups_per_run,
          requiredPlan: features.deep_research.enabled ? undefined : 'business',
        };

      case 'personas.custom':
        return {
          hasAccess: features.personas.custom,
          limit:
            features.personas.max_count === -1
              ? Number.POSITIVE_INFINITY
              : features.personas.max_count,
          used: usageCounters?.personas_created ?? 0,
          remaining:
            features.personas.max_count === -1
              ? Number.POSITIVE_INFINITY
              : Math.max(
                  0,
                  features.personas.max_count -
                    (usageCounters?.personas_created ?? 0),
                ),
          requiredPlan: features.personas.custom ? undefined : 'pro',
        };

      case 'memory':
        return {
          hasAccess: features.memory.enabled,
          limit:
            features.memory.max_memories === -1
              ? Number.POSITIVE_INFINITY
              : features.memory.max_memories,
          used: usageCounters?.memories_stored ?? 0,
          remaining:
            features.memory.max_memories === -1
              ? Number.POSITIVE_INFINITY
              : Math.max(
                  0,
                  features.memory.max_memories -
                    (usageCounters?.memories_stored ?? 0),
                ),
          requiredPlan: features.memory.enabled ? undefined : 'pro',
        };

      case 'composer.advanced':
        return {
          hasAccess: features.composer.advanced,
          requiredPlan: features.composer.advanced ? undefined : 'pro',
        };

      default:
        return { hasAccess: false, requiredPlan: 'pro' };
    }
  }, [entitlements, usageCounters, feature]);

  const result = checkAccess();

  const showUpgradeModal = useCallback(() => {
    setShouldShowUpgrade(true);
  }, []);

  return {
    ...result,
    showUpgradeModal,
  };
}

export function useComposerTypeAccess(type: string): FeatureAccessResult {
  const entitlements = useAccountStore((state) => state.entitlements);

  const hasAccess =
    entitlements?.features?.composer?.types?.includes(type) ?? false;

  return {
    hasAccess,
    requiredPlan: hasAccess ? undefined : type === 'text' ? undefined : 'pro',
    showUpgradeModal: () => {},
  };
}









