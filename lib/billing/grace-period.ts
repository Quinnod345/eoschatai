import 'server-only';

import { db } from '@/lib/db';
import { user as userTable, org as orgTable } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getRedisClient } from '@/lib/redis/client';

export interface GracePeriodInfo {
  inGracePeriod: boolean;
  reason?: 'payment_failed' | 'trial_ended' | 'past_due';
  startedAt?: string;
  expiresAt?: string;
  daysRemaining?: number;
  subscriptionId?: string;
}

const GRACE_PERIOD_DAYS = 7; // 7 days grace period
const GRACE_PERIOD_KEY_PREFIX = 'grace_period:';

/**
 * Start a grace period for a user or organization
 */
export async function startGracePeriod(
  entityId: string,
  entityType: 'user' | 'org',
  reason: GracePeriodInfo['reason'],
  subscriptionId?: string,
): Promise<void> {
  const redis = getRedisClient();
  if (!redis) {
    console.warn(
      '[grace-period] Redis not available, grace period not tracked',
    );
    return;
  }

  const startedAt = new Date();
  const expiresAt = new Date(startedAt);
  expiresAt.setDate(expiresAt.getDate() + GRACE_PERIOD_DAYS);

  const gracePeriodData: GracePeriodInfo = {
    inGracePeriod: true,
    reason,
    startedAt: startedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    daysRemaining: GRACE_PERIOD_DAYS,
    subscriptionId,
  };

  const key = `${GRACE_PERIOD_KEY_PREFIX}${entityType}:${entityId}`;
  const ttlSeconds = GRACE_PERIOD_DAYS * 24 * 60 * 60;

  try {
    await redis.set(key, JSON.stringify(gracePeriodData), { ex: ttlSeconds });
    console.log(
      `[grace-period] Started grace period for ${entityType} ${entityId} (expires: ${expiresAt.toISOString()})`,
    );
  } catch (error) {
    console.error('[grace-period] Failed to start grace period:', error);
  }
}

/**
 * Get grace period information for a user or organization
 */
export async function getGracePeriod(
  entityId: string,
  entityType: 'user' | 'org',
): Promise<GracePeriodInfo> {
  const redis = getRedisClient();
  if (!redis) {
    return { inGracePeriod: false };
  }

  const key = `${GRACE_PERIOD_KEY_PREFIX}${entityType}:${entityId}`;

  try {
    const data = await redis.get(key);
    if (!data) {
      return { inGracePeriod: false };
    }

    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
    const gracePeriod = parsed as GracePeriodInfo;

    // Calculate days remaining
    if (gracePeriod.expiresAt) {
      const now = new Date();
      const expires = new Date(gracePeriod.expiresAt);
      const msRemaining = expires.getTime() - now.getTime();
      const daysRemaining = Math.max(
        0,
        Math.ceil(msRemaining / (1000 * 60 * 60 * 24)),
      );
      gracePeriod.daysRemaining = daysRemaining;

      // Check if expired
      if (daysRemaining === 0) {
        await endGracePeriod(entityId, entityType);
        return { inGracePeriod: false };
      }
    }

    return gracePeriod;
  } catch (error) {
    console.error('[grace-period] Failed to get grace period:', error);
    return { inGracePeriod: false };
  }
}

/**
 * End a grace period for a user or organization
 */
export async function endGracePeriod(
  entityId: string,
  entityType: 'user' | 'org',
): Promise<void> {
  const redis = getRedisClient();
  if (!redis) {
    return;
  }

  const key = `${GRACE_PERIOD_KEY_PREFIX}${entityType}:${entityId}`;

  try {
    await redis.del(key);
    console.log(
      `[grace-period] Ended grace period for ${entityType} ${entityId}`,
    );
  } catch (error) {
    console.error('[grace-period] Failed to end grace period:', error);
  }
}

/**
 * Check if a user should have premium access despite subscription issues
 * (e.g., during grace period)
 */
export async function shouldGrantPremiumAccess(
  userId: string,
  orgId?: string | null,
): Promise<{
  grant: boolean;
  reason?: string;
  gracePeriod?: GracePeriodInfo;
}> {
  // Check user grace period
  const userGracePeriod = await getGracePeriod(userId, 'user');
  if (userGracePeriod.inGracePeriod) {
    return {
      grant: true,
      reason: `Grace period: ${userGracePeriod.reason} (${userGracePeriod.daysRemaining} days remaining)`,
      gracePeriod: userGracePeriod,
    };
  }

  // Check org grace period
  if (orgId) {
    const orgGracePeriod = await getGracePeriod(orgId, 'org');
    if (orgGracePeriod.inGracePeriod) {
      return {
        grant: true,
        reason: `Organization grace period: ${orgGracePeriod.reason} (${orgGracePeriod.daysRemaining} days remaining)`,
        gracePeriod: orgGracePeriod,
      };
    }
  }

  return { grant: false };
}

/**
 * Send reminders to users in grace period
 * Should be called daily via cron
 */
