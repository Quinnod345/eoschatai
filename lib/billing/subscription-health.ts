import 'server-only';

import { db } from '@/lib/db';
import { user as userTable, org as orgTable } from '@/lib/db/schema';
import { eq, isNotNull, sql } from 'drizzle-orm';
import { getStripeClient } from '@/lib/stripe/client';
import { getAllUserSubscriptions } from './subscription-utils';

export interface SubscriptionHealthIssue {
  type:
    | 'double_billing'
    | 'orphaned_subscription'
    | 'missing_customer'
    | 'invalid_metadata'
    | 'seat_mismatch'
    | 'plan_mismatch';
  severity: 'critical' | 'high' | 'medium' | 'low';
  userId?: string;
  orgId?: string;
  stripeCustomerId?: string;
  subscriptionId?: string;
  description: string;
  autoFixable: boolean;
  suggestedAction?: string;
}

export interface SubscriptionHealthReport {
  timestamp: string;
  issues: SubscriptionHealthIssue[];
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    autoFixable: number;
  };
  stats: {
    totalUsers: number;
    totalOrgs: number;
    usersWithSubscriptions: number;
    orgsWithSubscriptions: number;
    doubleBillingUsers: number;
  };
}

/**
 * Scan the entire subscription system for health issues
 */
export async function scanSubscriptionHealth(): Promise<SubscriptionHealthReport> {
  const stripe = getStripeClient();
  if (!stripe) {
    throw new Error('Stripe not configured');
  }

  const issues: SubscriptionHealthIssue[] = [];
  const stats = {
    totalUsers: 0,
    totalOrgs: 0,
    usersWithSubscriptions: 0,
    orgsWithSubscriptions: 0,
    doubleBillingUsers: 0,
  };

  // Get all users with Stripe customer IDs
  const users = await db
    .select({
      id: userTable.id,
      email: userTable.email,
      plan: userTable.plan,
      stripeCustomerId: userTable.stripeCustomerId,
      orgId: userTable.orgId,
      subscriptionSource: userTable.subscriptionSource,
    })
    .from(userTable)
    .where(isNotNull(userTable.stripeCustomerId));

  stats.totalUsers = users.length;

  // Check each user for issues
  for (const user of users) {
    if (!user.stripeCustomerId) continue;
    if (user.subscriptionSource === 'circle') {
      // Stripe checks and auto-fixes should not drive Circle-managed plans.
      continue;
    }

    try {
      // Get all subscriptions for this user
      const subscriptions = await getAllUserSubscriptions(
        user.stripeCustomerId,
        stripe,
      );

      if (subscriptions.length > 0) {
        stats.usersWithSubscriptions++;
      }

      // Check for double billing (multiple individual subscriptions)
      const individualSubs = subscriptions.filter((s) => !s.isOrgBased);
      if (individualSubs.length > 1) {
        stats.doubleBillingUsers++;
        issues.push({
          type: 'double_billing',
          severity: 'critical',
          userId: user.id,
          stripeCustomerId: user.stripeCustomerId,
          description: `User ${user.email} has ${individualSubs.length} individual subscriptions: ${individualSubs.map((s) => s.plan).join(', ')}`,
          autoFixable: true,
          suggestedAction: 'Keep highest plan, cancel others',
        });
      }

      // Check for plan mismatches
      if (subscriptions.length > 0 && !user.orgId) {
        const hasProSub = individualSubs.some((s) => s.plan === 'pro');
        const hasBusinessSub = individualSubs.some(
          (s) => s.plan === 'business',
        );

        const expectedPlan = hasBusinessSub
          ? 'business'
          : hasProSub
            ? 'pro'
            : 'free';

        if (user.plan !== expectedPlan) {
          issues.push({
            type: 'plan_mismatch',
            severity: 'high',
            userId: user.id,
            description: `User plan is ${user.plan} but should be ${expectedPlan} based on active subscriptions`,
            autoFixable: true,
            suggestedAction: `Update user plan to ${expectedPlan}`,
          });
        }
      }
    } catch (error: any) {
      // Check if it's a customer not found error
      if (
        error?.statusCode === 404 ||
        error?.type === 'invalid_request_error'
      ) {
        issues.push({
          type: 'missing_customer',
          severity: 'medium',
          userId: user.id,
          stripeCustomerId: user.stripeCustomerId,
          description: `Stripe customer ${user.stripeCustomerId} not found for user ${user.email}`,
          autoFixable: true,
          suggestedAction: 'Clear invalid customer ID from database',
        });
      }
    }
  }

  // Check organizations
  const orgs = await db
    .select({
      id: orgTable.id,
      name: orgTable.name,
      plan: orgTable.plan,
      seatCount: orgTable.seatCount,
      stripeSubscriptionId: orgTable.stripeSubscriptionId,
      subscriptionSource: orgTable.subscriptionSource,
    })
    .from(orgTable)
    .where(isNotNull(orgTable.stripeSubscriptionId));

  stats.totalOrgs = orgs.length;

  for (const org of orgs) {
    if (!org.stripeSubscriptionId) continue;
    if (org.subscriptionSource === 'circle') {
      // Circle resource-sharing orgs should not be auto-healed using Stripe logic.
      continue;
    }

    stats.orgsWithSubscriptions++;

    try {
      const subscription = await stripe.subscriptions.retrieve(
        org.stripeSubscriptionId,
      );

      // Check seat count mismatch
      const stripeSeats = subscription.items.data[0]?.quantity || 1;
      if (stripeSeats !== org.seatCount) {
        issues.push({
          type: 'seat_mismatch',
          severity: 'high',
          orgId: org.id,
          subscriptionId: org.stripeSubscriptionId,
          description: `Org "${org.name}" has ${org.seatCount} seats in DB but ${stripeSeats} in Stripe`,
          autoFixable: true,
          suggestedAction: `Sync seat count to ${stripeSeats}`,
        });
      }

      // Check metadata
      if (!subscription.metadata?.org_id) {
        issues.push({
          type: 'invalid_metadata',
          severity: 'medium',
          orgId: org.id,
          subscriptionId: org.stripeSubscriptionId,
          description: `Subscription ${org.stripeSubscriptionId} missing org_id metadata`,
          autoFixable: true,
          suggestedAction: `Add org_id: ${org.id} to subscription metadata`,
        });
      }

      // Check for inactive subscriptions
      if (!['active', 'trialing'].includes(subscription.status)) {
        if (org.plan !== 'free') {
          issues.push({
            type: 'plan_mismatch',
            severity: 'high',
            orgId: org.id,
            subscriptionId: org.stripeSubscriptionId,
            description: `Org plan is ${org.plan} but subscription status is ${subscription.status}`,
            autoFixable: true,
            suggestedAction: 'Downgrade org to free plan',
          });
        }
      }
    } catch (error: any) {
      if (
        error?.statusCode === 404 ||
        error?.type === 'invalid_request_error'
      ) {
        issues.push({
          type: 'orphaned_subscription',
          severity: 'high',
          orgId: org.id,
          subscriptionId: org.stripeSubscriptionId,
          description: `Subscription ${org.stripeSubscriptionId} not found in Stripe for org "${org.name}"`,
          autoFixable: true,
          suggestedAction: 'Clear subscription ID and downgrade to free',
        });
      }
    }
  }

  // Generate summary
  const summary = {
    total: issues.length,
    critical: issues.filter((i) => i.severity === 'critical').length,
    high: issues.filter((i) => i.severity === 'high').length,
    medium: issues.filter((i) => i.severity === 'medium').length,
    low: issues.filter((i) => i.severity === 'low').length,
    autoFixable: issues.filter((i) => i.autoFixable).length,
  };

  return {
    timestamp: new Date().toISOString(),
    issues,
    summary,
    stats,
  };
}

