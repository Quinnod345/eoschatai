/**
 * Environment Variable Validation
 *
 * This module validates critical environment variables at startup.
 * It helps catch configuration issues early and provides clear error messages.
 *
 * Usage: Import and call validateEnv() in instrumentation.ts
 */

type EnvVarConfig = {
  name: string;
  required: boolean;
  description: string;
  category: string;
};

// Define all environment variables with their requirements
const ENV_VARS: EnvVarConfig[] = [
  // Database - at least one required
  {
    name: 'POSTGRES_URL',
    required: false, // One of POSTGRES_URL or DATABASE_URL is required
    description: 'PostgreSQL connection URL (primary)',
    category: 'Database',
  },
  {
    name: 'DATABASE_URL',
    required: false, // Fallback for POSTGRES_URL
    description: 'PostgreSQL connection URL (fallback)',
    category: 'Database',
  },

  // Authentication
  {
    name: 'AUTH_SECRET',
    required: true,
    description: 'NextAuth.js secret for session encryption',
    category: 'Authentication',
  },
  {
    name: 'GOOGLE_CLIENT_ID',
    required: true,
    description: 'Google OAuth client ID',
    category: 'Authentication',
  },
  {
    name: 'GOOGLE_CLIENT_SECRET',
    required: true,
    description: 'Google OAuth client secret',
    category: 'Authentication',
  },

  // AI Providers
  {
    name: 'ANTHROPIC_API_KEY',
    required: true,
    description: 'Anthropic API key (primary AI provider)',
    category: 'AI',
  },
  {
    name: 'OPENAI_API_KEY',
    required: true,
    description: 'OpenAI API key (images, embeddings, voice)',
    category: 'AI',
  },

  // Upstash Redis
  {
    name: 'UPSTASH_REDIS_REST_URL',
    required: false, // Gracefully degraded if missing
    description: 'Upstash Redis REST URL for caching',
    category: 'Cache',
  },
  {
    name: 'UPSTASH_REDIS_REST_TOKEN',
    required: false,
    description: 'Upstash Redis REST token',
    category: 'Cache',
  },

  // Upstash Vector
  {
    name: 'UPSTASH_VECTOR_REST_URL',
    required: false,
    description: 'Upstash Vector URL for RAG',
    category: 'Vector',
  },
  {
    name: 'UPSTASH_VECTOR_REST_TOKEN',
    required: false,
    description: 'Upstash Vector token',
    category: 'Vector',
  },
  {
    name: 'UPSTASH_USER_RAG_REST_URL',
    required: false,
    description: 'User RAG vector store URL',
    category: 'Vector',
  },
  {
    name: 'UPSTASH_USER_RAG_REST_TOKEN',
    required: false,
    description: 'User RAG vector store token',
    category: 'Vector',
  },

  // Stripe
  {
    name: 'STRIPE_SECRET_KEY',
    required: false, // App works without billing
    description: 'Stripe secret key for billing',
    category: 'Billing',
  },
  {
    name: 'STRIPE_WEBHOOK_SECRET',
    required: false,
    description: 'Stripe webhook signing secret',
    category: 'Billing',
  },

  // Email
  {
    name: 'RESEND_API_KEY',
    required: false, // App works without email
    description: 'Resend API key for transactional emails',
    category: 'Email',
  },

  // App URLs
  {
    name: 'NEXT_PUBLIC_APP_URL',
    required: false,
    description: 'Public app URL for OAuth and emails',
    category: 'URLs',
  },
  {
    name: 'NEXT_PUBLIC_BASE_URL',
    required: false,
    description: 'Base URL for API calls',
    category: 'URLs',
  },

  // Cron
  {
    name: 'CRON_SECRET',
    required: false, // Only needed if using cron jobs
    description: 'Secret for authenticating cron requests',
    category: 'Security',
  },
];

type ValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

/**
 * Validates environment variables and returns a result object
 */
export function checkEnv(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check database URL (special case: one of two is required)
  if (!process.env.POSTGRES_URL && !process.env.DATABASE_URL) {
    errors.push(
      'Database URL missing: Set either POSTGRES_URL or DATABASE_URL',
    );
  }

  // Check all required variables
  for (const envVar of ENV_VARS) {
    const value = process.env[envVar.name];

    if (envVar.required && !value) {
      errors.push(`${envVar.name} is required (${envVar.description})`);
    } else if (!envVar.required && !value) {
      // Track optional missing vars for warnings (grouped by category)
      warnings.push(`${envVar.name} not set - ${envVar.description}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates critical environment variables at startup.
 * Logs errors and warnings, but only throws in production for critical vars.
 */
export function validateEnv(): void {
  const result = checkEnv();
  const isProduction = process.env.NODE_ENV === 'production';

  // Always log the validation header
  console.log('[env] Validating environment variables...');

  // Log errors
  if (result.errors.length > 0) {
    console.error('[env] ❌ Missing required environment variables:');
    for (const error of result.errors) {
      console.error(`  - ${error}`);
    }

    // In production, throw to prevent startup with missing critical vars
    if (isProduction) {
      throw new Error(
        `Missing required environment variables:\n${result.errors.join('\n')}`,
      );
    } else {
      console.warn(
        '[env] ⚠️  Running in development mode with missing vars - some features may not work',
      );
    }
  }

  // Log warnings for optional vars (only in development to reduce noise)
  if (!isProduction && result.warnings.length > 0) {
    // Group warnings by category for cleaner output
    const categories = new Map<string, string[]>();
    for (const envVar of ENV_VARS) {
      if (!process.env[envVar.name] && !envVar.required) {
        const cat = envVar.category;
        if (!categories.has(cat)) categories.set(cat, []);
        categories.get(cat)!.push(envVar.name);
      }
    }

    if (categories.size > 0) {
      console.log('[env] ℹ️  Optional variables not configured:');
      Array.from(categories.entries()).forEach(([category, vars]) => {
        console.log(`  ${category}: ${vars.join(', ')}`);
      });
    }
  }

  if (result.valid) {
    console.log('[env] ✅ All required environment variables are configured');
  }
}

/**
 * Get a required environment variable, throwing if not set.
 * Use this for variables that must be present at runtime.
 */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Required environment variable ${name} is not set`);
  }
  return value;
}

/**
 * Get an optional environment variable with a default value.
 */
export function getEnv(name: string, defaultValue: string = ''): string {
  return process.env[name] || defaultValue;
}

/**
 * Check if an environment variable is set (truthy).
 */
export function hasEnv(name: string): boolean {
  return !!process.env[name];
}

/**
 * Get a boolean environment variable.
 * Returns true for 'true', '1', 'yes'; false otherwise.
 */
export function getBoolEnv(name: string, defaultValue: boolean = false): boolean {
  const value = process.env[name];
  if (!value) return defaultValue;
  return ['true', '1', 'yes'].includes(value.toLowerCase());
}
