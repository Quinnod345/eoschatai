import 'server-only';

import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { eq } from 'drizzle-orm';

import { auth } from '@/app/(auth)/auth';
import {
  getUserWithOrg,
  listOrgUserIds,
  findUserByStripeCustomerId,
  updateUserPlan,
  updateOrgSubscription,
  resetOrgPlanToFree,
  resetUserPlanToFree,
} from '@/lib/db/users';
import { db } from '@/lib/db';
import { webhookEvent, user } from '@/lib/db/schema';
import {
  broadcastEntitlementsUpdated,
  getUserEntitlements,
  invalidateUserEntitlementsCache,
} from '@/lib/entitlements';
import { STRIPE_CONFIG } from '@/lib/server-constants';
import { buildAppUrl } from '@/lib/utils/app-url';
import { resolvePriceId } from '@/lib/stripe/pricing';
import type { BillingInterval } from '@/lib/stripe/pricing';
import { getStripeClient } from '@/lib/stripe/client';
import { trackSubscriptionActivated } from '@/lib/analytics';
import { updateOrgSeatCount } from '@/lib/organizations/seat-enforcement';

export type CheckoutRequestPayload = {
  plan: 'pro' | 'business';
  billing: BillingInterval;
  seats?: number;
  orgId?: string;
};

const ensureStripe = (): Stripe => {
  const stripe = getStripeClient();
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  return stripe;
};

const ensureAuthenticatedUser = async () => {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  return session.user.id;
};

const normalizeSeatCount = (value: unknown, fallback = 1): number => {
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.min(10_000, Math.max(1, Math.floor(parsed)));
  }

  return fallback;
};

const recomputeEntitlementsForUsers = async (userIds: string[]) => {
  for (const userId of userIds) {
    await getUserEntitlements(userId);
    await invalidateUserEntitlementsCache(userId);
    await broadcastEntitlementsUpdated(userId);
  }
};

const recomputeUserEntitlements = async (userId: string) => {
  // CRITICAL: Invalidate cache FIRST, then fetch fresh entitlements
  await invalidateUserEntitlementsCache(userId);
  await getUserEntitlements(userId); // This will recompute with new plan
  await broadcastEntitlementsUpdated(userId);
};

