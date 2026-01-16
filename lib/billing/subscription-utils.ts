import 'server-only';

import type Stripe from 'stripe';
import { STRIPE_CONFIG } from '@/lib/server-constants';
import { notifyDoubleBilling } from './notifications';

/**
 * Check if a user has an active individual subscription
 * Returns the plan type or null if no active subscription
 * Also warns if user has multiple individual subscriptions
 */
export async function getUserIndividualSubscriptionPlan(
  stripeCustomerId: string | null | undefined,
  stripe: Stripe,
  userId?: string,
): Promise<'pro' | 'business' | null> {
  if (!stripeCustomerId) {
    return null;
  }

  try {
    const subscriptions = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: 'active',
      limit: 100, // Get all active subscriptions
    });

    const individualSubscriptions = [];

    // Check each subscription to find individual plans
    for (const subscription of subscriptions.data) {
      const priceId = subscription.items.data[0]?.price?.id;
      const isOrgBased = Boolean(subscription.metadata?.org_id);

      // Skip org-based subscriptions
      if (isOrgBased) continue;

      // Check for Pro plan
      if (
        priceId === STRIPE_CONFIG.priceIds.proMonthly ||
        priceId === STRIPE_CONFIG.priceIds.proAnnual
      ) {
        individualSubscriptions.push({ id: subscription.id, plan: 'pro' });
      }

      // Check for individual Business plan (edge case - shouldn't normally exist)
      if (
        priceId === STRIPE_CONFIG.priceIds.businessSeatMonthly ||
        priceId === STRIPE_CONFIG.priceIds.businessSeatAnnual
      ) {
        individualSubscriptions.push({ id: subscription.id, plan: 'business' });
      }
    }

    // Warn if multiple individual subscriptions found
    if (individualSubscriptions.length > 1 && userId) {
      console.warn(
        `[subscription-utils] User ${userId} has ${individualSubscriptions.length} individual subscriptions - potential double billing`,
      );
    }

    // Return the first (or best) plan found
    if (individualSubscriptions.length > 0) {
      // Prioritize business over pro if somehow both exist
      const business = individualSubscriptions.find(
        (s) => s.plan === 'business',
      );
      if (business) return 'business';

      return individualSubscriptions[0].plan as 'pro' | 'business';
    }

    return null;
  } catch (error: any) {
    // Handle customer not found (404) specifically
    if (
      error?.statusCode === 404 ||
      error?.type === 'invalid_request_error' ||
      error?.code === 'resource_missing'
    ) {
      console.warn(
        `[subscription-utils] Stripe customer ${stripeCustomerId} not found or invalid. Clearing from database.`,
      );

      // Clear invalid customer ID from database if userId provided
      if (userId) {
        try {
          const dbModule = await import('@/lib/db');
          const schemaModule = await import('@/lib/db/schema');
          const { eq } = await import('drizzle-orm');

          await dbModule.db
            .update(schemaModule.user)
            .set({ stripeCustomerId: null })
            .where(eq(schemaModule.user.id, userId));

          console.log(
            `[subscription-utils] Cleared invalid customer ID for user ${userId}`,
          );
        } catch (dbError) {
          console.error(
            '[subscription-utils] Failed to clear invalid customer ID:',
            dbError,
          );
        }
      }

      return null;
    }

    console.warn(
      '[subscription-utils] Failed to check user subscription:',
      error,
    );
    return null;
  }
}

/**
 * Cancel all individual subscriptions for a user
 * Returns the number of subscriptions cancelled
 */
export async function cancelAllUserSubscriptions(
  stripeCustomerId: string | null | undefined,
  stripe: Stripe,
  options?: {
    reason?: string;
    immediately?: boolean;
  },
): Promise<number> {
  if (!stripeCustomerId) {
    return 0;
  }

  try {
    const subscriptions = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: 'active',
      limit: 100,
    });

    let cancelledCount = 0;

    for (const subscription of subscriptions.data) {
      // Skip organization-based subscriptions (they should be cancelled via org)
      if (subscription.metadata?.org_id) {
        console.log(
          `[subscription-utils] Skipping org subscription ${subscription.id} for customer ${stripeCustomerId}`,
        );
        continue;
      }

      // Cancel the subscription
      await stripe.subscriptions.cancel(subscription.id, {
        cancellation_details: options?.reason
          ? { comment: options.reason }
          : undefined,
        ...(options?.immediately ? { prorate: true } : {}),
      });

      cancelledCount++;
      console.log(
        `[subscription-utils] Cancelled subscription ${subscription.id} for customer ${stripeCustomerId}`,
      );
    }

    return cancelledCount;
  } catch (error) {
    console.error(
      '[subscription-utils] Failed to cancel user subscriptions:',
      error,
    );
    throw error;
  }
}

/**
 * Cancel an organization's subscription
 */
