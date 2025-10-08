import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import {
  org as orgTable,
  user as userTable,
  orgInvitation,
} from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

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

    // Get organization details
    const [organization] = await db
      .select()
      .from(orgTable)
      .where(eq(orgTable.id, orgId));

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
        stripeCustomerId: userTable.stripeCustomerId,
      })
      .from(userTable)
      .where(eq(userTable.orgId, orgId));

    console.log(
      `[delete-org] Deleting organization ${orgId} with ${members.length} members`,
    );

    // Cancel organization's Stripe subscription
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

    // Get Stripe client for checking individual subscriptions
    const { getStripeClient } = await import('@/lib/stripe/client');
    const stripe = getStripeClient();
    const { getUserIndividualSubscriptionPlan } = await import(
      '@/lib/billing/subscription-utils'
    );

    // Process each member
    for (const member of members) {
      // Check if member has individual Pro subscription
      const individualPlan = stripe
        ? await getUserIndividualSubscriptionPlan(
            member.stripeCustomerId,
            stripe,
            member.id,
          )
        : null;

      const newPlan = individualPlan || 'free';

      // Remove member from organization and reset plan
      await db
        .update(userTable)
        .set({
          orgId: null,
          plan: newPlan,
        })
        .where(eq(userTable.id, member.id));

      console.log(`[delete-org] Reset member ${member.id} to plan: ${newPlan}`);
    }

    // Recompute entitlements for all members and broadcast updates
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

    // Delete all pending invitations
    try {
      // Get invite codes before deletion to invalidate in Redis
      const invites = await db
        .select({ inviteCode: orgInvitation.inviteCode })
        .from(orgInvitation)
        .where(eq(orgInvitation.orgId, orgId));

      // Delete from database
      await db.delete(orgInvitation).where(eq(orgInvitation.orgId, orgId));

      // Invalidate invite codes in Redis
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

      console.log(`[delete-org] Deleted ${invites.length} pending invitations`);
    } catch (error) {
      console.error('[delete-org] Failed to delete invitations:', error);
      // Continue with org deletion even if invitation cleanup fails
    }

    // Finally, delete the organization
    await db.delete(orgTable).where(eq(orgTable.id, orgId));

    console.log(`[delete-org] Successfully deleted organization ${orgId}`);

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
