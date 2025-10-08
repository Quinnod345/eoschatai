/**
 * Composer validation utilities
 */

// UUID validation regex
export const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Max content length: 10MB
export const MAX_CONTENT_LENGTH = 10 * 1024 * 1024;

// Max title length
export const MAX_TITLE_LENGTH = 500;

/**
 * Validate document ID format
 */
export function isValidDocumentId(id: string | null | undefined): boolean {
  if (!id) return false;
  return UUID_REGEX.test(id);
}

/**
 * Validate content length (returns size in bytes)
 */
export function getContentSize(content: string): number {
  return new Blob([content]).size;
}

/**
 * Validate content is within size limits
 */
export function isValidContentSize(content: string): boolean {
  return getContentSize(content) <= MAX_CONTENT_LENGTH;
}

/**
 * Validate title length
 */
export function isValidTitle(title: string | null | undefined): boolean {
  if (!title) return false;
  return title.length > 0 && title.length <= MAX_TITLE_LENGTH;
}

/**
 * Comprehensive validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate document data before save
 */
export function validateDocumentData({
  id,
  title,
  content,
}: {
  id: string;
  title?: string;
  content: string;
}): ValidationResult {
  const errors: string[] = [];

  if (!isValidDocumentId(id)) {
    errors.push('Invalid document ID format');
  }

  if (title !== undefined && !isValidTitle(title)) {
    if (!title || title.length === 0) {
      errors.push('Title is required');
    } else {
      errors.push(`Title too long (max ${MAX_TITLE_LENGTH} characters)`);
    }
  }

  if (!isValidContentSize(content)) {
    errors.push(
      `Content too large (max ${MAX_CONTENT_LENGTH / (1024 * 1024)}MB)`,
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Race condition protection - track in-flight saves
 */
const inFlightSaves = new Set<string>();

/**
 * Check if a document save is already in progress
 */
export function isSaveInProgress(documentId: string): boolean {
  return inFlightSaves.has(documentId);
}

/**
 * Mark a document save as in progress
 */
export function markSaveInProgress(documentId: string): void {
  inFlightSaves.add(documentId);
}

/**
 * Mark a document save as complete
 */
export function markSaveComplete(documentId: string): void {
  inFlightSaves.delete(documentId);
}

/**
 * Execute a save with race condition protection
 */
export async function withSaveProtection<T>(
  documentId: string,
  saveFn: () => Promise<T>,
): Promise<T> {
  if (isSaveInProgress(documentId)) {
    throw new Error('Save already in progress for this document');
  }

  markSaveInProgress(documentId);
  try {
    return await saveFn();
  } finally {
    markSaveComplete(documentId);
  }
}


