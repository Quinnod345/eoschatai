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
import { webhookEvent } from '@/lib/db/schema';
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
  await getUserEntitlements(userId);
  await invalidateUserEntitlementsCache(userId);
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

  // Business plans require an organization
  if (payload.plan === 'business') {
    if (!payload.orgId && !record.org?.id) {
      throw new Error('Business plan requires an organization');
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

const processSubscriptionEvent = async (event: Stripe.Event) => {
  const subscription = event.data.object as Stripe.Subscription;
  const context = deriveSubscriptionContext(subscription);

  if (event.type === 'customer.subscription.deleted') {
    if (context.plan === 'business') {
      await clearBusinessSubscription(context);
    } else {
      await clearProSubscription(context, subscription);
    }
    return;
  }

  if (event.type === 'invoice.payment_failed') {
    if (context.plan === 'business') {
      await clearBusinessSubscription(context);
    } else {
      await clearProSubscription(context, subscription);
    }
    return;
  }

  if (context.plan === 'business') {
    await applyBusinessSubscription(subscription, context);
  } else if (context.plan === 'pro') {
    await applyProSubscription(subscription, context);
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
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
    case 'invoice.payment_failed': {
      await processSubscriptionEvent(event);
      break;
    }
    default:
      break;
  }

  await markWebhookProcessed(event.id);

  return NextResponse.json({ received: true });
};
