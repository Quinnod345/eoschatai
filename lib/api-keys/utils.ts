import { createHash, randomBytes } from 'crypto';

const API_KEY_PREFIX = 'eos_';
const API_KEY_LENGTH = 32; // 32 bytes = 64 hex chars

/**
 * Generate a new API key
 * Returns the full key (to show once) and the hash (to store)
 */
export function generateApiKey(): {
  fullKey: string;
  keyHash: string;
  keyPrefix: string;
  lastFour: string;
} {
  // Generate random bytes and convert to hex
  const randomPart = randomBytes(API_KEY_LENGTH).toString('hex');
  const fullKey = `${API_KEY_PREFIX}${randomPart}`;
  
  // Hash the key for storage
  const keyHash = hashApiKey(fullKey);
  
  // Get the prefix and last 4 for display
  const keyPrefix = fullKey.substring(0, 8); // "eos_xxxx"
  const lastFour = fullKey.slice(-4);
  
  return { fullKey, keyHash, keyPrefix, lastFour };
}

/**
 * Hash an API key for secure storage
 */
export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

/**
 * Verify an API key against a stored hash
 */
export function verifyApiKey(key: string, storedHash: string): boolean {
  const keyHash = hashApiKey(key);
  return keyHash === storedHash;
}

/**
 * Mask an API key for display (e.g., "eos_xxxx...abc1")
 */
export function maskApiKey(keyPrefix: string, lastFour: string): string {
  return `${keyPrefix}...${lastFour}`;
}
