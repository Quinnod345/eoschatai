/**
 * Timeout utilities for AI generation
 */

/**
 * Default timeout for AI generation: 5 minutes
 */
export const DEFAULT_AI_TIMEOUT = 5 * 60 * 1000;

/**
 * Execute a function with a timeout
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs = DEFAULT_AI_TIMEOUT,
  errorMessage = 'Operation timed out',
): Promise<T> {
  let timeoutHandle: NodeJS.Timeout | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(errorMessage));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

/**
 * Abort controller with timeout
 */
export class TimeoutController {
  private controller: AbortController;
  private timeoutHandle?: NodeJS.Timeout;

  constructor(timeoutMs: number = DEFAULT_AI_TIMEOUT) {
    this.controller = new AbortController();
    this.timeoutHandle = setTimeout(() => {
      this.controller.abort();
    }, timeoutMs);
  }

  get signal(): AbortSignal {
    return this.controller.signal;
  }

  abort(): void {
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = undefined;
    }
    this.controller.abort();
  }

  dispose(): void {
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = undefined;
    }
  }
}


