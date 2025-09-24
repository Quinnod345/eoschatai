import 'server-only';

import type { PlanType } from '@/lib/db/schema';
import { STRIPE_CONFIG } from '@/lib/server-constants';

export type BillingInterval = 'monthly' | 'annual';

export type PriceMapKey = `${PlanType}:${BillingInterval}`;

export const priceMap: Record<PriceMapKey, string | undefined> = {
  'pro:monthly': STRIPE_CONFIG.priceIds.proMonthly || undefined,
  'pro:annual': STRIPE_CONFIG.priceIds.proAnnual || undefined,
  'business:monthly': STRIPE_CONFIG.priceIds.businessSeatMonthly || undefined,
  'business:annual': STRIPE_CONFIG.priceIds.businessSeatAnnual || undefined,
  'free:monthly': undefined,
  'free:annual': undefined,
};

export const resolvePriceId = (
  plan: PlanType,
  billing: BillingInterval,
): string | null => {
  const key: PriceMapKey = `${plan}:${billing}`;
  return priceMap[key] ?? null;
};
