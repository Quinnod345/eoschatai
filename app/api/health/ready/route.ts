/**
 * EOSAI Readiness Probe
 *
 * Kubernetes-style readiness probe that indicates whether the application
 * is ready to receive traffic. Checks all critical dependencies.
 *
 * Returns 200 if ready, 503 if not ready.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

/**
 * Check if the application is ready to serve traffic
 */
async function checkReadiness(): Promise<{ ready: boolean; reason?: string }> {
  // Check database connectivity - required for readiness
  try {
    await db.execute(sql`SELECT 1`);
  } catch (error) {
    return {
      ready: false,
      reason: 'Database not available',
    };
  }

  // Check Redis if configured (optional but logged)
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      const { Redis } = await import('@upstash/redis');
      const redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      });
      await redis.ping();
    } catch (error) {
      // Redis failure is degraded but not blocking
      console.warn('[health/ready] Redis check failed:', error);
    }
  }

  return { ready: true };
}

/**
 * GET /api/health/ready
 *
 * Readiness probe for Kubernetes/load balancers
 */
export async function GET(request: NextRequest) {
  const { ready, reason } = await checkReadiness();

  if (ready) {
    return NextResponse.json(
      {
        status: 'ready',
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  }

  return NextResponse.json(
    {
      status: 'not_ready',
      reason,
      timestamp: new Date().toISOString(),
    },
    { status: 503 }
  );
}
