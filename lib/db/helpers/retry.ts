export async function retry<T>(
  fn: () => Promise<T>,
  {
    retries = 3,
    initialDelayMs = 200,
    backoffFactor = 2,
  }: {
    retries?: number;
    initialDelayMs?: number;
    backoffFactor?: number;
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
        throw error;
      }

      // For connection closed / network errors, retry. Otherwise, bail immediately.
      const errorMessage = error?.message || '';
      const shouldRetry =
        /CONNECTION_CLOSED|ECONNRESET|ETIMEDOUT|NetworkError/i.test(
          errorMessage,
        );

      if (!shouldRetry) {
        throw error;
      }

      // Wait before next attempt (simple exponential backoff)
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= backoffFactor;
    }
  }
}
