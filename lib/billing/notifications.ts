import 'server-only';

import { db } from '@/lib/db';
import { user as userTable } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getResendClient, getFromAddress } from '@/lib/email/resend';

export type NotificationEvent =
  | 'payment_failed'
  | 'payment_succeeded'
  | 'subscription_cancelled'
  | 'subscription_activated'
  | 'trial_ending'
  | 'grace_period_warning'
  | 'downgrade_warning'
  | 'double_billing_detected'
  | 'subscription_renewed'
  | 'payment_requires_action';

export interface NotificationPayload {
  userId: string;
  event: NotificationEvent;
  data: Record<string, any>;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Send a subscription notification to a user
 * This is a centralized notification system that supports:
 * - Email (via Resend)
 *
 * Future enhancements (tracked as GitHub issues):
 * - In-app notifications: Real-time notification bell/toast system
 * - Webhooks: Allow external systems to subscribe to billing events
 */
export async function sendSubscriptionNotification(
  payload: NotificationPayload,
): Promise<{ success: boolean; emailId?: string; error?: string }> {
  console.log(
    `[notifications] Sending ${payload.event} notification to user ${payload.userId}`,
  );

  // Get user email
  const [user] = await db
    .select({ email: userTable.email })
    .from(userTable)
    .where(eq(userTable.id, payload.userId));

  if (!user?.email) {
    console.warn(
      `[notifications] User ${payload.userId} has no email, skipping notification`,
    );
    return { success: false, error: 'User has no email address' };
  }

  const emailSubject = getEmailSubject(payload.event);
  const emailBody = getEmailBody(payload.event, payload.data, null);

  // Send email via Resend
  const resend = getResendClient();
  if (!resend) {
    console.warn(
      `[notifications] Resend client not configured, logging notification instead`,
    );
    console.log(`[notifications] Would send email to ${user.email}:`);
    console.log(`  Subject: ${emailSubject}`);
    console.log(`  Body: ${emailBody.substring(0, 200)}...`);
    return { success: false, error: 'Email service not configured' };
  }

  try {
    const from = getFromAddress();
    const { data, error } = await resend.emails.send({
      from,
      to: user.email,
      subject: emailSubject,
      text: emailBody,
      // Add HTML version with basic formatting
      html: convertTextToHtml(emailBody),
      tags: [
        { name: 'event', value: payload.event },
        { name: 'priority', value: payload.priority },
        { name: 'userId', value: payload.userId },
      ],
    });

    if (error) {
      console.error(`[notifications] Failed to send email:`, error);
      return { success: false, error: error.message };
    }

    console.log(
      `[notifications] Email sent successfully to ${user.email}, id: ${data?.id}`,
    );
    return { success: true, emailId: data?.id };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    console.error(`[notifications] Error sending email:`, error);
    return { success: false, error: errorMessage };
  }
}

/**
 * Convert plain text email body to simple HTML
 */
function convertTextToHtml(text: string): string {
  // Escape HTML entities
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Convert line breaks to <br> and wrap in basic HTML structure
  const htmlBody = escaped
    .split('\n\n')
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, '<br>')}</p>`)
    .join('\n');

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
    }
    p {
      margin: 0 0 16px 0;
    }
    a {
      color: #2563eb;
    }
  </style>
</head>
<body>
  ${htmlBody}
</body>
</html>
  `.trim();
}

function getEmailSubject(event: NotificationEvent): string {
  const subjects: Record<NotificationEvent, string> = {
    payment_failed: '⚠️ Payment Failed - Action Required',
    payment_succeeded: '✅ Payment Confirmed',
    subscription_cancelled: '👋 Your Subscription Has Been Cancelled',
    subscription_activated: '🎉 Welcome to Premium!',
    trial_ending: '⏰ Your Trial Ends Soon',
    grace_period_warning: '⚠️ Grace Period Warning',
    downgrade_warning: '⚠️ Your Plan Will Be Downgraded',
    double_billing_detected: '💰 Duplicate Subscription Detected',
    subscription_renewed: '🔄 Subscription Renewed',
    payment_requires_action: '🔐 Additional Verification Required',
  };

  return subjects[event] || 'Subscription Update';
}

