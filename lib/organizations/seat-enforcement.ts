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
  // Get current member count
  const usage = await getOrgSeatUsage(orgId);

  // Prevent reducing seats below current usage
  if (newSeatCount < usage.used) {
    throw new Error(
      `Cannot reduce seats to ${newSeatCount}. Organization has ${usage.used} active members.`,
    );
  }

  // Update seat count
  await db
    .update(orgTable)
    .set({ seatCount: newSeatCount })
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
    .select({ id: userTable.id })
    .from(userTable)
    .where(eq(userTable.orgId, orgId))
    .orderBy(userTable.id) // Skip the first (owner)
    .offset(targetSeatCount) // Keep only up to targetSeatCount
    .limit(excessCount);

  const removedUserIds: string[] = [];

  // Remove excess members
  for (const member of membersToRemove) {
    await db
      .update(userTable)
      .set({ orgId: null })
      .where(eq(userTable.id, member.id));

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
