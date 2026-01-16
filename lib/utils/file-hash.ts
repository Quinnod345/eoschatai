/**
 * Compute SHA-256 hash of a file for duplicate detection
 * Uses Web Crypto API for client-side hashing
 */
export async function computeFileHash(file: File): Promise<string> {
  // Read file as ArrayBuffer
  const buffer = await file.arrayBuffer();

  // Compute SHA-256 hash
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);

  // Convert to hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

  return hashHex;
}

/**
 * Compute hash of a string (for server-side use)
 */
export async function computeStringHash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * Compute hash with progress callback for large files
 */
export async function computeFileHashWithProgress(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<string> {
  const chunkSize = 1024 * 1024; // 1MB chunks
  const chunks = Math.ceil(file.size / chunkSize);
  const crypto = globalThis.crypto;

  // For smaller files, use simple approach
  if (file.size < chunkSize * 10) {
    return computeFileHash(file);
  }

  // For larger files, hash in chunks
  // Note: This requires streaming digest which isn't universally supported
  // Fallback to simpler approach for now
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

  if (onProgress) {
    onProgress(100);
  }

  return hashHex;
}


