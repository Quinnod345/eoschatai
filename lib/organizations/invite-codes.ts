import 'server-only';

import { nanoid } from 'nanoid';
import { getRedisClient } from '@/lib/redis/client';

// Invite code TTL (7 days)
const INVITE_CODE_TTL = 60 * 60 * 24 * 7; // 7 days in seconds

// Redis key generators
const redisKeys = {
  inviteCode: (code: string) => `org:invite:${code}`,
  orgInviteCodes: (orgId: string) => `org:${orgId}:invites`,
  userPendingInvites: (userId: string) => `user:${userId}:pending_invites`,
};

export interface InviteCodeData {
  orgId: string;
  orgName: string;
  createdBy: string;
  createdAt: number;
  expiresAt: number;
  maxUses?: number;
  usedCount: number;
}

/**
 * Generate a new invite code for an organization
 */
export async function generateInviteCode(
  orgId: string,
  orgName: string,
  createdBy: string,
  maxUses?: number,
): Promise<string | null> {
  const redis = getRedisClient();
  if (!redis) {
    console.warn(
      '[org-invites] Redis not available, cannot generate invite code',
    );
    return null;
  }

  // Generate a 6-character uppercase alphanumeric code
  const code = nanoid(6)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

  const now = Date.now();
  const inviteData: InviteCodeData = {
    orgId,
    orgName,
    createdBy,
    createdAt: now,
    expiresAt: now + INVITE_CODE_TTL * 1000,
    maxUses,
    usedCount: 0,
  };

  try {
    // Store the invite code
    // Store as JSON string
    await redis.setex(
      redisKeys.inviteCode(code),
      INVITE_CODE_TTL,
      JSON.stringify(inviteData),
    );

    // Add to organization's invite list
    await redis.sadd(redisKeys.orgInviteCodes(orgId), code);

    return code;
  } catch (error) {
    console.error('[org-invites] Failed to store invite code', error);
    return null;
  }
}

/**
 * Validate and use an invite code
 */
export async function validateInviteCode(
  code: string,
  userId: string,
): Promise<InviteCodeData | null> {
  const redis = getRedisClient();
  if (!redis) {
    console.warn(
      '[org-invites] Redis not available, cannot validate invite code',
    );
    return null;
  }

  try {
    const key = redisKeys.inviteCode(code);
    const data = await redis.get(key);

    if (!data) {
      return null; // Code not found or expired
    }

    // Handle both string and object responses from Redis
    const inviteData: InviteCodeData =
      typeof data === 'string' ? JSON.parse(data) : data;

    // Check if code has expired
    if (Date.now() > inviteData.expiresAt) {
      await redis.del(key);
      await redis.srem(redisKeys.orgInviteCodes(inviteData.orgId), code);
      return null;
    }

    // Check if max uses reached
    if (inviteData.maxUses && inviteData.usedCount >= inviteData.maxUses) {
      return null;
    }

    // Increment usage count
    inviteData.usedCount++;

    if (inviteData.maxUses && inviteData.usedCount >= inviteData.maxUses) {
      // Delete the code if max uses reached
      await redis.del(key);
      await redis.srem(redisKeys.orgInviteCodes(inviteData.orgId), code);
    } else {
      // Update the code with new usage count
      await redis.setex(key, INVITE_CODE_TTL, JSON.stringify(inviteData));
    }

    return inviteData;
  } catch (error) {
    console.error('[org-invites] Failed to validate invite code', error);
    return null;
  }
}

/**
 * Get all active invite codes for an organization
 */
export async function getOrganizationInviteCodes(
  orgId: string,
): Promise<InviteCodeData[]> {
  const redis = getRedisClient();
  if (!redis) {
    return [];
  }

  try {
    const codes = await redis.smembers(redisKeys.orgInviteCodes(orgId));
    const inviteCodes: InviteCodeData[] = [];

    for (const code of codes) {
      const data = await redis.get(redisKeys.inviteCode(code));
      if (data) {
        // Handle both string and object responses from Redis
        const inviteData: InviteCodeData =
          typeof data === 'string' ? JSON.parse(data) : data;
        if (Date.now() <= inviteData.expiresAt) {
          inviteCodes.push(inviteData);
        } else {
          // Clean up expired codes
          await redis.del(redisKeys.inviteCode(code));
          await redis.srem(redisKeys.orgInviteCodes(orgId), code);
        }
      }
    }

    return inviteCodes;
  } catch (error) {
    console.error(
      '[org-invites] Failed to get organization invite codes',
      error,
    );
    return [];
  }
}

/**
 * Revoke an invite code
 */
export async function revokeInviteCode(
  code: string,
  orgId: string,
): Promise<boolean> {
  const redis = getRedisClient();
  if (!redis) {
    return false;
  }

  try {
    await redis.del(redisKeys.inviteCode(code));
    await redis.srem(redisKeys.orgInviteCodes(orgId), code);
    return true;
  } catch (error) {
    console.error('[org-invites] Failed to revoke invite code', error);
    return false;
  }
}

/**
 * Get the current invite code for an organization (or generate one if none exists)
 */
export async function getOrCreateInviteCode(
  orgId: string,
  orgName: string,
  createdBy: string,
): Promise<string | null> {
  // First check if there's an existing valid code
  const existingCodes = await getOrganizationInviteCodes(orgId);

  // Return the first valid code if exists
  if (existingCodes.length > 0) {
    // Find the code from the stored data
    const redis = getRedisClient();
    if (redis) {
      const codes = await redis.smembers(redisKeys.orgInviteCodes(orgId));
      if (codes.length > 0) {
        return codes[0]; // Return the first code
      }
    }
  }

  // Generate a new code if none exists
  return generateInviteCode(orgId, orgName, createdBy);
}