export async function sendGracePeriodReminders(): Promise<{
  sent: number;
  failed: number;
}> {
  const redis = getRedisClient();
  if (!redis) {
    console.warn('[grace-period] Redis not available, cannot send reminders');
    return { sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;

  try {
    // Get all grace period keys
    const keys = await redis.keys(`${GRACE_PERIOD_KEY_PREFIX}*`);

    for (const key of keys) {
      try {
        const data = await redis.get(key);
        if (!data) continue;

        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        const gracePeriod = parsed as GracePeriodInfo;

        // Calculate days remaining
        if (gracePeriod.expiresAt) {
          const now = new Date();
          const expires = new Date(gracePeriod.expiresAt);
          const msRemaining = expires.getTime() - now.getTime();
          const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));

          // Send reminders at 7, 3, and 1 day(s) remaining
          if ([7, 3, 1].includes(daysRemaining)) {
            const [, entityType, entityId] = key.split(':');

            if (entityType === 'user') {
              // Get user email
              const [user] = await db
                .select({ email: userTable.email })
                .from(userTable)
                .where(eq(userTable.id, entityId));

              if (user?.email) {
                console.log(
                  `[grace-period] Sending reminder to user ${entityId} (${user.email}): ${daysRemaining} days remaining`,
                );

                // Send notification
                const { notifyGracePeriod } = await import('./notifications');
                await notifyGracePeriod(entityId, daysRemaining);
                sent++;
              }
            } else if (entityType === 'org') {
              // Get org owner email
              const [org] = await db
                .select({ ownerId: orgTable.ownerId })
                .from(orgTable)
                .where(eq(orgTable.id, entityId));

              if (org?.ownerId) {
                const [owner] = await db
                  .select({ email: userTable.email })
                  .from(userTable)
                  .where(eq(userTable.id, org.ownerId));

                if (owner?.email) {
                  console.log(
                    `[grace-period] Sending reminder to org ${entityId} owner (${owner.email}): ${daysRemaining} days remaining`,
                  );

                  // Send notification to owner
                  const { notifyGracePeriod } = await import('./notifications');
                  await notifyGracePeriod(org.ownerId, daysRemaining);
                  sent++;
                }
              }
            }
          }
        }
      } catch (error) {
        console.error('[grace-period] Failed to process reminder:', error);
        failed++;
      }
    }
  } catch (error) {
    console.error('[grace-period] Failed to send reminders:', error);
    return { sent: 0, failed: 1 };
  }

  return { sent, failed };
}

/**
 * Clean up expired grace periods
 * Should be called daily via cron
 */
export async function cleanupExpiredGracePeriods(): Promise<{
  cleaned: number;
  downgradedUsers: number;
  downgradedOrgs: number;
}> {
  const redis = getRedisClient();
  if (!redis) {
    return { cleaned: 0, downgradedUsers: 0, downgradedOrgs: 0 };
  }

  let cleaned = 0;
  let downgradedUsers = 0;
  let downgradedOrgs = 0;

  try {
    const keys = await redis.keys(`${GRACE_PERIOD_KEY_PREFIX}*`);

    for (const key of keys) {
      try {
        const data = await redis.get(key);
        if (!data) continue;

        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        const gracePeriod = parsed as GracePeriodInfo;

        if (gracePeriod.expiresAt) {
          const now = new Date();
          const expires = new Date(gracePeriod.expiresAt);

          if (now >= expires) {
            const [, entityType, entityId] = key.split(':');

            // Downgrade to free
            if (entityType === 'user') {
              await db
                .update(userTable)
                .set({ plan: 'free' })
                .where(eq(userTable.id, entityId));
              downgradedUsers++;

              // Invalidate entitlements
              const { invalidateUserEntitlementsCache } = await import(
                '@/lib/entitlements'
              );
              await invalidateUserEntitlementsCache(entityId);

              console.log(
                `[grace-period] Grace period expired for user ${entityId}, downgraded to free`,
              );
            } else if (entityType === 'org') {
              await db
                .update(orgTable)
                .set({ plan: 'free' })
                .where(eq(orgTable.id, entityId));
              downgradedOrgs++;

              // Invalidate entitlements for all members
              const members = await db
                .select({ id: userTable.id })
                .from(userTable)
                .where(eq(userTable.orgId, entityId));

              const { invalidateUserEntitlementsCache } = await import(
                '@/lib/entitlements'
              );
              for (const member of members) {
                await invalidateUserEntitlementsCache(member.id);
              }

              console.log(
                `[grace-period] Grace period expired for org ${entityId}, downgraded to free`,
              );
            }

            // Delete grace period key
            await redis.del(key);
            cleaned++;
          }
        }
      } catch (error) {
        console.error('[grace-period] Failed to clean up grace period:', error);
      }
    }
  } catch (error) {
    console.error(
      '[grace-period] Failed to cleanup expired grace periods:',
      error,
    );
  }

  return { cleaned, downgradedUsers, downgradedOrgs };
}
