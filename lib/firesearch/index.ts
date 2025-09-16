/**
 * Firesearch Integration
 * Main entry point for Firesearch functionality
 */

export * from './types';
export * from './service';
export * from './config';
export { FiresearchRedisStorage } from './redis-storage';

import { FiresearchService } from './service';
import { getFiresearchConfig } from './config';

// Singleton instance
let firesearchInstance: FiresearchService | null = null;

/**
 * Get or create Firesearch service instance
 */
export function getFiresearchService(): FiresearchService {
  if (!firesearchInstance) {
    firesearchInstance = new FiresearchService(getFiresearchConfig());
  }
  return firesearchInstance;
}
