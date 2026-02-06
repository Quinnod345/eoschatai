/**
 * EOSAI Liveness Probe
 *
 * Kubernetes-style liveness probe that indicates whether the application
 * process is alive and should not be restarted.
 *
 * This is a lightweight check that does NOT verify external dependencies.
 * Returns 200 if the process is alive.
 */

import { NextRequest, NextResponse } from 'next/server';

// Track process start time
const startTime = Date.now();

/**
 * GET /api/health/live
 *
 * Liveness probe for Kubernetes
 * 
 * This endpoint should always return 200 as long as the process is running.
 * It does NOT check external dependencies (database, Redis, etc.)
 * 
 * If this endpoint fails, Kubernetes should restart the container.
 */
export async function GET(request: NextRequest) {
  const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);

  return NextResponse.json(
    {
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime_seconds: uptimeSeconds,
    },
    { status: 200 }
  );
}