/**
 * Automatically fix common subscription issues
 */
export async function autoFixSubscriptionIssues(dryRun = true): Promise<{
  fixed: number;
  failed: number;
  skipped: number;
  details: Array<{ issue: string; action: string; success: boolean }>;
}> {
  const stripe = getStripeClient();
  if (!stripe) {
    throw new Error('Stripe not configured');
  }

  const report = await scanSubscriptionHealth();
  const autoFixableIssues = report.issues.filter((i) => i.autoFixable);

  const details: Array<{ issue: string; action: string; success: boolean }> =
    [];
  let fixed = 0;
  let failed = 0;
  let skipped = 0;

  for (const issue of autoFixableIssues) {
    try {
      if (
        issue.type === 'double_billing' &&
        issue.userId &&
        issue.stripeCustomerId
      ) {
        const action = `Cancel duplicate subscriptions for user ${issue.userId}`;

        if (dryRun) {
          details.push({
            issue: issue.description,
            action: `[DRY RUN] ${action}`,
            success: true,
          });
          skipped++;
        } else {
          // Get all subscriptions
          const subscriptions = await getAllUserSubscriptions(
            issue.stripeCustomerId,
            stripe,
          );

          const individualSubs = subscriptions.filter((s) => !s.isOrgBased);

          // Keep the highest tier subscription, cancel others
          const priority = { business: 3, pro: 2, unknown: 1 };
          individualSubs.sort((a, b) => priority[b.plan] - priority[a.plan]);

          const toKeep = individualSubs[0];
          const toCancel = individualSubs.slice(1);

          // Cancel duplicate subscriptions
          for (const sub of toCancel) {
            await stripe.subscriptions.cancel(sub.id);
          }

          // Notify user about double billing resolution
          const { notifyDoubleBilling } = await import('./notifications');
          await notifyDoubleBilling(
            issue.userId,
            individualSubs.map((s) => ({
              plan: s.plan,
              amount: 0, // Would need to get from Stripe subscription price
            })),
          );

          details.push({
            issue: issue.description,
            action: `Kept ${toKeep.plan} subscription, cancelled ${toCancel.length} others`,
            success: true,
          });
          fixed++;
        }
      } else if (issue.type === 'missing_customer' && issue.userId) {
        const action = `Clear invalid customer ID for user ${issue.userId}`;

        if (dryRun) {
          details.push({
            issue: issue.description,
            action: `[DRY RUN] ${action}`,
            success: true,
          });
          skipped++;
        } else {
          const [currentUser] = await db
            .select({ subscriptionSource: userTable.subscriptionSource })
            .from(userTable)
            .where(eq(userTable.id, issue.userId))
            .limit(1);
          if (currentUser?.subscriptionSource === 'circle') {
            details.push({
              issue: issue.description,
              action:
                'Skipped: user is Circle-managed and should not be downgraded by Stripe auto-fix',
              success: true,
            });
            skipped++;
            continue;
          }

          await db
            .update(userTable)
            .set({ stripeCustomerId: null, plan: 'free' })
            .where(eq(userTable.id, issue.userId));

          details.push({ issue: issue.description, action, success: true });
          fixed++;
        }
      } else if (issue.type === 'orphaned_subscription' && issue.orgId) {
        const action = `Clear orphaned subscription for org ${issue.orgId}`;

        if (dryRun) {
          details.push({
            issue: issue.description,
            action: `[DRY RUN] ${action}`,
            success: true,
          });
          skipped++;
        } else {
          const [currentOrg] = await db
            .select({ subscriptionSource: orgTable.subscriptionSource })
            .from(orgTable)
            .where(eq(orgTable.id, issue.orgId))
            .limit(1);
          if (currentOrg?.subscriptionSource === 'circle') {
            details.push({
              issue: issue.description,
              action:
                'Skipped: org is Circle-managed and should not be downgraded by Stripe auto-fix',
              success: true,
            });
            skipped++;
            continue;
          }

          await db
            .update(orgTable)
            .set({ stripeSubscriptionId: null, plan: 'free' })
            .where(eq(orgTable.id, issue.orgId));

          details.push({ issue: issue.description, action, success: true });
          fixed++;
        }
      } else if (issue.type === 'plan_mismatch' && issue.userId) {
        // Auto-fix plan mismatches
        const action = issue.suggestedAction || 'Update plan';

        if (dryRun) {
          details.push({
            issue: issue.description,
            action: `[DRY RUN] ${action}`,
            success: true,
          });
          skipped++;
        } else {
          // Re-sync entitlements
          const {
            invalidateUserEntitlementsCache,
            getUserEntitlements,
            broadcastEntitlementsUpdated,
          } = await import('@/lib/entitlements');
          await invalidateUserEntitlementsCache(issue.userId);
          await getUserEntitlements(issue.userId);
          await broadcastEntitlementsUpdated(issue.userId);

          details.push({ issue: issue.description, action, success: true });
          fixed++;
        }
      } else if (
        issue.type === 'seat_mismatch' &&
        issue.orgId &&
        issue.subscriptionId
      ) {
        const action = issue.suggestedAction || 'Sync seat count';

        if (dryRun) {
          details.push({
            issue: issue.description,
            action: `[DRY RUN] ${action}`,
            success: true,
          });
          skipped++;
        } else {
          const subscription = await stripe.subscriptions.retrieve(
            issue.subscriptionId,
          );
          const stripeSeats = subscription.items.data[0]?.quantity || 1;

          const { updateOrgSeatCount } = await import(
            '@/lib/organizations/seat-enforcement'
          );
          await updateOrgSeatCount(issue.orgId, stripeSeats);

          details.push({ issue: issue.description, action, success: true });
          fixed++;
        }
      } else if (
        issue.type === 'invalid_metadata' &&
        issue.orgId &&
        issue.subscriptionId
      ) {
        const action = `Add org_id metadata to subscription`;

        if (dryRun) {
          details.push({
            issue: issue.description,
            action: `[DRY RUN] ${action}`,
            success: true,
          });
          skipped++;
        } else {
          await stripe.subscriptions.update(issue.subscriptionId, {
            metadata: { org_id: issue.orgId },
          });

          details.push({ issue: issue.description, action, success: true });
          fixed++;
        }
      } else {
        skipped++;
      }
    } catch (error) {
      console.error('[subscription-health] Failed to fix issue:', error);
      details.push({
        issue: issue.description,
        action: 'Failed to fix',
        success: false,
      });
      failed++;
    }
  }

  return { fixed, failed, skipped, details };
}

