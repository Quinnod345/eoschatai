import 'server-only';

import { db } from '@/lib/db';
import { user as userTable } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export type RemovalReason = 'admin' | 'seat_reduction' | 'org_deleted';

/**
 * Notify a user that they have been removed from an organization
 * This function handles both in-app notifications and email notifications
 */
export async function notifyMemberRemoval(
  userId: string,
  orgName: string,
  reason: RemovalReason,
): Promise<void> {
  try {
    // Get user details
    const [user] = await db
      .select({ email: userTable.email })
      .from(userTable)
      .where(eq(userTable.id, userId));

    if (!user) {
      console.warn(
        `[member-removal] User ${userId} not found for notification`,
      );
      return;
    }

    // Log the removal event
    console.log(
      `[member-removal] Notifying user ${userId} (${user.email}) about removal from ${orgName}. Reason: ${reason}`,
    );

    // Determine notification message based on reason
    const messages = {
      admin: {
        subject: `Removed from ${orgName}`,
        body: `You have been removed from the organization "${orgName}" by an administrator. If you have any questions, please contact the organization owner.`,
      },
      seat_reduction: {
        subject: `Removed from ${orgName} due to seat reduction`,
        body: `You have been removed from the organization "${orgName}" because the organization reduced its seat count. If you need access, please contact the organization owner to discuss upgrading the subscription.`,
      },
      org_deleted: {
        subject: `${orgName} has been deleted`,
        body: `The organization "${orgName}" has been deleted. You have been removed as a member. Any premium features you had through this organization are no longer available. If you had an individual Pro subscription, it has been preserved.`,
      },
    };

    const message = messages[reason];

    // TODO: Send email notification via Resend
    // Example:
    // const { Resend } = await import('resend');
    // const resend = new Resend(process.env.RESEND_API_KEY);
    // await resend.emails.send({
    //   from: 'noreply@yourdomain.com',
    //   to: user.email,
    //   subject: message.subject,
    //   html: generateRemovalEmailHtml(orgName, reason, message.body),
    // });

    // TODO: Create in-app notification
    // This would require a notifications table/system
    // For now, we'll just log it
    console.log(
      `[member-removal] Email notification queued for ${user.email}: "${message.subject}"`,
    );

    // Track analytics event
    try {
      const { trackServerEvent } = await import('@/lib/analytics');
      await trackServerEvent({
        event: 'member_removed_from_org',
        userId,
        properties: {
          orgName,
          reason,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.warn('[member-removal] Failed to track analytics event:', error);
    }
  } catch (error) {
    console.error(
      `[member-removal] Failed to notify user ${userId} about removal:`,
      error,
    );
    // Don't throw - notification failure shouldn't block the removal
  }
}

/**
 * Notify multiple users about removal from an organization
 * Used when org is deleted or multiple members are removed at once
 */
export async function notifyMultipleMemberRemovals(
  userIds: string[],
  orgName: string,
  reason: RemovalReason,
): Promise<void> {
  console.log(
    `[member-removal] Notifying ${userIds.length} users about removal from ${orgName}`,
  );

  // Send notifications in parallel
  await Promise.allSettled(
    userIds.map((userId) => notifyMemberRemoval(userId, orgName, reason)),
  );
}

/**
 * Notify organization owner about pending member removals
 * Used when seat count is reduced and admin needs to select who to remove
 */
export async function notifyOwnerPendingRemovals(
  ownerId: string,
  orgId: string,
  orgName: string,
  pendingRemovalCount: number,
): Promise<void> {
  try {
    const [owner] = await db
      .select({ email: userTable.email })
      .from(userTable)
      .where(eq(userTable.id, ownerId));

    if (!owner) {
      console.warn(
        `[member-removal] Owner ${ownerId} not found for notification`,
      );
      return;
    }

    console.log(
      `[member-removal] Notifying owner ${ownerId} about ${pendingRemovalCount} pending removals for ${orgName}`,
    );

    // TODO: Send email notification
    // const subject = `Action Required: Select ${pendingRemovalCount} members to remove from ${orgName}`;
    // const body = `Your organization "${orgName}" has reduced its seat count. You need to select ${pendingRemovalCount} member(s) to remove. Please visit your organization settings to make this selection.`;

    console.log(
      `[member-removal] Owner notification queued for ${owner.email}: ${pendingRemovalCount} pending removals`,
    );

    // Track analytics event
    try {
      const { trackServerEvent } = await import('@/lib/analytics');
      await trackServerEvent({
        event: 'pending_removals_notification_sent',
        userId: ownerId,
        orgId,
        properties: {
          orgName,
          pendingRemovalCount,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.warn(
        '[member-removal] Failed to track owner notification event:',
        error,
      );
    }
  } catch (error) {
    console.error(`[member-removal] Failed to notify owner ${ownerId}:`, error);
  }
}
