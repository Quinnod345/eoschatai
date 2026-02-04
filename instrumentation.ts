// This file configures the initialization of Sentry for the server.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';

export async function register() {
  // Validate environment variables at startup (Node.js runtime only)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { validateEnv } = await import('./lib/env/validate');
    validateEnv();
  }

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Server-side Sentry initialization
    await import('./sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    // Edge runtime Sentry initialization
    await import('./sentry.edge.config');
  }
}

// Capture errors from nested React Server Components
export const onRequestError = Sentry.captureRequestError;
