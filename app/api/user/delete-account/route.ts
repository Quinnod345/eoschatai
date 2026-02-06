import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import { eq } from 'drizzle-orm';
import * as schema from '@/lib/db/schema';
import { ApiErrors, logApiError } from '@/lib/api/error-response';

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return ApiErrors.unauthorized();
    }

    const userId = session.user.id;

    // Get user details including org membership
    const [user] = await db
      .select()
      .from(schema.user)
      .where(eq(schema.user.id, userId));

    if (!user) {
      return ApiErrors.notFound('User');
    }

    // Check if user owns an organization
    if (user.orgId) {
      const [org] = await db
        .select()
        .from(schema.org)
        .where(eq(schema.org.id, user.orgId));

      if (org?.ownerId === userId) {
        // Check if there are other members
        const memberCount = await db
          .select({ id: schema.user.id })
          .from(schema.user)
          .where(eq(schema.user.orgId, user.orgId));

        if (memberCount.length > 1) {
          return ApiErrors.validationFailed(
            'You must transfer organization ownership or remove all members before deleting your account'
          );
        }

        // If user is the only member, cancel org subscription and delete org
        if (org.stripeSubscriptionId) {
          try {
            const { getStripeClient } = await import('@/lib/stripe/client');
            const stripe = getStripeClient();
            const { cancelOrgSubscription } = await import(
              '@/lib/billing/subscription-utils'
            );

            if (stripe) {
              await cancelOrgSubscription(org.stripeSubscriptionId, stripe, {
                reason: 'Account deleted by owner',
                immediately: true,
              });
            }
          } catch (error) {
            console.error(
              '[delete-account] Failed to cancel org subscription:',
              error,
            );
            // Continue with deletion even if subscription cancellation fails
          }
        }

        // Delete all pending invitations for this org
        try {
          // Get invite codes before deletion to invalidate in Redis
          const invites = await db
            .select({ inviteCode: schema.orgInvitation.inviteCode })
            .from(schema.orgInvitation)
            .where(eq(schema.orgInvitation.orgId, user.orgId));

          // Delete from database
          await db
            .delete(schema.orgInvitation)
            .where(eq(schema.orgInvitation.orgId, user.orgId));

          // Invalidate invite codes in Redis
          const { getRedisClient } = await import('@/lib/redis/client');
          const redis = getRedisClient();
          if (redis) {
            for (const invite of invites) {
              try {
                await redis.del(`invite:${invite.inviteCode}`);
              } catch (error) {
                console.warn(
                  `[delete-account] Failed to invalidate invite code:`,
                  error,
                );
              }
            }
          }

          console.log(
            `[delete-account] Deleted ${invites.length} pending invitations`,
          );
        } catch (error) {
          console.error(
            '[delete-account] Failed to delete org invitations:',
            error,
          );
          // Continue with deletion
        }

        // Delete the organization
        await db.delete(schema.org).where(eq(schema.org.id, user.orgId));
      } else {
        // User is a member but not owner - remove them from org first
        await db
          .update(schema.user)
          .set({ orgId: null, plan: 'free' })
          .where(eq(schema.user.id, userId));
      }
    }

    // Cancel all individual subscriptions and delete Stripe customer
    if (user.stripeCustomerId) {
      try {
        const { getStripeClient } = await import('@/lib/stripe/client');
        const stripe = getStripeClient();
        const { cancelAllUserSubscriptions } = await import(
          '@/lib/billing/subscription-utils'
        );

        if (stripe) {
          const cancelledCount = await cancelAllUserSubscriptions(
            user.stripeCustomerId,
            stripe,
            {
              reason: 'Account deleted by user',
              immediately: true,
            },
          );

          console.log(
            `[delete-account] Cancelled ${cancelledCount} subscriptions for user ${userId}`,
          );

          // Delete/anonymize Stripe customer to clean up payment methods and data
          try {
            await stripe.customers.del(user.stripeCustomerId);
            console.log(
              `[delete-account] Deleted Stripe customer ${user.stripeCustomerId}`,
            );
          } catch (delError) {
            console.error(
              '[delete-account] Failed to delete Stripe customer:',
              delError,
            );
            // Continue anyway - customer data will remain in Stripe but account is deleted
          }
        }
      } catch (error) {
        console.error(
          '[delete-account] Failed to cancel subscriptions:',
          error,
        );
        // Continue with deletion even if subscription cancellation fails
      }
    }

    // Delete user data in the correct order (respecting foreign key constraints)

    // 1. Delete personas (profiles will be cascade deleted via FK)
    await db.delete(schema.persona).where(eq(schema.persona.userId, userId));

    // 2. Delete messages first
    const userChats = await db
      .select({ id: schema.chat.id })
      .from(schema.chat)
      .where(eq(schema.chat.userId, userId));

    for (const chat of userChats) {
      await db.delete(schema.message).where(eq(schema.message.chatId, chat.id));
      await db
        .delete(schema.messageDeprecated)
        .where(eq(schema.messageDeprecated.chatId, chat.id));
    }

    // 3. Delete chats
    await db.delete(schema.chat).where(eq(schema.chat.userId, userId));

    // 4. Delete documents and user document associations
    await db.delete(schema.document).where(eq(schema.document.userId, userId));
    await db
      .delete(schema.userDocuments)
      .where(eq(schema.userDocuments.userId, userId));

    // 5. Delete calendar tokens
    await db
      .delete(schema.googleCalendarToken)
      .where(eq(schema.googleCalendarToken.userId, userId));

    // 6. Delete voice recordings if any
    // Note: This assumes recordings are stored with userId reference
    // Adjust based on your actual schema

    // 7. Clear entitlements cache
    try {
      const { invalidateUserEntitlementsCache } = await import(
        '@/lib/entitlements'
      );
      await invalidateUserEntitlementsCache(userId);
    } catch (error) {
      console.warn(
        '[delete-account] Failed to clear entitlements cache:',
        error,
      );
    }

    // 8. Finally delete the user
    await db.delete(schema.user).where(eq(schema.user.id, userId));

    return NextResponse.json({
      success: true,
      message: 'Account deleted successfully',
    });
  } catch (error) {
    logApiError('api/user/delete-account DELETE', error);
    return ApiErrors.internalError('Failed to delete account');
  }
}
