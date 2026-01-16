import 'server-only';

import { db } from '@/lib/db';
import { user, userDocuments } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';

export interface StorageStats {
  used: number; // bytes
  quota: number; // bytes
  percentage: number; // 0-100
  available: number; // bytes
  usedMB: number;
  quotaMB: number;
  availableMB: number;
}

/**
 * Calculate total storage used by a user across all documents
 */
export async function calculateUserStorage(userId: string): Promise<number> {
  const result = await db
    .select({
      total: sql<number>`COALESCE(SUM(${userDocuments.fileSize}), 0)`,
    })
    .from(userDocuments)
    .where(eq(userDocuments.userId, userId));

  return Number(result[0]?.total || 0);
}

/**
 * Update the storage quota for a user
 */
export async function updateUserStorageQuota(
  userId: string,
  newQuotaBytes: number,
): Promise<void> {
  await db
    .update(user)
    .set({ storageQuota: newQuotaBytes })
    .where(eq(user.id, userId));
}

/**
 * Check if adding additional bytes would exceed the user's quota
 */
export async function checkStorageQuota(
  userId: string,
  additionalBytes: number,
): Promise<{ allowed: boolean; currentUsed: number; quota: number }> {
  // Get user's current storage stats
  const [userData] = await db
    .select({
      storageUsed: user.storageUsed,
      storageQuota: user.storageQuota,
    })
    .from(user)
    .where(eq(user.id, userId));

  if (!userData) {
    throw new Error('User not found');
  }

  const currentUsed = userData.storageUsed;
  const quota = userData.storageQuota;
  const newTotal = currentUsed + additionalBytes;

  return {
    allowed: newTotal <= quota,
    currentUsed,
    quota,
  };
}

/**
 * Get detailed storage statistics for a user
 */
export async function getStorageStats(userId: string): Promise<StorageStats> {
  const [userData] = await db
    .select({
      storageUsed: user.storageUsed,
      storageQuota: user.storageQuota,
    })
    .from(user)
    .where(eq(user.id, userId));

  if (!userData) {
    throw new Error('User not found');
  }

  const used = userData.storageUsed;
  const quota = userData.storageQuota;
  const available = Math.max(0, quota - used);
  const percentage = quota > 0 ? Math.min(100, (used / quota) * 100) : 0;

  return {
    used,
    quota,
    percentage,
    available,
    usedMB: Math.round((used / (1024 * 1024)) * 100) / 100,
    quotaMB: Math.round((quota / (1024 * 1024)) * 100) / 100,
    availableMB: Math.round((available / (1024 * 1024)) * 100) / 100,
  };
}

/**
 * Update user's storage used counter after upload/delete
 */
export async function updateUserStorage(
  userId: string,
  bytesChange: number,
): Promise<void> {
  await db
    .update(user)
    .set({
      storageUsed: sql`GREATEST(0, ${user.storageUsed} + ${bytesChange})`,
    })
    .where(eq(user.id, userId));
}

/**
 * Recalculate and sync user's storage from actual documents
 * Useful for fixing inconsistencies
 */
export async function syncUserStorage(userId: string): Promise<number> {
  const actualUsed = await calculateUserStorage(userId);

  await db
    .update(user)
    .set({ storageUsed: actualUsed })
    .where(eq(user.id, userId));

  return actualUsed;
}

/**
 * Get storage breakdown by category
 */
export async function getStorageByCategory(userId: string): Promise<
  Array<{
    category: string;
    size: number;
    count: number;
    percentage: number;
  }>
> {
  const results = await db
    .select({
      category: userDocuments.category,
      size: sql<number>`SUM(${userDocuments.fileSize})`,
      count: sql<number>`COUNT(*)`,
    })
    .from(userDocuments)
    .where(eq(userDocuments.userId, userId))
    .groupBy(userDocuments.category);

  const total = results.reduce((sum, item) => sum + Number(item.size), 0);

  return results.map((item) => ({
    category: item.category,
    size: Number(item.size),
    count: Number(item.count),
    percentage: total > 0 ? (Number(item.size) / total) * 100 : 0,
  }));
}

/**
 * Check if user can upload a file of given size
 */
export async function canUpload(
  userId: string,
  fileSize: number,
): Promise<{
  allowed: boolean;
  reason?: string;
  currentUsed: number;
  quota: number;
  availableSpace: number;
}> {
  const check = await checkStorageQuota(userId, fileSize);

  if (!check.allowed) {
    const available = check.quota - check.currentUsed;
    return {
      allowed: false,
      reason: `Storage quota exceeded. Need ${Math.ceil(fileSize / (1024 * 1024))}MB, but only ${Math.ceil(available / (1024 * 1024))}MB available.`,
      currentUsed: check.currentUsed,
      quota: check.quota,
      availableSpace: available,
    };
  }

  return {
    allowed: true,
    currentUsed: check.currentUsed,
    quota: check.quota,
    availableSpace: check.quota - check.currentUsed,
  };
}

/**
 * Atomically check quota and reserve storage space using a transaction with row-level locking.
 * This prevents race conditions where concurrent uploads could exceed the quota.
 * 
 * @param userId - The user's ID
 * @param fileSize - Size of the file to upload in bytes
 * @returns Object with allowed status, and storage info. If allowed, storage is already reserved.
 */
export async function reserveStorageAtomic(
  userId: string,
  fileSize: number,
): Promise<{
  allowed: boolean;
  reason?: string;
  currentUsed: number;
  quota: number;
  availableSpace: number;
}> {
  return await db.transaction(async (tx) => {
    // Lock the user row for update to prevent concurrent modifications
    const [userData] = await tx
      .select({
        storageUsed: user.storageUsed,
        storageQuota: user.storageQuota,
      })
      .from(user)
      .where(eq(user.id, userId))
      .for('update');

    if (!userData) {
      throw new Error('User not found');
    }

    const currentUsed = userData.storageUsed;
    const quota = userData.storageQuota;
    const newTotal = currentUsed + fileSize;
    const availableSpace = Math.max(0, quota - currentUsed);

    if (newTotal > quota) {
      // Not allowed - don't update storage
      return {
        allowed: false,
        reason: `Storage quota exceeded. Need ${Math.ceil(fileSize / (1024 * 1024))}MB, but only ${Math.ceil(availableSpace / (1024 * 1024))}MB available.`,
        currentUsed,
        quota,
        availableSpace,
      };
    }

    // Reserve the space atomically
    await tx
      .update(user)
      .set({ storageUsed: newTotal })
      .where(eq(user.id, userId));

    return {
      allowed: true,
      currentUsed: newTotal,
      quota,
      availableSpace: quota - newTotal,
    };
  });
}

/**
 * Release reserved storage space (e.g., when upload fails after reservation)
 * 
 * @param userId - The user's ID
 * @param fileSize - Size of the space to release in bytes
 */
export async function releaseStorageReservation(
  userId: string,
  fileSize: number,
): Promise<void> {
  await db
    .update(user)
    .set({
      storageUsed: sql`GREATEST(0, ${user.storageUsed} - ${fileSize})`,
    })
    .where(eq(user.id, userId));
}


