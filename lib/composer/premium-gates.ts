/**
 * Premium feature gates for composer system
 */

import type { PlanType } from '@/lib/db/schema';
import type { NormalizedEntitlements } from '@/lib/entitlements';

export interface PremiumFeature {
  name: string;
  requiredPlan: 'pro' | 'business';
  description: string;
  upgradeMessage: string;
}

export const COMPOSER_PREMIUM_FEATURES = {
  SHARE_DOCUMENTS: {
    name: 'Share Documents',
    requiredPlan: 'business' as const,
    description: 'Share composer documents with your team',
    upgradeMessage:
      'Upgrade to Business to share documents with your organization',
  },
  EXPORT_PDF: {
    name: 'Export PDF',
    requiredPlan: 'pro' as const,
    description: 'Export documents as PDF files',
    upgradeMessage: 'Upgrade to Pro or Business to export as PDF',
  },
  EXPORT_DOCX: {
    name: 'Export DOCX',
    requiredPlan: 'pro' as const,
    description: 'Export documents as Word files',
    upgradeMessage: 'Upgrade to Pro or Business to export as DOCX',
  },
  VERSION_HISTORY: {
    name: 'Version History',
    requiredPlan: 'pro' as const,
    description: 'Access full document version history',
    upgradeMessage: 'Upgrade to Pro or Business for version history',
  },
  ADVANCED_AI: {
    name: 'Advanced AI Generation',
    requiredPlan: 'business' as const,
    description: 'Use advanced AI models for document generation',
    upgradeMessage: 'Upgrade to Business for advanced AI features',
  },
  UNLIMITED_DOCUMENTS: {
    name: 'Unlimited Documents',
    requiredPlan: 'pro' as const,
    description: 'Create unlimited composer documents',
    upgradeMessage: 'Upgrade to Pro or Business for unlimited documents',
  },
  COLLABORATION_FEATURES: {
    name: 'Real-time Collaboration',
    requiredPlan: 'business' as const,
    description: 'Collaborate on documents in real-time',
    upgradeMessage: 'Upgrade to Business for real-time collaboration features',
  },
} as const;

export type ComposerPremiumFeature = keyof typeof COMPOSER_PREMIUM_FEATURES;

/**
 * Check if user has access to a premium feature
 */
export function hasFeatureAccess(
  feature: ComposerPremiumFeature,
  userPlan: PlanType,
): boolean {
  const featureConfig = COMPOSER_PREMIUM_FEATURES[feature];
  const requiredPlan = featureConfig.requiredPlan;

  // Business includes all features
  if (userPlan === 'business') return true;

  // Pro includes pro features
  if (userPlan === 'pro' && requiredPlan === 'pro') return true;

  // Free has no premium features
  return false;
}

/**
 * Check if user can share documents (business only)
 */
export function canShareDocuments(
  entitlements: NormalizedEntitlements,
  userPlan: PlanType,
): boolean {
  return userPlan === 'business';
}

/**
 * Check if user can export documents
 */
export function canExportDocuments(
  entitlements: NormalizedEntitlements,
  userPlan: PlanType,
): boolean {
  return entitlements.features.export === true;
}

/**
 * Check if user has reached document creation limit
 */
export function canCreateDocument(
  currentCount: number,
  userPlan: PlanType,
): {
  allowed: boolean;
  limit: number;
  reason?: string;
} {
  const limits: Record<PlanType, number> = {
    free: 5,
    pro: -1, // unlimited
    business: -1, // unlimited
  };

  const limit = limits[userPlan];

  if (limit === -1) {
    return { allowed: true, limit: -1 };
  }

  const allowed = currentCount < limit;

  return {
    allowed,
    limit,
    reason: allowed
      ? undefined
      : `You've reached the limit of ${limit} documents on the ${userPlan} plan`,
  };
}

/**
 * Get upgrade message for a blocked feature
 */
export function getUpgradeMessage(feature: ComposerPremiumFeature): string {
  return COMPOSER_PREMIUM_FEATURES[feature].upgradeMessage;
}

/**
 * Get plan badge display
 */
export function getPlanBadge(plan: PlanType): {
  label: string;
  color: string;
} {
  switch (plan) {
    case 'business':
      return { label: 'Business', color: 'blue' };
    case 'pro':
      return { label: 'Pro', color: 'purple' };
    case 'free':
    default:
      return { label: 'Free', color: 'gray' };
  }
}

/**
 * AI Generation limits by plan
 */
export const AI_GENERATION_LIMITS = {
  free: {
    maxTokens: 2000,
    timeout: 30000, // 30 seconds
    retries: 1,
  },
  pro: {
    maxTokens: 8000,
    timeout: 60000, // 60 seconds
    retries: 2,
  },
  business: {
    maxTokens: 16000,
    timeout: 120000, // 120 seconds
    retries: 3,
  },
} as const;

/**
 * Get AI generation config for user plan
 */
export function getAIGenerationConfig(userPlan: PlanType) {
  return AI_GENERATION_LIMITS[userPlan] || AI_GENERATION_LIMITS.free;
}


