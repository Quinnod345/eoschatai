import { NextResponse } from 'next/server';
import { z } from 'zod/v3';
import { eq } from 'drizzle-orm';

import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import { org, orgMemberRole, user } from '@/lib/db/schema';
import {
  getMemberByEmail,
  mapCircleTierToPlan,
} from '@/lib/integrations/circle';
import {
  broadcastEntitlementsUpdated,
  getUserEntitlements,
  invalidateUserEntitlementsCache,
} from '@/lib/entitlements';

const requestSchema = z.object({
  createOrg: z.boolean().optional().default(false),
  orgName: z.string().trim().min(2).max(100).optional(),
});

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request payload', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const [currentUser] = await db
    .select({
      id: user.id,
      email: user.email,
      orgId: user.orgId,
      stripeCustomerId: user.stripeCustomerId,
      subscriptionSource: user.subscriptionSource,
    })
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1);

  if (!currentUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const lookupEmail = currentUser.email.trim().toLowerCase();
  if (!lookupEmail || !lookupEmail.includes('@')) {
    return NextResponse.json(
      { error: 'Your account email is required to connect Circle membership' },
      { status: 400 },
    );
  }

  const [currentOrg] = currentUser.orgId
    ? await db
        .select({ subscriptionSource: org.subscriptionSource })
        .from(org)
        .where(eq(org.id, currentUser.orgId))
        .limit(1)
    : [];

  const isInStripeBackedOrg = currentOrg?.subscriptionSource === 'stripe';
  let activeIndividualStripePlan: 'pro' | 'business' | null = null;

  if (currentUser.stripeCustomerId) {
    try {
      const { getStripeClient } = await import('@/lib/stripe/client');
      const stripe = getStripeClient();
      if (stripe) {
        const { getUserIndividualSubscriptionPlan } = await import(
          '@/lib/billing/subscription-utils'
        );
        activeIndividualStripePlan = await getUserIndividualSubscriptionPlan(
          currentUser.stripeCustomerId,
          stripe,
          currentUser.id,
        );
      }
    } catch (error) {
      console.warn('[circle.connect] Failed to evaluate active Stripe subscription', {
        userId: currentUser.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const member = await getMemberByEmail(lookupEmail);
  if (!member) {
    return NextResponse.json(
      {
        error: 'No Circle member found for this email address',
        code: 'CIRCLE_MEMBER_NOT_FOUND',
        emailUsed: lookupEmail,
      },
      { status: 404 },
    );
  }

  const mappedPlan = member.mappedPlan || mapCircleTierToPlan(member.tierName);
  if (!mappedPlan) {
    return NextResponse.json(
      {
        error: `Circle tier "${member.tierName}" is not mapped to an EOS AI plan`,
      },
      { status: 400 },
    );
  }

  let connectedOrg: {
    id: string;
    name: string | null;
    plan: 'free' | 'pro' | 'business';
    subscriptionSource: 'stripe' | 'circle';
  } | null = null;

  await db.transaction(async (tx) => {
    await tx
      .update(user)
      .set({
        plan: mappedPlan,
        subscriptionSource: 'circle',
        circleId: member.id ?? undefined,
        // Keep legacy Circle sync compatibility while adopting circleId.
        circleMemberId: member.id ?? undefined,
        circleMemberEmail: member.email ?? lookupEmail,
      })
      .where(eq(user.id, currentUser.id));

    const [freshUser] = await tx
      .select({ orgId: user.orgId })
      .from(user)
      .where(eq(user.id, currentUser.id))
      .limit(1);

    if (freshUser?.orgId) {
      const [existingOrg] = await tx
        .select({
          id: org.id,
          name: org.name,
          plan: org.plan,
          subscriptionSource: org.subscriptionSource,
        })
        .from(org)
        .where(eq(org.id, freshUser.orgId))
        .limit(1);

      connectedOrg = existingOrg ?? null;
      return;
    }

    if (mappedPlan !== 'business' || !parsed.data.createOrg) {
      return;
    }

    const fallbackOrgName =
      parsed.data.orgName || `${currentUser.email.split('@')[0]}'s Circle Team`;

    const [createdOrg] = await tx
      .insert(org)
      .values({
        name: fallbackOrgName,
        ownerId: currentUser.id,
        // Circle orgs are resource-sharing only and should not drive feature access.
        plan: 'free',
        subscriptionSource: 'circle',
      })
      .returning({
        id: org.id,
        name: org.name,
        plan: org.plan,
        subscriptionSource: org.subscriptionSource,
      });

    await tx
      .update(user)
      .set({ orgId: createdOrg.id })
      .where(eq(user.id, currentUser.id));

    await tx
      .insert(orgMemberRole)
      .values({
        userId: currentUser.id,
        orgId: createdOrg.id,
        role: 'owner',
      })
      .onConflictDoNothing();

    connectedOrg = createdOrg;
  });

  await invalidateUserEntitlementsCache(currentUser.id);
  await getUserEntitlements(currentUser.id);
  await broadcastEntitlementsUpdated(currentUser.id);

  const warning = activeIndividualStripePlan
    ? `You still have an active Stripe ${activeIndividualStripePlan} subscription. Your EOS AI access is now Circle-managed. Cancel your Stripe plan to avoid double billing.`
    : undefined;

  const notice = isInStripeBackedOrg
      ? "Your Circle membership has been linked, but your current plan access comes from your organization's Stripe subscription. Your Circle tier will take effect if you leave the organization."
      : undefined;

  return NextResponse.json({
    success: true,
    member: {
      id: member.id,
      email: member.email,
      tierName: member.tierName,
      mappedPlan,
    },
    org: connectedOrg,
    canCreateResourceOrg: mappedPlan === 'business' && !connectedOrg,
    warning,
    warningCode: activeIndividualStripePlan
      ? 'REDUNDANT_STRIPE_SUBSCRIPTION'
      : undefined,
    warningAction: activeIndividualStripePlan ? 'open_billing_portal' : undefined,
    notice,
    activeStripePlan: activeIndividualStripePlan,
  });
}
