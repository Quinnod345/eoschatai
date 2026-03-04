import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import {
  user as userTable,
  org as orgTable,
  orgMemberRole,
} from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { resolveCirclePlanFromEmail } from '@/lib/integrations/circle-plan-resolver';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's current organization
    const [user] = await db
      .select()
      .from(userTable)
      .where(eq(userTable.id, session.user.id));

    if (!user || !user.orgId) {
      return NextResponse.json(
        { error: 'You are not part of any organization' },
        { status: 400 },
      );
    }

    // Check if user is the owner
    const [organization] = await db
      .select({
        ownerId: orgTable.ownerId,
        stripeSubscriptionId: orgTable.stripeSubscriptionId,
      })
      .from(orgTable)
      .where(eq(orgTable.id, user.orgId));

    if (organization?.ownerId === session.user.id) {
      // Check if there are other members
      const memberCount = await db
        .select({ id: userTable.id })
        .from(userTable)
        .where(eq(userTable.orgId, user.orgId));

      if (memberCount.length > 1) {
        return NextResponse.json(
          {
            error:
              'As the owner, you must transfer ownership before leaving the organization',
          },
          { status: 400 },
        );
      }

      // If owner is the last member, DELETE the organization instead of orphaning it
      if (memberCount.length === 1) {
        console.log(
          `[leave-org] Last owner leaving, deleting organization ${user.orgId}`,
        );

        // Cancel organization subscription if it exists
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
                  reason: 'Last owner left organization',
                  immediately: true,
                },
              );

              if (cancelled) {
                console.log(
                  `[leave-org] Cancelled subscription ${organization.stripeSubscriptionId}`,
                );
              } else {
                console.log(
                  `[leave-org] Subscription ${organization.stripeSubscriptionId} not found in Stripe, continuing with deletion`,
                );
              }
            }
          } catch (error) {
            console.error(
              '[leave-org] Failed to cancel org subscription:',
              error,
            );
            // Continue with deletion even if cancellation fails
          }
        }

        // Delete pending invitations
        try {
          const { orgInvitation } = await import('@/lib/db/schema');
          const invites = await db
            .select({ inviteCode: orgInvitation.inviteCode })
            .from(orgInvitation)
            .where(eq(orgInvitation.orgId, user.orgId));

          await db
            .delete(orgInvitation)
            .where(eq(orgInvitation.orgId, user.orgId));

          // Invalidate invite codes in Redis
          const { getRedisClient } = await import('@/lib/redis/client');
          const redis = getRedisClient();
          if (redis) {
            for (const invite of invites) {
              try {
                await redis.del(`invite:${invite.inviteCode}`);
              } catch (error) {
                console.warn(
                  '[leave-org] Failed to invalidate invite code:',
                  error,
                );
              }
            }
          }

          console.log(
            `[leave-org] Deleted ${invites.length} pending invitations`,
          );
        } catch (error) {
          console.error('[leave-org] Failed to delete invitations:', error);
          // Continue with org deletion
        }

        // Delete the organization
        await db.delete(orgTable).where(eq(orgTable.id, user.orgId));
        console.log(`[leave-org] Deleted organization ${user.orgId}`);
      }
    }

    // Check if user has their own individual Stripe subscription
    const { getStripeClient } = await import('@/lib/stripe/client');
    const stripe = getStripeClient();
    const { getUserIndividualSubscriptionPlan } = await import(
      '@/lib/billing/subscription-utils'
    );

    const individualPlan = stripe
      ? await getUserIndividualSubscriptionPlan(
          user.stripeCustomerId,
          stripe,
          session.user.id,
        )
      : null;
    const newPlan =
      user.subscriptionSource === 'circle'
        ? await resolveCirclePlanFromEmail(user.email, 'leave-org', {
            fallbackOnLookupError: user.plan,
            alternateEmail: user.circleMemberEmail,
          })
        : individualPlan || 'free';

    // Store orgId before clearing (needed for role cleanup)
    const userOrgId = user.orgId;

    // Remove user from organization and reset plan
    await db
      .update(userTable)
      .set({
        orgId: null,
        plan: newPlan,
      })
      .where(eq(userTable.id, session.user.id));

    // Delete the OrgMemberRole record (may already be deleted by cascade if org was deleted)
    await db
      .delete(orgMemberRole)
      .where(
        and(
          eq(orgMemberRole.userId, session.user.id),
          eq(orgMemberRole.orgId, userOrgId),
        ),
      );

    // Clear and recompute entitlements
    try {
      const {
        invalidateUserEntitlementsCache,
        broadcastEntitlementsUpdated,
        getUserEntitlements,
      } = await import('@/lib/entitlements');

      // Force recomputation of entitlements with the new plan
      // CRITICAL: Invalidate cache FIRST to avoid serving stale data
      await invalidateUserEntitlementsCache(session.user.id);
      await getUserEntitlements(session.user.id);
      await broadcastEntitlementsUpdated(session.user.id);
    } catch (error) {
      console.warn('[leave-org] Failed to update entitlements:', error);
    }

    return NextResponse.json({
      success: true,
      message: 'Successfully left the organization',
    });
  } catch (error) {
    console.error('Error leaving organization:', error);
    return NextResponse.json(
      { error: 'Failed to leave organization' },
      { status: 500 },
    );
  }
}
