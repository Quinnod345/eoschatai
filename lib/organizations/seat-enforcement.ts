import 'server-only';

import { db } from '@/lib/db';
import { user as userTable, org as orgTable } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';

/**
 * Check if an organization has available seats
 */
export async function hasAvailableSeats(orgId: string): Promise<boolean> {
  const [org] = await db
    .select({
      seatCount: orgTable.seatCount,
      currentMembers: sql<number>`
        (SELECT COUNT(*) FROM "User" WHERE "orgId" = ${orgTable.id})
      `,
    })
    .from(orgTable)
    .where(eq(orgTable.id, orgId));

  if (!org) {
    return false;
  }

  return Number(org.currentMembers) < org.seatCount;
}

/**
 * Get current seat usage for an organization
 */
export async function getOrgSeatUsage(orgId: string): Promise<{
  used: number;
  total: number;
  available: number;
}> {
  const [org] = await db
    .select({
      seatCount: orgTable.seatCount,
      currentMembers: sql<number>`
        (SELECT COUNT(*) FROM "User" WHERE "orgId" = ${orgTable.id})
      `,
    })
    .from(orgTable)
    .where(eq(orgTable.id, orgId));

  if (!org) {
    return { used: 0, total: 0, available: 0 };
  }

  const used = Number(org.currentMembers);
  const total = org.seatCount;
  const available = Math.max(0, total - used);

  return { used, total, available };
}

/**
 * Enforce seat limits when a user joins an organization
 */
export async function enforceSeatLimit(orgId: string): Promise<void> {
  const hasSeats = await hasAvailableSeats(orgId);

  if (!hasSeats) {
    throw new Error('Organization has reached its seat limit');
  }
}

/**
 * Update organization seat count (usually from Stripe webhook)
 */
export async function updateOrgSeatCount(
  orgId: string,
  newSeatCount: number,
): Promise<void> {
  let normalizedSeatCount = newSeatCount;

  // Validate seat count to prevent invalid data
  if (
    normalizedSeatCount < 1 ||
    normalizedSeatCount > 10000 ||
    !Number.isFinite(normalizedSeatCount)
  ) {
    console.error(
      `[seat-enforcement] Invalid seat count ${normalizedSeatCount}, clamping to valid range`,
    );
    normalizedSeatCount = Math.max(
      1,
      Math.min(10000, Math.floor(normalizedSeatCount)),
    );
  }

  // Get current member count
  const usage = await getOrgSeatUsage(orgId);

  // If reducing seats below current usage, mark for admin action
  if (normalizedSeatCount < usage.used) {
    // Update seat count anyway (Stripe is source of truth)
    // and set pendingRemoval to require admin selection
    await db
      .update(orgTable)
      .set({
        seatCount: normalizedSeatCount,
        pendingRemoval: usage.used - normalizedSeatCount, // Number of members admin must remove
      })
      .where(eq(orgTable.id, orgId));

    console.log(
      `[seat-enforcement] Org ${orgId} reduced from ${usage.used} to ${normalizedSeatCount} seats. Admin must remove ${usage.used - normalizedSeatCount} members.`,
    );
    return;
  }

  // Normal seat count update (increasing or staying same)
  await db
    .update(orgTable)
    .set({
      seatCount: normalizedSeatCount,
      pendingRemoval: 0, // Clear any pending removals
    })
    .where(eq(orgTable.id, orgId));
}

/**
 * Remove excess members when seat count is reduced
 * (This should be handled carefully with proper notifications)
 */
export async function removeExcessMembers(
  orgId: string,
  targetSeatCount: number,
): Promise<string[]> {
  const usage = await getOrgSeatUsage(orgId);
  const excessCount = usage.used - targetSeatCount;

  if (excessCount <= 0) {
    return [];
  }

  // Get members to remove (excluding the owner)
  // In production, you'd have more sophisticated logic for who to remove
  const membersToRemove = await db
    .select({ id: userTable.id, stripeCustomerId: userTable.stripeCustomerId })
    .from(userTable)
    .where(eq(userTable.orgId, orgId))
    .orderBy(userTable.id) // Skip the first (owner)
    .offset(targetSeatCount) // Keep only up to targetSeatCount
    .limit(excessCount);

  const removedUserIds: string[] = [];

  // Get shared utilities
  const { getStripeClient } = await import('@/lib/stripe/client');
  const stripe = getStripeClient();
  const { getUserIndividualSubscriptionPlan } = await import(
    '@/lib/billing/subscription-utils'
  );
  const {
    getUserEntitlements,
    invalidateUserEntitlementsCache,
    broadcastEntitlementsUpdated,
  } = await import('@/lib/entitlements');

  // Remove excess members and reset their plans
  for (const member of membersToRemove) {
    // Check if user has their own individual Stripe subscription
    const individualPlan = stripe
      ? await getUserIndividualSubscriptionPlan(member.stripeCustomerId, stripe)
      : null;
    const newPlan = individualPlan || 'free';

    // Remove from org and reset plan
    await db
      .update(userTable)
      .set({
        orgId: null,
        plan: newPlan,
      })
      .where(eq(userTable.id, member.id));

    // Recompute entitlements for the removed user
    try {
      await invalidateUserEntitlementsCache(member.id);
      await getUserEntitlements(member.id);
      await broadcastEntitlementsUpdated(member.id);
    } catch (error) {
      console.warn(
        '[removeExcessMembers] Failed to update entitlements:',
        error,
      );
    }

    removedUserIds.push(member.id);
  }

  return removedUserIds;
}

/**
 * Check if a user can be added to an organization
 * (considering seat limits)
 */
export async function canAddUserToOrg(
  userId: string,
  orgId: string,
): Promise<{ allowed: boolean; reason?: string }> {
  // Check if user already belongs to an org
  const [user] = await db
    .select({ orgId: userTable.orgId })
    .from(userTable)
    .where(eq(userTable.id, userId));

  if (user?.orgId) {
    return {
      allowed: false,
      reason: 'User already belongs to an organization',
    };
  }

  // Check seat availability
  const hasSeats = await hasAvailableSeats(orgId);

  if (!hasSeats) {
    return {
      allowed: false,
      reason: 'Organization has reached its seat limit',
    };
  }

  return { allowed: true };
}
