/**
 * Secure logging utility that automatically sanitizes sensitive data
 * Use this instead of console.log for any data that might contain secrets
 */

const SENSITIVE_KEYS = [
  'password',
  'secret',
  'token',
  'key',
  'apiKey',
  'api_key',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'clientSecret',
  'client_secret',
  'authToken',
  'auth_token',
  'sessionToken',
  'session_token',
  'privateKey',
  'private_key',
  'ephemeralKey',
  'ephemeral_key',
  'bearer',
  'authorization',
  'credentials',
  'stripeKey',
  'stripe_key',
];

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface SecureLoggerConfig {
  enabled: boolean;
  level: LogLevel;
  sanitize: boolean;
}

/**
 * Get the current logging configuration based on environment
 */
function getConfig(): SecureLoggerConfig {
  const isDev = process.env.NODE_ENV === 'development';
  const isTest = process.env.NODE_ENV === 'test';

  return {
    enabled: !isTest, // Disable in tests
    level: (process.env.LOG_LEVEL as LogLevel) || (isDev ? 'debug' : 'info'),
    sanitize: true, // Always sanitize, even in dev
  };
}

/**
 * Sanitize sensitive data from an object
 */
function sanitizeValue(value: any, depth = 0): any {
  // Prevent infinite recursion
  if (depth > 10) return '[MAX_DEPTH]';

  // Handle null/undefined
  if (value === null || value === undefined) return value;

  // Handle primitives
  if (typeof value !== 'object') {
    // Check if the value looks like a token (long alphanumeric string)
    if (
      typeof value === 'string' &&
      value.length > 20 &&
      /^[a-zA-Z0-9_-]+$/.test(value)
    ) {
      return `[REDACTED:${value.substring(0, 4)}...${value.substring(value.length - 4)}]`;
    }
    return value;
  }

  // Handle arrays
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, depth + 1));
  }

  // Handle objects
  const sanitized: Record<string, any> = {};
  for (const [key, val] of Object.entries(value)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = SENSITIVE_KEYS.some((sensitiveKey) =>
      lowerKey.includes(sensitiveKey.toLowerCase()),
    );

    if (isSensitive) {
      // Show type and partial info, but redact the actual value
      if (typeof val === 'string') {
        sanitized[key] = `[REDACTED:${val.substring(0, 4)}...]`;
      } else if (typeof val === 'object' && val !== null) {
        sanitized[key] = '[REDACTED:object]';
      } else {
        sanitized[key] = '[REDACTED]';
      }
    } else {
      sanitized[key] = sanitizeValue(val, depth + 1);
    }
  }

  return sanitized;
}

/**
 * Format log message with metadata
 */
function formatMessage(
  level: LogLevel,
  context: string,
  message: string,
  data?: any,
): any[] {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}] [${context}]`;

  if (data === undefined) {
    return [prefix, message];
  }

  const config = getConfig();
  const sanitizedData = config.sanitize ? sanitizeValue(data) : data;

  return [prefix, message, sanitizedData];
}

/**
 * Secure logger class
 */
class SecureLogger {
  private context: string;

  constructor(context: string) {
    this.context = context;
  }

  /**
   * Debug level logging (only in development)
   */
  debug(message: string, data?: any) {
    const config = getConfig();
    if (!config.enabled) return;
    if (config.level !== 'debug') return;

    console.debug(...formatMessage('debug', this.context, message, data));
  }

  /**
   * Info level logging
   */
  info(message: string, data?: any) {
    const config = getConfig();
    if (!config.enabled) return;
    if (config.level === 'error' || config.level === 'warn') return;

    console.info(...formatMessage('info', this.context, message, data));
  }

  /**
   * Warning level logging
   */
  warn(message: string, data?: any) {
    const config = getConfig();
    if (!config.enabled) return;
    if (config.level === 'error') return;

    console.warn(...formatMessage('warn', this.context, message, data));
  }

  /**
   * Error level logging
   */
  error(message: string, error?: any) {
    const config = getConfig();
    if (!config.enabled) return;

    const errorData =
      error instanceof Error
        ? { message: error.message, stack: error.stack, name: error.name }
        : error;

    console.error(...formatMessage('error', this.context, message, errorData));
  }

  /**
   * Log API response (automatically sanitizes)
   */
  apiResponse(endpoint: string, status: number, data?: any) {
    this.info(`API Response: ${endpoint}`, {
      status,
      hasData: !!data,
      dataKeys:
        data && typeof data === 'object' ? Object.keys(data) : undefined,
    });
  }

  /**
   * Log API request (automatically sanitizes)
   */
  apiRequest(endpoint: string, method: string, hasBody: boolean) {
    this.debug(`API Request: ${method} ${endpoint}`, { hasBody });
  }
}

/**
 * Create a logger for a specific context
 */
export function createLogger(context: string): SecureLogger {
  return new SecureLogger(context);
}

/**
 * Quick logger for one-off logs
 */
export const logger = {
  debug: (message: string, data?: any) =>
    createLogger('App').debug(message, data),
  info: (message: string, data?: any) =>
    createLogger('App').info(message, data),
  warn: (message: string, data?: any) =>
    createLogger('App').warn(message, data),
  error: (message: string, error?: any) =>
    createLogger('App').error(message, error),
};

/**
 * Sanitize data for safe logging (exported for manual use)
 */
export { sanitizeValue as sanitize };


