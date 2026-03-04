import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import {
  org as orgTable,
  user as userTable,
  orgMemberRole,
} from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { validateInviteCode } from '@/lib/organizations/invite-codes';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body', code: 'INVALID_JSON_BODY' },
        { status: 400 },
      );
    }
    const { inviteCode } = body as { inviteCode?: unknown };

    if (!inviteCode || typeof inviteCode !== 'string') {
      return NextResponse.json(
        { error: 'Invite code is required', code: 'INVITE_CODE_REQUIRED' },
        { status: 400 },
      );
    }

    // Check if user already belongs to an organization
    const [existingUser] = await db
      .select()
      .from(userTable)
      .where(eq(userTable.id, session.user.id));

    if (existingUser?.orgId) {
      return NextResponse.json(
        {
          error: 'You already belong to an organization',
          code: 'ALREADY_IN_ORG',
        },
        { status: 400 },
      );
    }

    // Validate invite code from Redis
    const inviteData = await validateInviteCode(inviteCode, session.user.id);

    if (!inviteData) {
      return NextResponse.json(
        {
          error: 'Invalid or expired invite code',
          code: 'INVITE_INVALID_OR_EXPIRED',
        },
        { status: 400 },
      );
    }

    // Get the organization from database
    const [organization] = await db
      .select()
      .from(orgTable)
      .where(eq(orgTable.id, inviteData.orgId));

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found', code: 'ORG_NOT_FOUND' },
        { status: 404 },
      );
    }

    // Check if user has an individual Pro subscription (before transaction)
    let hasRedundantSubscription = false;
    if (existingUser?.stripeCustomerId && organization.plan !== 'free') {
      try {
        const { getStripeClient } = await import('@/lib/stripe/client');
        const stripe = getStripeClient();
        const { getUserSubscriptionDetails } = await import(
          '@/lib/billing/subscription-utils'
        );

        if (!stripe) {
          console.warn('[join-org] Stripe client not available');
        } else {
          const subscriptionDetails = await getUserSubscriptionDetails(
            existingUser.stripeCustomerId,
            stripe,
          );

          // Warn if user has Pro subscription and is joining Business org
          if (
            subscriptionDetails.hasProSubscription &&
            organization.plan === 'business'
          ) {
            hasRedundantSubscription = true;
            console.log(
              `[join-org] User ${session.user.id} has Pro subscription but joining Business org - subscription is now redundant`,
            );
          }
        }
      } catch (error) {
        console.warn('[join-org] Failed to check user subscriptions:', error);
      }
    }

    // Use transaction to prevent race conditions
    await db.transaction(async (tx) => {
      // Re-verify user still doesn't have orgId (prevent double-join)
      const [currentUser] = await tx
        .select({
          orgId: userTable.orgId,
          plan: userTable.plan,
          subscriptionSource: userTable.subscriptionSource,
        })
        .from(userTable)
        .where(eq(userTable.id, session.user.id));

      if (!currentUser) {
        throw new Error('User no longer exists');
      }

      if (currentUser.orgId) {
        throw new Error('You already belong to an organization');
      }

      // Re-verify organization still exists and has seats
      const [org] = await tx
        .select({
          id: orgTable.id,
          plan: orgTable.plan,
          subscriptionSource: orgTable.subscriptionSource,
          seatCount: orgTable.seatCount,
          memberCount: sql<number>`(SELECT COUNT(*) FROM "User" WHERE "orgId" = ${orgTable.id})`,
        })
        .from(orgTable)
        .where(eq(orgTable.id, organization.id));

      if (!org) {
        throw new Error('Organization no longer exists');
      }

      if (
        org.subscriptionSource !== 'circle' &&
        Number(org.memberCount) >= org.seatCount
      ) {
        throw new Error('Organization has reached its seat limit');
      }

      // Update user to belong to this organization and sync plan (atomically)
      const nextPlan =
        org.subscriptionSource === 'circle' ||
        currentUser.subscriptionSource === 'circle'
          ? currentUser.plan
          : org.plan;
      await tx
        .update(userTable)
        .set({
          orgId: org.id,
          plan: nextPlan,
        })
        .where(eq(userTable.id, session.user.id));

      // Create OrgMemberRole record for the new member
      await tx.insert(orgMemberRole).values({
        userId: session.user.id,
        orgId: org.id,
        role: 'member',
      });
    });

    // Force recomputation and broadcast of entitlements with new org plan
    try {
      const {
        getUserEntitlements,
        invalidateUserEntitlementsCache,
        broadcastEntitlementsUpdated,
      } = await import('@/lib/entitlements');

      // CRITICAL: Invalidate cache FIRST to avoid serving stale data
      await invalidateUserEntitlementsCache(session.user.id);
      await getUserEntitlements(session.user.id);
      await broadcastEntitlementsUpdated(session.user.id);
    } catch (error) {
      console.warn('[join-org] Failed to update entitlements:', error);
    }

    return NextResponse.json({
      organization: {
        id: organization.id,
        name: organization.name,
        plan: organization.plan,
      },
      warning: hasRedundantSubscription
        ? 'You have an active Pro subscription. Since this organization has a Business plan, your individual Pro subscription is now redundant. You may want to cancel it to avoid double billing.'
        : undefined,
      warningCode: hasRedundantSubscription
        ? 'REDUNDANT_STRIPE_SUBSCRIPTION'
        : undefined,
      warningAction: hasRedundantSubscription ? 'open_billing_portal' : undefined,
    });
  } catch (error) {
    console.error('Error joining organization:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to join organization';

    if (message.includes('already belong to an organization')) {
      return NextResponse.json(
        {
          error: 'You already belong to an organization',
          code: 'ALREADY_IN_ORG',
        },
        { status: 409 },
      );
    }

    if (message.includes('seat limit')) {
      return NextResponse.json(
        {
          error: 'Organization has reached its seat limit',
          code: 'ORG_SEAT_LIMIT_REACHED',
        },
        { status: 409 },
      );
    }

    if (message.includes('Organization no longer exists')) {
      return NextResponse.json(
        { error: 'Organization not found', code: 'ORG_NOT_FOUND' },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        error: message || 'Failed to join organization',
        code: 'JOIN_ORGANIZATION_FAILED',
      },
      { status: 500 },
    );
  }
}
