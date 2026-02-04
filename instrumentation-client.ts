// This file configures the initialization of Sentry on the client.
// The config you add here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';

// Required for Next.js App Router navigation instrumentation
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

// Patterns to filter out - these are known benign errors from R3F and Three.js
const IGNORED_ERROR_PATTERNS = [
  // R3F internal errors
  /R3F/i,
  /react-three-fiber/i,
  /drei/i,
  // Three.js WebGL context errors (often browser-related, not actionable)
  /WebGL/i,
  /webgl/i,
  /THREE\.WebGLRenderer/i,
  // Canvas/rendering context errors
  /getContext/i,
  /CanvasRenderingContext/i,
  // ResizeObserver errors (browser quirk, not actionable)
  /ResizeObserver loop/i,
  // Post-processing effect errors
  /postprocessing/i,
];

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: 1,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  replaysOnErrorSampleRate: 1.0,

  // This sets the sample rate to be 10%. You may want this to be 100% while
  // in development and sample at a lower rate in production
  replaysSessionSampleRate: 0.1,

  // You can remove this option if you're not planning to use the Sentry Session Replay feature:
  integrations: [
    Sentry.replayIntegration({
      // Additional Replay configuration goes in here, for example:
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],

  // Only enable Sentry if DSN is configured
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Environment configuration
  environment: process.env.NODE_ENV,

  // Filter out known benign errors
  beforeSend(event) {
    // Filter out development errors
    if (process.env.NODE_ENV === 'development') {
      return null;
    }

    // Filter out known R3F/Three.js errors
    const errorMessage = event.exception?.values?.[0]?.value || '';
    const errorType = event.exception?.values?.[0]?.type || '';

    for (const pattern of IGNORED_ERROR_PATTERNS) {
      if (pattern.test(errorMessage) || pattern.test(errorType)) {
        return null;
      }
    }

    return event;
  },

  // Ignore specific error messages completely
  ignoreErrors: [
    // R3F and Three.js related
    'R3F',
    'react-three-fiber',
    'THREE',
    // WebGL context issues
    'WebGL',
    'getContext',
    // ResizeObserver loop errors (browser quirk)
    'ResizeObserver loop limit exceeded',
    'ResizeObserver loop completed with undelivered notifications',
  ],
});
