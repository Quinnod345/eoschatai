import 'server-only';

import { db } from '@/lib/db';
import { user as userTable } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export type NotificationEvent =
  | 'payment_failed'
  | 'payment_succeeded'
  | 'subscription_cancelled'
  | 'subscription_activated'
  | 'trial_ending'
  | 'grace_period_warning'
  | 'downgrade_warning'
  | 'double_billing_detected'
  | 'subscription_renewed';

export interface NotificationPayload {
  userId: string;
  event: NotificationEvent;
  data: Record<string, any>;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Send a subscription notification to a user
 * This is a centralized notification system that can be extended to support:
 * - Email (via Resend)
 * - In-app notifications
 * - Webhooks
 * - SMS (future)
 */
export async function sendSubscriptionNotification(
  payload: NotificationPayload,
): Promise<void> {
  console.log(
    `[notifications] Sending ${payload.event} notification to user ${payload.userId}`,
  );

  // Get user email
  const [user] = await db
    .select({ email: userTable.email, name: userTable.name })
    .from(userTable)
    .where(eq(userTable.id, payload.userId));

  if (!user?.email) {
    console.warn(
      `[notifications] User ${payload.userId} has no email, skipping notification`,
    );
    return;
  }

  // TODO: Implement email sending via Resend
  // For now, just log what would be sent
  const emailSubject = getEmailSubject(payload.event);
  const emailBody = getEmailBody(payload.event, payload.data, user.name);

  console.log(`[notifications] Would send email to ${user.email}:`);
  console.log(`  Subject: ${emailSubject}`);
  console.log(`  Body: ${emailBody.substring(0, 200)}...`);

  // TODO: Create in-app notification
  // await createInAppNotification(payload);

  // TODO: Send webhook if user has configured one
  // await sendWebhook(payload);
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