export async function cancelOrgSubscription(
  stripeSubscriptionId: string | null | undefined,
  stripe: Stripe,
  options?: {
    reason?: string;
    immediately?: boolean;
  },
): Promise<boolean> {
  if (!stripeSubscriptionId) {
    return false;
  }

  try {
    await stripe.subscriptions.cancel(stripeSubscriptionId, {
      cancellation_details: options?.reason
        ? { comment: options.reason }
        : undefined,
      ...(options?.immediately ? { prorate: true } : {}),
    });

    console.log(
      `[subscription-utils] Cancelled org subscription ${stripeSubscriptionId}`,
    );
    return true;
  } catch (error) {
    // Handle case where subscription doesn't exist in Stripe
    if (
      error instanceof Error &&
      'type' in error &&
      error.type === 'StripeInvalidRequestError' &&
      'code' in error &&
      error.code === 'resource_missing'
    ) {
      console.warn(
        `[subscription-utils] Subscription ${stripeSubscriptionId} not found in Stripe (likely already deleted), continuing`,
      );
      return false;
    }

    console.error(
      '[subscription-utils] Failed to cancel org subscription:',
      error,
    );
    throw error;
  }
}

/**
 * Get ALL active subscriptions for a user (not just first match)
 */
export async function getAllUserSubscriptions(
  stripeCustomerId: string | null | undefined,
  stripe: Stripe,
): Promise<
  Array<{
    id: string;
    plan: 'pro' | 'business' | 'unknown';
    priceId: string;
    isOrgBased: boolean;
  }>
> {
  if (!stripeCustomerId) {
    return [];
  }

  try {
    const subscriptions = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: 'active',
      limit: 100,
    });

    return subscriptions.data.map((subscription) => {
      const priceId = subscription.items.data[0]?.price?.id || '';
      const isOrgBased = Boolean(subscription.metadata?.org_id);

      let plan: 'pro' | 'business' | 'unknown' = 'unknown';

      if (
        priceId === STRIPE_CONFIG.priceIds.proMonthly ||
        priceId === STRIPE_CONFIG.priceIds.proAnnual
      ) {
        plan = 'pro';
      } else if (
        priceId === STRIPE_CONFIG.priceIds.businessSeatMonthly ||
        priceId === STRIPE_CONFIG.priceIds.businessSeatAnnual
      ) {
        plan = 'business';
      }

      return {
        id: subscription.id,
        plan,
        priceId,
        isOrgBased,
      };
    });
  } catch (error) {
    console.warn(
      '[subscription-utils] Failed to get all subscriptions:',
      error,
    );
    return [];
  }
}

/**
 * Warn if user has multiple active subscriptions (potential double billing)
 */
export async function warnMultipleSubscriptions(
  userId: string,
  subscriptions: Array<{ id: string; plan: string; isOrgBased: boolean }>,
): Promise<void> {
  // Filter out org-based subscriptions
  const individualSubscriptions = subscriptions.filter(
    (sub) => !sub.isOrgBased,
  );

  if (individualSubscriptions.length > 1) {
    console.warn(
      `[subscription-utils] User ${userId} has ${individualSubscriptions.length} active individual subscriptions:`,
      individualSubscriptions.map((s) => `${s.plan} (${s.id})`).join(', '),
    );
    console.warn(
      '[subscription-utils] User may be experiencing double billing. Sending notification.',
    );

    // Send notification to user about double billing
    try {
      await notifyDoubleBilling(
        userId,
        individualSubscriptions.map((s) => ({
          plan: s.plan,
          amount: s.plan === 'business' ? 99 : 29, // Approximate amounts
        })),
      );
      console.log(
        `[subscription-utils] Sent double billing notification to user ${userId}`,
      );
    } catch (notifyError) {
      console.error(
        '[subscription-utils] Failed to send double billing notification:',
        notifyError,
      );
    }
  }
}

/**
 * Get details about a user's active subscriptions
 */
export async function getUserSubscriptionDetails(
  stripeCustomerId: string | null | undefined,
  stripe: Stripe,
): Promise<{
  hasProSubscription: boolean;
  hasBusinessSubscription: boolean;
  subscriptionIds: string[];
  totalActiveSubscriptions: number;
  individualSubscriptionCount: number;
}> {
  if (!stripeCustomerId) {
    return {
      hasProSubscription: false,
      hasBusinessSubscription: false,
      subscriptionIds: [],
      totalActiveSubscriptions: 0,
      individualSubscriptionCount: 0,
    };
  }

  try {
    const subscriptions = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: 'active',
      limit: 100,
    });

    const details = {
      hasProSubscription: false,
      hasBusinessSubscription: false,
      subscriptionIds: subscriptions.data.map((sub) => sub.id),
      totalActiveSubscriptions: subscriptions.data.length,
      individualSubscriptionCount: 0,
    };

    for (const subscription of subscriptions.data) {
      const priceId = subscription.items.data[0]?.price?.id;
      const isOrgBased = Boolean(subscription.metadata?.org_id);

      if (!isOrgBased) {
        details.individualSubscriptionCount++;
      }

      if (
        priceId === STRIPE_CONFIG.priceIds.proMonthly ||
        priceId === STRIPE_CONFIG.priceIds.proAnnual
      ) {
        details.hasProSubscription = true;
      }

      if (
        (priceId === STRIPE_CONFIG.priceIds.businessSeatMonthly ||
          priceId === STRIPE_CONFIG.priceIds.businessSeatAnnual) &&
        !subscription.metadata?.org_id
      ) {
        details.hasBusinessSubscription = true;
      }
    }

    return details;
  } catch (error) {
    console.warn(
      '[subscription-utils] Failed to get subscription details:',
      error,
    );
    return {
      hasProSubscription: false,
      hasBusinessSubscription: false,
      subscriptionIds: [],
      totalActiveSubscriptions: 0,
      individualSubscriptionCount: 0,
    };
  }
}
