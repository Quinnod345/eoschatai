/**
 * Client-safe URL utility functions
 */

/**
 * Determines if running in Node.js environment - client-safe version
 */
export function isNodeEnvironment(): boolean {
  return (
    typeof window === 'undefined' &&
    typeof process !== 'undefined' &&
    process.versions != null &&
    process.versions.node != null
  );
}

/**
 * Get the base URL for API requests - client-safe version
 */
export function getBaseUrl(): string {
  if (typeof window !== 'undefined') {
    // Client-side: use the window location
    return window.location.origin;
  } else if (
    typeof process !== 'undefined' &&
    process.env?.NEXT_PUBLIC_BASE_URL
  ) {
    // Server-side: use the environment variable if available
    return process.env.NEXT_PUBLIC_BASE_URL;
  } else {
    // Fallback
    return 'http://localhost:3000';
  }
}

/**
 * Safely create a URL with error handling - client-safe version
 */
export function safeCreateURL(path: string, baseUrl?: string): URL {
  try {
    // Determine the base URL to use
    let effectiveBaseUrl: string;
    const isNode = isNodeEnvironment();
    console.log(
      `Creating URL for path: ${path}, in Node environment: ${isNode}`,
    );

    // Check if we're in a browser environment
    if (typeof window !== 'undefined') {
      effectiveBaseUrl = window.location.origin;
      console.log(
        `Browser detected, using window.location.origin: ${effectiveBaseUrl}`,
      );
    }
    // If baseUrl is provided, use it
    else if (baseUrl) {
      effectiveBaseUrl = baseUrl;
      console.log(`Using provided baseUrl: ${baseUrl}`);
    }
    // Use environment variable as a fallback
    else if (
      isNode &&
      typeof process !== 'undefined' &&
      process.env?.NEXT_PUBLIC_BASE_URL
    ) {
      effectiveBaseUrl = process.env.NEXT_PUBLIC_BASE_URL;
      console.log('Using NEXT_PUBLIC_BASE_URL:', effectiveBaseUrl);
    }
    // Last resort fallback
    else {
      effectiveBaseUrl = 'http://localhost:3000';
      console.warn('No base URL found, using fallback URL:', effectiveBaseUrl);
    }

    // For server-side API calls, ensure we're using an absolute URL
    if (isNode && path.startsWith('/api/')) {
      if (!effectiveBaseUrl.endsWith('/')) {
        effectiveBaseUrl += '/';
      }
      // Remove the leading slash from path to avoid double slashes
      const trimmedPath = path.startsWith('/') ? path.substring(1) : path;
      const fullUrl = new URL(trimmedPath, effectiveBaseUrl);
      console.log('Created server-side API URL:', fullUrl.toString());
      return fullUrl;
    }

    // Create and return the URL
    const url = new URL(path, effectiveBaseUrl);
    console.log('Created URL:', url.toString());
    return url;
  } catch (error) {
    console.error('Error creating URL:', error);
    throw new Error(`Failed to create URL for path: ${path}`);
  }
}
