/**
 * Structured Logger
 *
 * A lightweight structured logging utility that:
 * - Uses console.log/warn/error under the hood
 * - Outputs JSON in production for log aggregation
 * - Includes timestamp, level, message, and context
 * - Automatically redacts sensitive data
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  requestId?: string;
  context?: LogContext;
}

// Sensitive field patterns that should never be logged
const SENSITIVE_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /api[_-]?key/i,
  /bearer/i,
  /authorization/i,
  /credential/i,
  /private[_-]?key/i,
  /access[_-]?key/i,
  /session[_-]?id/i,
  /cookie/i,
  /auth/i,
];

// Values that look like secrets (long alphanumeric strings, JWTs, etc.)
const SECRET_VALUE_PATTERNS = [
  /^ey[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/, // JWT
  /^sk[-_][A-Za-z0-9]{20,}$/, // API keys (sk-...)
  /^pk[-_][A-Za-z0-9]{20,}$/, // API keys (pk-...)
  /^[A-Za-z0-9]{32,}$/, // Long alphanumeric strings
];

const REDACTED = '[REDACTED]';

/**
 * Check if a key name is sensitive
 */
function isSensitiveKey(key: string): boolean {
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(key));
}

/**
 * Check if a value looks like a secret
 */
function isSensitiveValue(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  return SECRET_VALUE_PATTERNS.some((pattern) => pattern.test(value));
}

/**
 * Recursively redact sensitive data from an object
 */
function redactSensitive(obj: unknown, depth = 0): unknown {
  // Prevent infinite recursion
  if (depth > 10) return '[MAX_DEPTH]';

  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return isSensitiveValue(obj) ? REDACTED : obj;
  }

  if (typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => redactSensitive(item, depth + 1));
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (isSensitiveKey(key)) {
      result[key] = REDACTED;
    } else {
      result[key] = redactSensitive(value, depth + 1);
    }
  }
  return result;
}

/**
 * Determine if we're in production mode
 */
function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Get the minimum log level from environment
 */
function getMinLevel(): LogLevel {
  const level = process.env.LOG_LEVEL?.toLowerCase();
  if (level === 'debug' || level === 'info' || level === 'warn' || level === 'error') {
    return level;
  }
  return isProduction() ? 'info' : 'debug';
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Check if a log level should be logged
 */
function shouldLog(level: LogLevel): boolean {
  const minLevel = getMinLevel();
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[minLevel];
}

/**
 * Format a log entry for output
 */
function formatLog(entry: LogEntry): string {
  if (isProduction()) {
    // JSON output for production (log aggregation friendly)
    return JSON.stringify(entry);
  }

  // Human-readable output for development
  const { timestamp, level, message, requestId, context } = entry;
  const levelColors: Record<LogLevel, string> = {
    debug: '\x1b[36m', // cyan
    info: '\x1b[32m', // green
    warn: '\x1b[33m', // yellow
    error: '\x1b[31m', // red
  };
  const reset = '\x1b[0m';
  const dim = '\x1b[2m';

  let output = `${dim}${timestamp}${reset} ${levelColors[level]}${level.toUpperCase().padEnd(5)}${reset} ${message}`;

  if (requestId) {
    output += ` ${dim}[${requestId}]${reset}`;
  }

  if (context && Object.keys(context).length > 0) {
    output += ` ${dim}${JSON.stringify(context)}${reset}`;
  }

  return output;
}

/**
 * Core logging function
 */
function log(level: LogLevel, message: string, context?: LogContext, requestId?: string): void {
  if (!shouldLog(level)) return;

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(requestId && { requestId }),
    ...(context && Object.keys(context).length > 0 && {
      context: redactSensitive(context) as LogContext,
    }),
  };

  const formatted = formatLog(entry);

  switch (level) {
    case 'debug':
    case 'info':
      console.log(formatted);
      break;
    case 'warn':
      console.warn(formatted);
      break;
    case 'error':
      console.error(formatted);
      break;
  }
}

/**
 * Create a logger instance with optional default context
 */
export function createLogger(defaultContext?: LogContext) {
  const baseContext = defaultContext ? redactSensitive(defaultContext) as LogContext : {};

  return {
    debug(message: string, context?: LogContext, requestId?: string) {
      log('debug', message, { ...baseContext, ...context }, requestId);
    },
    info(message: string, context?: LogContext, requestId?: string) {
      log('info', message, { ...baseContext, ...context }, requestId);
    },
    warn(message: string, context?: LogContext, requestId?: string) {
      log('warn', message, { ...baseContext, ...context }, requestId);
    },
    error(message: string, context?: LogContext, requestId?: string) {
      log('error', message, { ...baseContext, ...context }, requestId);
    },
  };
}

/**
 * Default logger instance
 */
export const logger = createLogger();

/**
 * Create a child logger with additional context
 */
export function childLogger(context: LogContext) {
  return createLogger(context);
}

/**
 * Create a request-scoped logger with correlation ID
 */
export function requestLogger(requestId: string, context?: LogContext) {
  const baseContext = context || {};
  return {
    debug(message: string, ctx?: LogContext) {
      log('debug', message, { ...baseContext, ...ctx }, requestId);
    },
    info(message: string, ctx?: LogContext) {
      log('info', message, { ...baseContext, ...ctx }, requestId);
    },
    warn(message: string, ctx?: LogContext) {
      log('warn', message, { ...baseContext, ...ctx }, requestId);
    },
    error(message: string, ctx?: LogContext) {
      log('error', message, { ...baseContext, ...ctx }, requestId);
    },
  };
}

export default logger;
