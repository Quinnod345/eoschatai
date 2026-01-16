import 'server-only';

import { db } from '@/lib/db';
import { user as userTable } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getResendClient, getFromAddress } from '@/lib/email/resend';

export type RemovalReason = 'admin' | 'seat_reduction' | 'org_deleted';

/**
 * Generate HTML email for member removal notification
 */
function generateRemovalEmailHtml(
  orgName: string,
  reason: RemovalReason,
  body: string,
): string {
  const reasonEmoji = {
    admin: '👋',
    seat_reduction: '📉',
    org_deleted: '🗑️',
  };

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f9fafb;
    }
    .container {
      background: white;
      border-radius: 8px;
      padding: 32px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    h1 {
      color: #111827;
      font-size: 24px;
      margin: 0 0 24px 0;
    }
    p {
      margin: 0 0 16px 0;
      color: #4b5563;
    }
    .footer {
      margin-top: 32px;
      padding-top: 16px;
      border-top: 1px solid #e5e7eb;
      font-size: 14px;
      color: #6b7280;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>${reasonEmoji[reason]} Organization Update</h1>
    <p>${body.replace(/\n/g, '<br>')}</p>
    <div class="footer">
      <p>This is an automated notification from EOS AI.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Notify a user that they have been removed from an organization
 * This function handles both in-app notifications and email notifications
 */
export async function notifyMemberRemoval(
  userId: string,
  orgName: string,
  reason: RemovalReason,
): Promise<{ success: boolean; emailId?: string; error?: string }> {
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
      return { success: false, error: 'User not found' };
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

    // Send email notification via Resend
    const resend = getResendClient();
    if (resend) {
      try {
        const from = getFromAddress();
        const { data, error } = await resend.emails.send({
          from,
          to: user.email,
          subject: message.subject,
          text: message.body,
          html: generateRemovalEmailHtml(orgName, reason, message.body),
          tags: [
            { name: 'type', value: 'member_removal' },
            { name: 'reason', value: reason },
            { name: 'userId', value: userId },
          ],
        });

        if (error) {
          console.error('[member-removal] Failed to send email:', error);
        } else {
          console.log(
            `[member-removal] Email sent successfully to ${user.email}, id: ${data?.id}`,
          );
        }
      } catch (emailError) {
        console.error('[member-removal] Error sending email:', emailError);
      }
    } else {
      console.log(
        `[member-removal] Email notification queued for ${user.email}: "${message.subject}"`,
      );
    }

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

    return { success: true };
  } catch (error) {
    console.error(
      `[member-removal] Failed to notify user ${userId} about removal:`,
      error,
    );
    // Don't throw - notification failure shouldn't block the removal
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
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
): Promise<{ success: boolean; error?: string }> {
  try {
    const [owner] = await db
      .select({ email: userTable.email })
      .from(userTable)
      .where(eq(userTable.id, ownerId));

    if (!owner) {
      console.warn(
        `[member-removal] Owner ${ownerId} not found for notification`,
      );
      return { success: false, error: 'Owner not found' };
    }

    console.log(
      `[member-removal] Notifying owner ${ownerId} about ${pendingRemovalCount} pending removals for ${orgName}`,
    );

    const subject = `⚠️ Action Required: Select ${pendingRemovalCount} member(s) to remove from ${orgName}`;
    const body = `Your organization "${orgName}" has reduced its seat count. You need to select ${pendingRemovalCount} member(s) to remove.\n\nPlease visit your organization settings to make this selection. Members that are not manually selected will be removed automatically after 7 days.`;

    // Send email notification via Resend
    const resend = getResendClient();
    if (resend) {
      try {
        const from = getFromAddress();
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://eosbot.ai';
        const settingsUrl = `${appUrl}/settings/organization`;

        const { data, error } = await resend.emails.send({
          from,
          to: owner.email,
          subject,
          text: `${body}\n\nManage members: ${settingsUrl}`,
          html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f9fafb;
    }
    .container {
      background: white;
      border-radius: 8px;
      padding: 32px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    h1 {
      color: #111827;
      font-size: 24px;
      margin: 0 0 24px 0;
    }
    p {
      margin: 0 0 16px 0;
      color: #4b5563;
    }
    .cta-button {
      display: inline-block;
      background-color: #2563eb;
      color: white;
      padding: 12px 24px;
      border-radius: 6px;
      text-decoration: none;
      font-weight: 500;
      margin: 16px 0;
    }
    .warning {
      background-color: #fef3cd;
      border: 1px solid #ffc107;
      border-radius: 6px;
      padding: 12px;
      margin: 16px 0;
      color: #856404;
    }
    .footer {
      margin-top: 32px;
      padding-top: 16px;
      border-top: 1px solid #e5e7eb;
      font-size: 14px;
      color: #6b7280;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>⚠️ Action Required</h1>
    <p>${body.replace(/\n/g, '<br>')}</p>
    <div class="warning">
      <strong>Important:</strong> Members will be automatically removed after 7 days if no action is taken.
    </div>
    <a href="${settingsUrl}" class="cta-button">Manage Members</a>
    <div class="footer">
      <p>This is an automated notification from EOS AI.</p>
    </div>
  </div>
</body>
</html>
          `.trim(),
          tags: [
            { name: 'type', value: 'pending_removals' },
            { name: 'orgId', value: orgId },
            { name: 'userId', value: ownerId },
          ],
        });

        if (error) {
          console.error('[member-removal] Failed to send owner email:', error);
        } else {
          console.log(
            `[member-removal] Owner email sent successfully to ${owner.email}, id: ${data?.id}`,
          );
        }
      } catch (emailError) {
        console.error(
          '[member-removal] Error sending owner email:',
          emailError,
        );
      }
    } else {
      console.log(
        `[member-removal] Owner notification queued for ${owner.email}: ${pendingRemovalCount} pending removals`,
      );
    }

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

    return { success: true };
  } catch (error) {
    console.error(`[member-removal] Failed to notify owner ${ownerId}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
