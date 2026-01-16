/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${Number.parseFloat((bytes / k ** i).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Convert bytes to megabytes
 */
export function bytesToMB(bytes: number): number {
  return bytes / (1024 * 1024);
}

/**
 * Convert megabytes to bytes
 */
export function mbToBytes(mb: number): number {
  return mb * 1024 * 1024;
}

/**
 * Parse storage size string (e.g., "1.5 MB", "500 KB") to bytes
 */
export function parseStorageSize(sizeStr: string): number {
  const match = sizeStr.match(/^([\d.]+)\s*([A-Za-z]+)$/);

  if (!match) {
    throw new Error(`Invalid storage size format: ${sizeStr}`);
  }

  const value = Number.parseFloat(match[1]);
  const unit = match[2].toUpperCase();

  const multipliers: Record<string, number> = {
    B: 1,
    BYTES: 1,
    KB: 1024,
    MB: 1024 * 1024,
    GB: 1024 * 1024 * 1024,
    TB: 1024 * 1024 * 1024 * 1024,
  };

  const multiplier = multipliers[unit];

  if (multiplier === undefined) {
    throw new Error(`Unknown storage unit: ${unit}`);
  }

  return Math.floor(value * multiplier);
}

/**
 * Get storage color code based on percentage used
 */
export function getStorageColor(percentage: number): string {
  if (percentage < 50) return 'green';
  if (percentage < 80) return 'yellow';
  return 'red';
}

/**
 * Get storage status label
 */
export function getStorageStatus(percentage: number): string {
  if (percentage < 50) return 'Good';
  if (percentage < 80) return 'Warning';
  if (percentage < 95) return 'Critical';
  return 'Full';
}

/**
 * Format storage stats for display
 */
export function formatStorageStats(used: number, quota: number): {
  usedFormatted: string;
  quotaFormatted: string;
  availableFormatted: string;
  percentage: number;
  color: string;
  status: string;
} {
  const available = Math.max(0, quota - used);
  const percentage = quota > 0 ? (used / quota) * 100 : 0;

  return {
    usedFormatted: formatBytes(used),
    quotaFormatted: formatBytes(quota),
    availableFormatted: formatBytes(available),
    percentage: Math.round(percentage * 10) / 10,
    color: getStorageColor(percentage),
    status: getStorageStatus(percentage),
  };
}