function getEmailBody(
  event: NotificationEvent,
  data: Record<string, any>,
  userName?: string | null,
): string {
  const greeting = userName ? `Hi ${userName},` : 'Hi there,';

  const templates: Record<NotificationEvent, string> = {
    payment_failed: `${greeting}

We attempted to process your payment but it failed. This could be due to:
- Insufficient funds
- Expired card
- Card declined by your bank

${data.attemptCount ? `Attempt ${data.attemptCount} of 4.` : ''}

Please update your payment method to avoid service interruption.

Days until downgrade: ${data.daysRemaining || 'Unknown'}

Update Payment Method: ${data.billingUrl || '[Billing Portal Link]'}

Questions? Reply to this email or contact support.`,

    payment_succeeded: `${greeting}

Your payment has been successfully processed!

Amount: $${data.amount || 'N/A'}
Plan: ${data.plan || 'Premium'}
Next billing date: ${data.nextBillingDate || 'Unknown'}

Thank you for your continued support!`,

    subscription_cancelled: `${greeting}

Your subscription has been cancelled. You'll continue to have access until: ${data.accessUntil || 'the end of your billing period'}.

After that, you'll be downgraded to the Free plan with these limits:
- 20 messages per day
- 5 document uploads total
- No calendar integration
- No voice recording

Want to reactivate? Visit your billing settings anytime.`,

    subscription_activated: `${greeting}

Welcome to Premium! 🎉

Your subscription is now active. Here's what you get:

${
  data.plan === 'pro'
    ? `
✅ 200 messages per day
✅ 100 document uploads
✅ Calendar integration
✅ 600 minutes of voice recording per month
✅ Export conversations
`
    : data.plan === 'business'
      ? `
✅ 1,000 messages per day
✅ 1,000 document uploads
✅ Calendar integration
✅ 3,000 minutes of voice recording per month
✅ Export conversations
✅ Deep research mode (40 lookups per run)
✅ Team collaboration
`
      : '✅ Premium features'
}

Get started: [App Link]`,

    trial_ending: `${greeting}

Your trial ends in ${data.daysRemaining || 3} days!

After your trial ends:
${data.hasPaymentMethod ? '- Your card will be charged automatically' : '- Add a payment method to continue with premium features'}
${data.hasPaymentMethod ? '- Your premium access will continue' : "- You'll be downgraded to the Free plan"}

${data.hasPaymentMethod ? 'Manage billing' : 'Add payment method'}: ${data.billingUrl || '[Billing Portal Link]'}`,

    grace_period_warning: `${greeting}

Your payment failed and you're in a grace period.

Days remaining: ${data.daysRemaining || 7}
After grace period: Downgrade to Free plan

Please update your payment method to avoid losing access to premium features.

Update Payment: ${data.billingUrl || '[Billing Portal Link]'}`,

    downgrade_warning: `${greeting}

Your plan will be downgraded to Free on ${data.downgradeDate || 'soon'}.

Reason: ${data.reason || 'Payment failure'}

To prevent this:
1. Update your payment method
2. Ensure sufficient funds
3. Contact your bank if needed

Update Payment: ${data.billingUrl || '[Billing Portal Link]'}`,

    double_billing_detected: `${greeting}

We detected that you have multiple active subscriptions!

Active subscriptions:
${data.subscriptions?.map((s: any) => `- ${s.plan} ($${s.amount}/month)`).join('\n') || '- Multiple subscriptions'}

We've automatically kept your highest tier subscription and cancelled the others to prevent double billing.

If you have questions, please contact support.`,

    subscription_renewed: `${greeting}

Your subscription has been renewed!

Plan: ${data.plan || 'Premium'}
Amount: $${data.amount || 'N/A'}
Next billing date: ${data.nextBillingDate || 'Unknown'}

Thank you for your continued support!`,

    payment_requires_action: `${greeting}

Your payment requires additional verification (3D Secure).

Your bank requires you to verify this payment before it can be processed. This is a security measure to protect your account.

Please complete the verification:
1. Check your email or banking app for a verification request
2. Follow the instructions from your bank to approve the payment
3. Once verified, your payment will be processed automatically

If you don't complete verification within 24 hours, the payment may fail.

Need help? Reply to this email or contact support.`,
  };

  return templates[event] || `${greeting}\n\nYou have a subscription update.`;
}

/**
 * Notify user about payment failure
 */
export async function notifyPaymentFailed(
  userId: string,
  attemptCount: number,
  daysRemaining: number,
): Promise<void> {
  await sendSubscriptionNotification({
    userId,
    event: 'payment_failed',
    priority: attemptCount >= 3 ? 'critical' : 'high',
    data: {
      attemptCount,
      daysRemaining,
      billingUrl: `${process.env.NEXT_PUBLIC_APP_URL}/billing`,
    },
  });
}

/**
 * Notify user about successful payment
 */
export async function notifyPaymentSucceeded(
  userId: string,
  amount: number,
  plan: string,
  nextBillingDate: string,
): Promise<void> {
  await sendSubscriptionNotification({
    userId,
    event: 'payment_succeeded',
    priority: 'low',
    data: {
      amount: (amount / 100).toFixed(2),
      plan,
      nextBillingDate,
    },
  });
}

/**
 * Notify user about subscription cancellation
 */
export async function notifySubscriptionCancelled(
  userId: string,
  accessUntil: string,
): Promise<void> {
  await sendSubscriptionNotification({
    userId,
    event: 'subscription_cancelled',
    priority: 'medium',
    data: {
      accessUntil,
    },
  });
}

/**
 * Notify user about trial ending soon
 */
export async function notifyTrialEnding(
  userId: string,
  daysRemaining: number,
  hasPaymentMethod: boolean,
): Promise<void> {
  await sendSubscriptionNotification({
    userId,
    event: 'trial_ending',
    priority: 'high',
    data: {
      daysRemaining,
      hasPaymentMethod,
      billingUrl: `${process.env.NEXT_PUBLIC_APP_URL}/billing`,
    },
  });
}

/**
 * Notify user about double billing detection
 */
export async function notifyDoubleBilling(
  userId: string,
  subscriptions: Array<{ plan: string; amount: number }>,
): Promise<void> {
  await sendSubscriptionNotification({
    userId,
    event: 'double_billing_detected',
    priority: 'high',
    data: {
      subscriptions,
    },
  });
}

/**
 * Notify user about grace period
 */
export async function notifyGracePeriod(
  userId: string,
  daysRemaining: number,
): Promise<void> {
  await sendSubscriptionNotification({
    userId,
    event: 'grace_period_warning',
    priority: 'critical',
    data: {
      daysRemaining,
      billingUrl: `${process.env.NEXT_PUBLIC_APP_URL}/billing`,
    },
  });
}

/**
 * Notify user about payment requiring additional action (3D Secure)
 */
export async function notifyPaymentRequiresAction(
  userId: string,
  paymentIntentId: string,
): Promise<void> {
  await sendSubscriptionNotification({
    userId,
    event: 'payment_requires_action',
    priority: 'high',
    data: {
      paymentIntentId,
      billingUrl: `${process.env.NEXT_PUBLIC_APP_URL}/billing`,
    },
  });
}
