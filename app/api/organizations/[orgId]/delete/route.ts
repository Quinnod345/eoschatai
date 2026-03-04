import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import {
  org as orgTable,
  user as userTable,
  orgInvitation,
  type PlanType,
} from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { validateUuidField } from '@/lib/api/validation';
import { resolveCirclePlanFromEmail } from '@/lib/integrations/circle-plan-resolver';

interface RouteParams {
  params: Promise<{
    orgId: string;
  }>;
}

/**
 * Delete an organization
 * Only the organization owner can delete
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orgId } = await params;
    const validatedOrgId = validateUuidField(orgId, 'orgId');
    if (!validatedOrgId.ok) {
      return NextResponse.json({ error: validatedOrgId.error }, { status: 400 });
    }
    const orgIdValue = validatedOrgId.value;

    // Get organization details
    const [organization] = await db
      .select()
      .from(orgTable)
      .where(eq(orgTable.id, orgIdValue));

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 },
      );
    }

    // Verify requester is organization owner
    if (organization.ownerId !== session.user.id) {
      return NextResponse.json(
        { error: 'Only the organization owner can delete the organization' },
        { status: 403 },
      );
    }

    // Get all members before deletion
    const members = await db
      .select({
        id: userTable.id,
        email: userTable.email,
        circleMemberEmail: userTable.circleMemberEmail,
        plan: userTable.plan,
        stripeCustomerId: userTable.stripeCustomerId,
        subscriptionSource: userTable.subscriptionSource,
      })
      .from(userTable)
      .where(eq(userTable.orgId, orgIdValue));

    console.log(
      `[delete-org] Deleting organization ${orgIdValue} with ${members.length} members`,
    );

    // Cancel organization's Stripe subscription (outside transaction - external API)
    if (organization.stripeSubscriptionId) {
      try {
        const { getStripeClient } = await import('@/lib/stripe/client');
        const stripe = getStripeClient();
        const { cancelOrgSubscription } = await import(
          '@/lib/billing/subscription-utils'
        );

        if (stripe) {
          const cancelled = await cancelOrgSubscription(
            organization.stripeSubscriptionId,
            stripe,
            {
              reason: 'Organization deleted',
              immediately: true,
            },
          );

          if (cancelled) {
            console.log(
              `[delete-org] Cancelled subscription ${organization.stripeSubscriptionId}`,
            );
          } else {
            console.log(
              `[delete-org] Subscription ${organization.stripeSubscriptionId} not found in Stripe, continuing with deletion`,
            );
          }
        }
      } catch (error) {
        console.error('[delete-org] Failed to cancel subscription:', error);
        // Continue with deletion even if subscription cancellation fails
      }
    }

    // Build map of member -> newPlan by checking Stripe (outside transaction - external API)
    const { getStripeClient } = await import('@/lib/stripe/client');
    const stripe = getStripeClient();
    const { getUserIndividualSubscriptionPlan } = await import(
      '@/lib/billing/subscription-utils'
    );

    const memberPlanMap = new Map<string, PlanType>();
    for (const member of members) {
      if (member.subscriptionSource === 'circle') {
        memberPlanMap.set(
          member.id,
          await resolveCirclePlanFromEmail(member.email, 'delete-org', {
            fallbackOnLookupError: member.plan,
            alternateEmail: member.circleMemberEmail,
          }),
        );
        continue;
      }

      const individualPlan = stripe
        ? await getUserIndividualSubscriptionPlan(
            member.stripeCustomerId,
            stripe,
            member.id,
          )
        : null;
      memberPlanMap.set(member.id, (individualPlan as PlanType) || 'free');
    }

    // Get invite codes before deletion (for Redis cleanup after transaction)
    const invites = await db
      .select({ inviteCode: orgInvitation.inviteCode })
      .from(orgInvitation)
      .where(eq(orgInvitation.orgId, orgIdValue));

    // Use transaction to ensure atomic deletion of all database records
    await db.transaction(async (tx) => {
      // Update all members' orgId and plan
      for (const member of members) {
        const newPlan: PlanType = memberPlanMap.get(member.id) || 'free';
        await tx
          .update(userTable)
          .set({
            orgId: null,
            plan: newPlan,
          })
          .where(eq(userTable.id, member.id));

        console.log(
          `[delete-org] Reset member ${member.id} to plan: ${newPlan}`,
        );
      }

      // Delete all pending invitations
      await tx
        .delete(orgInvitation)
        .where(eq(orgInvitation.orgId, orgIdValue));
      console.log(`[delete-org] Deleted ${invites.length} pending invitations`);

      // Delete the organization (cascade will clean up OrgMemberRole records)
      await tx.delete(orgTable).where(eq(orgTable.id, orgIdValue));
      console.log(`[delete-org] Deleted organization ${orgIdValue}`);
    });

    // Invalidate Redis caches (outside transaction)
    try {
      const { getRedisClient } = await import('@/lib/redis/client');
      const redis = getRedisClient();
      if (redis) {
        for (const invite of invites) {
          try {
            await redis.del(`invite:${invite.inviteCode}`);
          } catch (error) {
            console.warn(
              `[delete-org] Failed to invalidate invite code ${invite.inviteCode}:`,
              error,
            );
          }
        }
      }
    } catch (error) {
      console.warn('[delete-org] Failed to invalidate invite codes:', error);
    }

    // Recompute entitlements for all members and broadcast updates (outside transaction)
    try {
      const {
        getUserEntitlements,
        invalidateUserEntitlementsCache,
        broadcastEntitlementsUpdated,
      } = await import('@/lib/entitlements');

      for (const member of members) {
        // CRITICAL: Invalidate cache FIRST to avoid serving stale data
        await invalidateUserEntitlementsCache(member.id);
        await getUserEntitlements(member.id);
        await broadcastEntitlementsUpdated(member.id);
      }
    } catch (error) {
      console.warn('[delete-org] Failed to update member entitlements:', error);
    }

    console.log(`[delete-org] Successfully deleted organization ${orgIdValue}`);

    return NextResponse.json({
      success: true,
      message: 'Organization deleted successfully',
      membersAffected: members.length,
    });
  } catch (error) {
    console.error('[delete-org] Error deleting organization:', error);
    return NextResponse.json(
      { error: 'Failed to delete organization' },
      { status: 500 },
    );
  }
}
