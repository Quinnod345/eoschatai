/**
 * Enhanced retry logic with better error detection and recovery
 */
export async function retry<T>(
  fn: () => Promise<T>,
  {
    retries = 3,
    initialDelayMs = 200,
    backoffFactor = 2,
    onRetry,
  }: {
    retries?: number;
    initialDelayMs?: number;
    backoffFactor?: number;
    onRetry?: (attempt: number, error: any) => void;
  } = {},
): Promise<T> {
  let attempt = 0;
  let delay = initialDelayMs;

  while (true) {
    try {
      return await fn();
    } catch (error: any) {
      attempt++;

      // If we've exhausted retries, rethrow
      if (attempt > retries) {
        console.error(
          `[DB Retry] Failed after ${retries} attempts:`,
          error?.message,
        );
        throw error;
      }

      const errorMessage = error?.message || '';
      const errorCode = error?.code || '';

      // Determine if error is retryable
      const shouldRetry = isRetryableDbError(errorMessage, errorCode);

      if (!shouldRetry) {
        console.error(
          '[DB Retry] Non-retryable error, failing immediately:',
          errorMessage,
        );
        throw error;
      }

      // Calculate delay with jitter to avoid thundering herd
      const jitter = Math.random() * 0.3 * delay; // +/- 30% jitter
      const actualDelay = delay + jitter;

      console.warn(
        `[DB Retry] Attempt ${attempt}/${retries} failed, retrying in ${Math.round(actualDelay)}ms:`,
        errorMessage,
      );

      // Call onRetry callback if provided
      if (onRetry) {
        onRetry(attempt, error);
      }

      // Wait before next attempt (exponential backoff with jitter)
      await new Promise((resolve) => setTimeout(resolve, actualDelay));
      delay *= backoffFactor;
    }
  }
}

/**
 * Determine if a database error is retryable
 */
function isRetryableDbError(errorMessage: string, errorCode: string): boolean {
  const retryablePatterns = [
    // Network/Connection errors
    /CONNECTION_CLOSED/i,
    /ECONNRESET/i,
    /ECONNREFUSED/i,
    /ETIMEDOUT/i,
    /NetworkError/i,
    /Connection terminated/i,
    /Connection lost/i,
    /Socket closed/i,

    // Database-specific retryable errors
    /deadlock/i,
    /lock timeout/i,
    /could not serialize/i,
    /serialization failure/i,
    /connection pool/i,
    /too many connections/i,
    /server closed the connection/i,
    /terminating connection due to administrator command/i,

    // Temporary errors
    /temporary/i,
    /transient/i,
  ];

  // Check error codes (PostgreSQL error codes)
  const retryableErrorCodes = [
    '40001', // serialization_failure
    '40P01', // deadlock_detected
    '53300', // too_many_connections
    '57P01', // admin_shutdown
    '57P02', // crash_shutdown
    '57P03', // cannot_connect_now
    '58000', // system_error
    '58030', // io_error
  ];

  // Check if error message matches any retryable pattern
  const messageMatch = retryablePatterns.some((pattern) =>
    pattern.test(errorMessage),
  );

  // Check if error code is retryable
  const codeMatch = retryableErrorCodes.includes(errorCode);

  return messageMatch || codeMatch;
}

/**
 * Retry with custom error classification
 */
export async function retryWithClassification<T>(
  fn: () => Promise<T>,
  options: {
    retries?: number;
    context?: string;
  } = {},
): Promise<T> {
  const { retries = 3, context } = options;

  return retry(fn, {
    retries,
    onRetry: (attempt, error) => {
      // Use our error classifier for better logging
      if (typeof window === 'undefined') {
        // Server-side only - don't import client code
        console.warn(`[DB Retry] ${context || 'Database operation'} failed:`, {
          attempt,
          error: error?.message,
          willRetry: attempt < retries,
        });
      }
    },
  });
}

/**
 * Execute a database query with automatic retry and connection pool monitoring
 */
export async function executeWithRetry<T>(
  queryFn: () => Promise<T>,
  options: {
    operation?: string;
    retries?: number;
  } = {},
): Promise<T> {
  const { operation = 'Database operation', retries = 3 } = options;

  return retryWithClassification(queryFn, {
    retries,
    context: operation,
  });
}