export const createCheckoutSession = async (
  payload: CheckoutRequestPayload,
) => {
  const userId = await ensureAuthenticatedUser();
  const stripe = ensureStripe();

  const record = await getUserWithOrg(userId);
  if (!record) {
    throw new Error('User not found');
  }

  // Check if user's organization already has a paid plan
  if (record.org && record.org.plan !== 'free') {
    throw new Error(
      `Your organization already has a ${record.org.plan} subscription`,
    );
  }

  // NEW: Check if org already has an active Stripe subscription
  // This prevents creating duplicate subscriptions (e.g. both monthly and annual)
  if (record.org?.stripeSubscriptionId && payload.plan === 'business') {
    try {
      const existingSub = await stripe.subscriptions.retrieve(
        record.org.stripeSubscriptionId,
      );

      if (['active', 'trialing', 'past_due'].includes(existingSub.status)) {
        throw new Error(
          'Organization already has an active subscription. Please manage it in the billing portal.',
        );
      }
    } catch (error: any) {
      // If subscription doesn't exist in Stripe, continue (it might be stale in DB)
      if (error?.statusCode !== 404) {
        console.warn('[stripe] Failed to check existing subscription:', error);
      }
    }
  }

  // Business plans require an organization
  if (payload.plan === 'business') {
    if (!payload.orgId && !record.org?.id) {
      throw new Error('Business plan requires an organization');
    }

    // NEW: Verify user is org owner (only owners can manage subscriptions)
    if (record.org && record.org.ownerId !== userId) {
      throw new Error('Only organization owners can manage subscriptions');
    }

    // Verify the user belongs to the organization they're trying to subscribe
    if (payload.orgId && record.user.orgId !== payload.orgId) {
      throw new Error('You are not a member of this organization');
    }
  }

  const priceId = resolvePriceId(payload.plan, payload.billing);
  if (!priceId) {
    throw new Error(
      `Stripe price missing for ${payload.plan} ${payload.billing}`,
    );
  }

  const successUrl = buildAppUrl('/chat', { billing: 'success' });
  const cancelUrl = buildAppUrl('/chat', { billing: 'cancelled' });

  const seats =
    payload.plan === 'business'
      ? normalizeSeatCount(payload.seats, record.org?.seatCount ?? 1)
      : 1;

  const metadata: Record<string, string> = {
    user_id: record.user.id,
    plan: payload.plan,
    billing: payload.billing,
  };

  if (record.org?.id) {
    metadata.org_id = record.org.id;
  }

  if (payload.plan === 'business') {
    metadata.seats = seats.toString();
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    // Use customer if exists, otherwise use customer_email
    ...(record.user.stripeCustomerId
      ? { customer: record.user.stripeCustomerId }
      : { customer_email: record.user.email }),
    client_reference_id:
      payload.plan === 'business'
        ? (record.org?.id ?? record.user.id)
        : record.user.id,
    subscription_data: {
      metadata,
    },
    line_items: [
      {
        price: priceId,
        quantity: seats,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  if (!session.url) {
    throw new Error('Stripe did not return a checkout URL');
  }

  return session.url;
};

export const createCustomerPortalSession = async () => {
  const userId = await ensureAuthenticatedUser();
  const stripe = ensureStripe();

  const record = await getUserWithOrg(userId);
  if (!record?.user.stripeCustomerId) {
    throw new Error('Stripe customer not found');
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: record.user.stripeCustomerId,
    return_url: buildAppUrl('/chat', { billing: 'return' }),
  });

  if (!session.url) {
    throw new Error('Stripe portal URL missing');
  }

  return session.url;
};

type PriceSummary = {
  id: string;
  interval: BillingInterval;
  plan: 'pro' | 'business';
  unitAmount: number | null;
  currency: string | null;
};

export const getPriceSummaries = async (): Promise<PriceSummary[]> => {
  const stripe = ensureStripe();
  const pairs: Array<{
    plan: 'pro' | 'business';
    interval: BillingInterval;
    priceId: string | null;
  }> = [
    {
      plan: 'pro',
      interval: 'monthly',
      priceId: resolvePriceId('pro', 'monthly'),
    },
    {
      plan: 'pro',
      interval: 'annual',
      priceId: resolvePriceId('pro', 'annual'),
    },
    {
      plan: 'business',
      interval: 'monthly',
      priceId: resolvePriceId('business', 'monthly'),
    },
    {
      plan: 'business',
      interval: 'annual',
      priceId: resolvePriceId('business', 'annual'),
    },
  ];

  const results: PriceSummary[] = [];

  for (const pair of pairs) {
    if (!pair.priceId) continue;
    const price = await stripe.prices.retrieve(pair.priceId);
    results.push({
      id: price.id,
      interval: pair.interval,
      plan: pair.plan,
      unitAmount: price.unit_amount,
      currency: price.currency,
    });
  }

  return results;
};

const markWebhookProcessed = async (eventId: string) => {
  await db
    .insert(webhookEvent)
    .values({ eventId, processedAt: new Date() })
    .onConflictDoNothing({ target: webhookEvent.eventId });
};

const hasWebhookBeenProcessed = async (eventId: string): Promise<boolean> => {
  const [record] = await db
    .select({ id: webhookEvent.id })
    .from(webhookEvent)
    .where(eq(webhookEvent.eventId, eventId))
    .limit(1);

  return Boolean(record);
};

type SubscriptionContext = {
  plan: 'pro' | 'business' | 'free';
  userId?: string;
  orgId?: string;
  seatCount?: number;
};

const deriveSubscriptionContext = (
  subscription: Stripe.Subscription,
): SubscriptionContext => {
  const metadataPlan = subscription.metadata?.plan as
    | SubscriptionContext['plan']
    | undefined;

  if (metadataPlan) {
    return {
      plan: metadataPlan,
      userId: subscription.metadata?.user_id,
      orgId: subscription.metadata?.org_id,
      seatCount: subscription.metadata?.seats
        ? Number(subscription.metadata.seats)
        : undefined,
    };
  }

  const price = subscription.items.data[0]?.price;
  const priceId = price?.id;

  if (!priceId) {
    return { plan: 'free' };
  }

  if (
    priceId === STRIPE_CONFIG.priceIds.proMonthly ||
    priceId === STRIPE_CONFIG.priceIds.proAnnual
  ) {
    return { plan: 'pro', userId: subscription.metadata?.user_id };
  }

  if (
    priceId === STRIPE_CONFIG.priceIds.businessSeatMonthly ||
    priceId === STRIPE_CONFIG.priceIds.businessSeatAnnual
  ) {
    return {
      plan: 'business',
      orgId: subscription.metadata?.org_id,
      userId: subscription.metadata?.user_id,
      seatCount: subscription.items.data[0]?.quantity ?? undefined,
    };
  }

  return { plan: 'free' };
};

const applyProSubscription = async (
  subscription: Stripe.Subscription,
  context: SubscriptionContext,
) => {
  const userId = context.userId;
  if (!userId) {
    const customerId = subscription.customer as string | undefined;
    if (!customerId) return;
    const userRecord = await findUserByStripeCustomerId(customerId);
    if (!userRecord) return;
    await updateUserPlan(userRecord.id, 'pro', customerId);
    await recomputeUserEntitlements(userRecord.id);
    // Reset daily usage counters when upgrading to premium
    const { resetUserDailyUsageCounters } = await import('@/lib/entitlements');
    await resetUserDailyUsageCounters(userRecord.id);
    await trackSubscriptionActivated({
      plan: 'pro',
      user_id: userRecord.id,
      org_id: userRecord.orgId ?? undefined,
    });
    return;
  }

  await updateUserPlan(
    userId,
    'pro',
    subscription.customer as string | undefined,
  );
  await recomputeUserEntitlements(userId);
  // Reset daily usage counters when upgrading to premium
  const { resetUserDailyUsageCounters } = await import('@/lib/entitlements');
  await resetUserDailyUsageCounters(userId);
  await trackSubscriptionActivated({
    plan: 'pro',
    user_id: userId,
    org_id: context.orgId,
  });
};

const applyBusinessSubscription = async (
  subscription: Stripe.Subscription,
  context: SubscriptionContext,
) => {
  const orgId = context.orgId;
  if (!orgId) {
    // Fallback: If user purchased Business without an org, apply Business to the user
    const customerId = subscription.customer as string | undefined;
    const userId = context.userId;

    let resolvedUserId = userId;
    if (!resolvedUserId && customerId) {
      const userRecord = await findUserByStripeCustomerId(customerId);
      resolvedUserId = userRecord?.id;
    }

    if (resolvedUserId) {
      await updateUserPlan(resolvedUserId, 'business', customerId);
      await recomputeUserEntitlements(resolvedUserId);
      // Reset daily usage counters when upgrading to premium
      const { resetUserDailyUsageCounters } = await import('@/lib/entitlements');
      await resetUserDailyUsageCounters(resolvedUserId);
      await trackSubscriptionActivated({
        plan: 'business',
        user_id: resolvedUserId,
      });
    }
    return;
  }

  const seatCount = normalizeSeatCount(
    context.seatCount ?? subscription.items.data[0]?.quantity,
  );

  await updateOrgSubscription(orgId, 'business', seatCount, subscription.id);

  // Enforce seat count limits
  try {
    await updateOrgSeatCount(orgId, seatCount);
  } catch (error) {
    console.error('[stripe] Failed to update org seat count:', error);
    // Continue processing even if seat enforcement fails
  }

  const memberIds = await listOrgUserIds(orgId);

  for (const memberId of memberIds) {
    await updateUserPlan(memberId, 'business');
  }

  await recomputeEntitlementsForUsers(memberIds);
  
  // Reset daily usage counters for all org members when upgrading to premium
  const { resetUserDailyUsageCounters } = await import('@/lib/entitlements');
  for (const memberId of memberIds) {
    await resetUserDailyUsageCounters(memberId);
  }
  
  await trackSubscriptionActivated({
    plan: 'business',
    org_id: orgId,
    seats: seatCount,
  });
};

const clearBusinessSubscription = async (context: SubscriptionContext) => {
  if (!context.orgId) return;
  await resetOrgPlanToFree(context.orgId);
  const memberIds = await listOrgUserIds(context.orgId);
  await recomputeEntitlementsForUsers(memberIds);
};

const clearProSubscription = async (
  context: SubscriptionContext,
  subscription: Stripe.Subscription,
) => {
  const customerId = subscription.customer as string | undefined;
  const userId = context.userId;
  if (userId) {
    await resetUserPlanToFree(userId);
    await recomputeUserEntitlements(userId);
    return;
  }

  if (!customerId) return;

  const userRecord = await findUserByStripeCustomerId(customerId);
  if (!userRecord) return;
  await resetUserPlanToFree(userRecord.id);
  await recomputeUserEntitlements(userRecord.id);
};

const processPaymentFailed = async (event: Stripe.Event) => {
  const invoice = event.data.object as any; // Stripe.Invoice with expanded fields

  // Start grace period on first failure
  if (invoice.attempt_count && invoice.attempt_count === 1) {
    console.log(
      `[stripe] Payment failed for invoice ${invoice.id}, attempt 1/4. Starting grace period.`,
    );

    const invoiceSub = invoice.subscription as
      | string
      | Stripe.Subscription
      | null;
    if (invoiceSub) {
      const subscriptionId =
        typeof invoiceSub === 'string' ? invoiceSub : invoiceSub.id;

      try {
        const stripe = getStripeClient();
        if (!stripe) return;

        const subscription =
          await stripe.subscriptions.retrieve(subscriptionId);
        const context = deriveSubscriptionContext(subscription);

        // Start grace period
        const { startGracePeriod } = await import('./grace-period');

        if (context.orgId) {
          await startGracePeriod(
            context.orgId,
            'org',
            'payment_failed',
            subscriptionId,
          );
        } else if (context.userId) {
          await startGracePeriod(
            context.userId,
            'user',
            'payment_failed',
            subscriptionId,
          );
        }
      } catch (error) {
        console.error('[stripe] Failed to start grace period:', error);
      }
    }
    return;
  }

  // Only downgrade after final failure (Stripe typically retries 3-4 times)
  // Don't downgrade on first failure to avoid false positives
  if (invoice.attempt_count && invoice.attempt_count < 4) {
    console.log(
      `[stripe] Payment failed for invoice ${invoice.id}, attempt ${invoice.attempt_count}/4. Will retry, not downgrading yet.`,
    );
    return;
  }

  console.log(
    `[stripe] Payment failed after ${invoice.attempt_count} attempts for invoice ${invoice.id}. Downgrading subscription.`,
  );

  // Get the subscription and process as deleted
  const invoiceSub = invoice.subscription as
    | string
    | Stripe.Subscription
    | null;
  if (invoiceSub) {
    const subscriptionId =
      typeof invoiceSub === 'string' ? invoiceSub : invoiceSub.id;

    try {
      const stripe = getStripeClient();
      if (!stripe) return;

      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const context = deriveSubscriptionContext(subscription);

      if (context.plan === 'business') {
        await clearBusinessSubscription(context);
      } else {
        await clearProSubscription(context, subscription);
      }

      // End grace period (if any)
      const { endGracePeriod } = await import('./grace-period');
      if (context.orgId) {
        await endGracePeriod(context.orgId, 'org');
      } else if (context.userId) {
        await endGracePeriod(context.userId, 'user');
      }
    } catch (error) {
      console.error('[stripe] Failed to process payment failure:', error);
    }
  }
};

const processSubscriptionEvent = async (event: Stripe.Event) => {
  const subscription = event.data.object as Stripe.Subscription;
  const context = deriveSubscriptionContext(subscription);

  // Use Redis lock to prevent concurrent processing of same subscription
  const { getRedisClient } = await import('@/lib/redis/client');
  const redis = getRedisClient();
  const lockKey = `subscription:lock:${subscription.id}`;
  let acquiredLock = false;

  if (redis) {
    try {
      // Try to acquire lock with 30 second expiry
      const lock = await redis.set(lockKey, event.id, {
        nx: true, // Only set if doesn't exist
        ex: 30, // Expire after 30 seconds
      });

      if (!lock) {
        // Another webhook is processing this subscription
        console.log(
          `[stripe] Subscription ${subscription.id} is locked by another webhook, skipping`,
        );
        return;
      }
      acquiredLock = true;
    } catch (error) {
      console.warn(
        '[stripe] Failed to acquire subscription lock, processing anyway:',
        error,
      );
      // Continue without lock if Redis fails
    }
  }

  try {
    // Handle subscription deletions
    if (event.type === 'customer.subscription.deleted') {
      if (context.plan === 'business') {
        await clearBusinessSubscription(context);
      } else {
        await clearProSubscription(context, subscription);
      }
      return;
    }

    // Handle subscription pauses (downgrade access)
    if (event.type === 'customer.subscription.paused') {
      console.log(
        `[stripe] Subscription ${subscription.id} paused, downgrading access`,
      );
      if (context.plan === 'business') {
        await clearBusinessSubscription(context);
      } else {
        await clearProSubscription(context, subscription);
      }
      return;
    }

    // Handle subscription resumes (restore access)
    if (event.type === 'customer.subscription.resumed') {
      console.log(
        `[stripe] Subscription ${subscription.id} resumed, restoring access`,
      );
      if (context.plan === 'business') {
        await applyBusinessSubscription(subscription, context);
      } else if (context.plan === 'pro') {
        await applyProSubscription(subscription, context);
      }
      return;
    }

    // Check subscription status and handle edge cases
    const status = subscription.status;

    // Handle incomplete subscriptions (first payment not confirmed)
    if (status === 'incomplete' || status === 'incomplete_expired') {
      console.log(
        `[stripe] Subscription ${subscription.id} is ${status}. First payment not completed, not granting access.`,
      );
      // Don't grant access for incomplete subscriptions
      return;
    }

    // Handle canceled subscriptions (shouldn't reach here, but safety check)
    if (status === 'canceled') {
      console.log(`[stripe] Subscription ${subscription.id} is canceled`);
      if (context.plan === 'business') {
        await clearBusinessSubscription(context);
      } else {
        await clearProSubscription(context, subscription);
      }
      return;
    }

    // Handle past_due and unpaid status (grace period - keep access but warn)
    if (['past_due', 'unpaid'].includes(status)) {
      console.warn(
        `[stripe] Subscription ${subscription.id} is ${status}. Keeping access during grace period.`,
      );
      // Keep access during grace period (Stripe will auto-cancel after retries fail)
      // Continue to apply subscription below
    }

    // Handle trialing status (grant access during trial)
    if (status === 'trialing') {
      console.log(
        `[stripe] Subscription ${subscription.id} is in trial period. Granting access.`,
      );
      // Grant access during trial
    }

    // For created/updated/trialing/past_due events, apply the subscription
    // Only apply if status allows access
    if (['active', 'trialing', 'past_due', 'unpaid'].includes(status)) {
      if (context.plan === 'business') {
        await applyBusinessSubscription(subscription, context);
      } else if (context.plan === 'pro') {
        await applyProSubscription(subscription, context);
      }
    } else {
      console.warn(
        `[stripe] Subscription ${subscription.id} has unexpected status: ${status}. Not applying.`,
      );
    }
  } finally {
    // Release the lock
    if (redis && acquiredLock) {
      try {
        await redis.del(lockKey);
      } catch (error) {
        console.warn('[stripe] Failed to release subscription lock:', error);
      }
    }
  }
};

const processCheckoutCompleted = async (session: Stripe.Checkout.Session) => {
  const customerId = session.customer as string | null;
  const userId = session.metadata?.user_id;
  if (!customerId || !userId) return;

  const plan =
    (session.metadata?.plan as 'pro' | 'business' | undefined) || 'pro';
  await updateUserPlan(userId, plan, customerId);
  await recomputeUserEntitlements(userId);
  // Reset daily usage counters when purchasing a subscription
  const { resetUserDailyUsageCounters } = await import('@/lib/entitlements');
  await resetUserDailyUsageCounters(userId);
  await trackSubscriptionActivated({ plan, user_id: userId });
};

export const constructStripeEvent = async (
  request: Request,
): Promise<Stripe.Event | null> => {
  const stripe = ensureStripe();
  const headerList = await headers();
  const signature = headerList.get('stripe-signature');

  if (!signature || !STRIPE_CONFIG.webhookSecret) {
    throw new Error('Stripe webhook secret missing');
  }

  const payload = await request.text();

  return stripe.webhooks.constructEvent(
    payload,
    signature,
    STRIPE_CONFIG.webhookSecret,
  );
};

export const handleStripeWebhook = async (event: Stripe.Event) => {
  if (await hasWebhookBeenProcessed(event.id)) {
    return NextResponse.json({ received: true });
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      await processCheckoutCompleted(
        event.data.object as Stripe.Checkout.Session,
      );
      break;
    }
    case 'checkout.session.expired': {
      // Log expired checkout sessions for debugging
      const session = event.data.object as Stripe.Checkout.Session;
      console.log(`[stripe] Checkout session expired: ${session.id}`);
      break;
    }
    case 'customer.subscription.created':
    case 'customer.subscription.deleted':
    case 'customer.subscription.paused':
    case 'customer.subscription.resumed': {
      await processSubscriptionEvent(event);
      break;
    }
    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;
      const previous = (event.data as any).previous_attributes as any;

      // Check if quantity changed (seat count for Business subscriptions)
      if (previous?.items?.data?.[0]?.quantity) {
        const oldQty = previous.items.data[0].quantity;
        const newQty = subscription.items.data[0]?.quantity;

        if (oldQty !== newQty && newQty) {
          // Get org ID from metadata or fallback to database lookup
          let orgId = subscription.metadata?.org_id;

          if (!orgId) {
            // Fallback: Find org by stripeSubscriptionId
            console.warn(
              `[stripe] Subscription ${subscription.id} missing org_id metadata, looking up in database`,
            );
            try {
              const schema = await import('@/lib/db/schema');
              const [orgRecord] = await db
                .select({ id: schema.org.id })
                .from(schema.org)
                .where(eq(schema.org.stripeSubscriptionId, subscription.id));

              if (orgRecord) {
                orgId = orgRecord.id;
                console.log(
                  `[stripe] Found org ${orgId} for subscription ${subscription.id}`,
                );
              }
            } catch (lookupError) {
              console.error(
                '[stripe] Failed to lookup org for subscription:',
                lookupError,
              );
            }
          }

          if (orgId) {
            console.log(
              `[stripe] Seat count changed from ${oldQty} to ${newQty} for org ${orgId}`,
            );

            try {
              await updateOrgSeatCount(orgId, newQty);
            } catch (error) {
              console.error(
                '[stripe] Failed to update org seat count from webhook:',
                error,
              );
              // Continue processing other updates
            }
          } else {
            console.error(
              `[stripe] Cannot find org for subscription ${subscription.id}, skipping seat count update`,
            );
          }
        }
      }

      // Process subscription changes (plan updates, etc.)
      await processSubscriptionEvent(event);
      break;
    }
    case 'invoice.payment_failed': {
      await processPaymentFailed(event);
      break;
    }
    case 'payment_intent.requires_action': {
      // User needs to complete 3D Secure authentication
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      console.log(
        `[stripe] Payment ${paymentIntent.id} requires action (3D Secure). User must complete authentication.`,
      );
      // TODO: Send notification to user
      break;
    }
    case 'payment_intent.succeeded': {
      // Payment confirmed after 3D Secure (or immediate success)
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      console.log(`[stripe] Payment ${paymentIntent.id} succeeded`);
      // Access will be granted via subscription.created/updated event
      break;
    }
    case 'customer.updated': {
      // Handle customer email changes from Stripe Customer Portal
      const customer = event.data.object as Stripe.Customer;
      const previous = (event.data as any).previous_attributes as any;

      if (
        previous?.email &&
        customer.email &&
        customer.email !== previous.email
      ) {
        console.log(
          `[stripe] Customer ${customer.id} email changed from ${previous.email} to ${customer.email}`,
        );

        try {
          // Find user by stripeCustomerId
          const userRecord = await findUserByStripeCustomerId(customer.id);

          if (userRecord) {
            await db
              .update(user)
              .set({ email: customer.email })
              .where(eq(user.id, userRecord.id));

            console.log(
              `[stripe] Synced email change to user ${userRecord.id}: ${customer.email}`,
            );
          }
        } catch (error) {
          console.error(
            '[stripe] Failed to sync customer email change:',
            error,
          );
        }
      }
      break;
    }
    case 'customer.subscription.trial_will_end': {
      // Subscription trial ending in 3 days
      const subscription = event.data.object as Stripe.Subscription;
      console.log(
        `[stripe] Trial ending soon for subscription ${subscription.id}. User should add payment method.`,
      );

      // Get user/org from subscription metadata
      const userId = subscription.metadata?.user_id;
      const orgId = subscription.metadata?.org_id;

      if (userId) {
        console.log(
          `[stripe] Notifying user ${userId} that trial ends in 3 days`,
        );

        // Send notification
        const { notifyTrialEnding } = await import('./notifications');
        const hasPaymentMethod = subscription.default_payment_method !== null;
        await notifyTrialEnding(userId, 3, hasPaymentMethod);
      }

      if (orgId) {
        console.log(
          `[stripe] Notifying org ${orgId} owner that trial ends in 3 days`,
        );

        // Get org owner and notify
        const schema = await import('@/lib/db/schema');
        const [org] = await db
          .select({ ownerId: schema.org.ownerId })
          .from(schema.org)
          .where(eq(schema.org.id, orgId));

        if (org?.ownerId) {
          const { notifyTrialEnding } = await import('./notifications');
          const hasPaymentMethod = subscription.default_payment_method !== null;
          await notifyTrialEnding(org.ownerId, 3, hasPaymentMethod);
        }
      }

      break;
    }
    case 'charge.refunded': {
      // Handle refunds - may need to cancel subscription
      const charge = event.data.object as any; // Stripe.Charge with expanded fields
      console.log(`[stripe] Charge ${charge.id} refunded`);

      // Check if this is a full refund
      const refunded = charge.amount_refunded;
      const total = charge.amount;

      if (refunded === total) {
        console.log(
          `[stripe] Full refund detected for charge ${charge.id}. Checking associated subscription.`,
        );

        // If there's an invoice associated, find the subscription
        const chargeInvoice = charge.invoice as string | undefined;
        if (chargeInvoice) {
          try {
            const invoiceId = chargeInvoice;
            if (!invoiceId) {
              console.warn('[stripe] Invoice ID is undefined, skipping');
              break;
            }
            const invoice = (await ensureStripe().invoices.retrieve(
              invoiceId,
            )) as any;

            const invSub = invoice.subscription as
              | string
              | Stripe.Subscription
              | null;
            if (invSub) {
              const subscriptionId =
                typeof invSub === 'string' ? invSub : invSub.id;

              console.log(
                `[stripe] Refund for subscription ${subscriptionId}. Consider canceling subscription.`,
              );

              // Get subscription and process as deleted
              const subscription =
                await ensureStripe().subscriptions.retrieve(subscriptionId);
              const context = deriveSubscriptionContext(subscription);

              // Cancel subscription after refund
              if (context.plan === 'business') {
                await clearBusinessSubscription(context);
              } else {
                await clearProSubscription(context, subscription);
              }

              console.log(
                `[stripe] Cancelled subscription ${subscriptionId} due to full refund`,
              );
            }
          } catch (error) {
            console.error(
              '[stripe] Failed to process refund for subscription:',
              error,
            );
          }
        }
      } else {
        console.log(
          `[stripe] Partial refund detected (${refunded}/${total}). Keeping subscription active.`,
        );
      }
      break;
    }
    default:
      break;
  }

  await markWebhookProcessed(event.id);

  return NextResponse.json({ received: true });
};