/**
 * Get subscription statistics for monitoring
 */
export async function getSubscriptionStats(): Promise<{
  users: {
    total: number;
    free: number;
    pro: number;
    business: number;
    withStripeCustomer: number;
  };
  orgs: {
    total: number;
    free: number;
    business: number;
    withSubscription: number;
    totalSeats: number;
  };
  revenue: {
    estimatedMonthlyRecurring: number;
    activeSubscriptions: number;
  };
}> {
  const stripe = getStripeClient();

  // User statistics
  const userStats = await db
    .select({
      plan: userTable.plan,
      count: sql<number>`count(*)::int`,
      withCustomer: sql<number>`count(CASE WHEN ${userTable.stripeCustomerId} IS NOT NULL THEN 1 END)::int`,
    })
    .from(userTable)
    .groupBy(userTable.plan);

  const users = {
    total: 0,
    free: 0,
    pro: 0,
    business: 0,
    withStripeCustomer: 0,
  };

  for (const stat of userStats) {
    users.total += stat.count;
    users.withStripeCustomer += stat.withCustomer;
    if (stat.plan === 'free') users.free = stat.count;
    if (stat.plan === 'pro') users.pro = stat.count;
    if (stat.plan === 'business') users.business = stat.count;
  }

  // Organization statistics
  const orgStats = await db
    .select({
      plan: orgTable.plan,
      count: sql<number>`count(*)::int`,
      withSubscription: sql<number>`count(CASE WHEN ${orgTable.stripeSubscriptionId} IS NOT NULL THEN 1 END)::int`,
      totalSeats: sql<number>`sum(${orgTable.seatCount})::int`,
    })
    .from(orgTable)
    .groupBy(orgTable.plan);

  const orgs = {
    total: 0,
    free: 0,
    business: 0,
    withSubscription: 0,
    totalSeats: 0,
  };

  for (const stat of orgStats) {
    orgs.total += stat.count;
    orgs.withSubscription += stat.withSubscription;
    orgs.totalSeats += stat.totalSeats || 0;
    if (stat.plan === 'free') orgs.free = stat.count;
    if (stat.plan === 'business') orgs.business = stat.count;
  }

  // Revenue estimation (requires Stripe)
  const revenue = {
    estimatedMonthlyRecurring: 0,
    activeSubscriptions: 0,
  };

  if (stripe) {
    try {
      const subscriptions = await stripe.subscriptions.list({
        status: 'active',
        limit: 100,
      });

      revenue.activeSubscriptions = subscriptions.data.length;

      // Estimate MRR
      for (const sub of subscriptions.data) {
        const amount = sub.items.data[0]?.price?.unit_amount || 0;
        const quantity = sub.items.data[0]?.quantity || 1;
        const interval = sub.items.data[0]?.price?.recurring?.interval;

        let monthlyAmount = amount * quantity;
        if (interval === 'year') {
          monthlyAmount = monthlyAmount / 12;
        }

        revenue.estimatedMonthlyRecurring += monthlyAmount / 100; // Convert cents to dollars
      }
    } catch (error) {
      console.error('[subscription-stats] Failed to get revenue stats:', error);
    }
  }

  return { users, orgs, revenue };
}
