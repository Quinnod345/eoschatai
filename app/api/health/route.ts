/**
 * EOSAI Health Check Endpoint
 *
 * Returns comprehensive health status including:
 * - Application status
 * - Database connectivity
 * - Redis/cache connectivity
 * - Version and uptime information
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

// Track process start time for uptime calculation
const startTime = Date.now();

// Import version from package.json
const packageJson = require('@/package.json');

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface HealthCheck {
  name: string;
  status: HealthStatus;
  latency_ms?: number;
  message?: string;
}

export interface HealthResponse {
  status: HealthStatus;
  timestamp: string;
  version: string;
  uptime_seconds: number;
  checks: HealthCheck[];
}

/**
 * Check database connectivity
 */
async function checkDatabase(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    // Simple query to verify database connection
    await db.execute(sql`SELECT 1`);
    return {
      name: 'database',
      status: 'healthy',
      latency_ms: Date.now() - start,
    };
  } catch (error) {
    return {
      name: 'database',
      status: 'unhealthy',
      latency_ms: Date.now() - start,
      message: error instanceof Error ? error.message : 'Database connection failed',
    };
  }
}

/**
 * Check Redis/cache connectivity (if configured)
 */
async function checkRedis(): Promise<HealthCheck> {
  const start = Date.now();
  
  // Check if Redis is configured
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return {
      name: 'redis',
      status: 'healthy',
      latency_ms: 0,
      message: 'Redis not configured (optional)',
    };
  }

  try {
    // Dynamic import to handle cases where Redis is not installed
    const { Redis } = await import('@upstash/redis');
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });

    // Simple ping to verify connection
    await redis.ping();
    
    return {
      name: 'redis',
      status: 'healthy',
      latency_ms: Date.now() - start,
    };
  } catch (error) {
    return {
      name: 'redis',
      status: 'degraded',
      latency_ms: Date.now() - start,
      message: error instanceof Error ? error.message : 'Redis connection failed',
    };
  }
}

/**
 * Aggregate overall health status from individual checks
 */
function aggregateStatus(checks: HealthCheck[]): HealthStatus {
  const hasUnhealthy = checks.some((c) => c.status === 'unhealthy');
  const hasDegraded = checks.some((c) => c.status === 'degraded');

  if (hasUnhealthy) return 'unhealthy';
  if (hasDegraded) return 'degraded';
  return 'healthy';
}

/**
 * GET /api/health
 * 
 * Returns comprehensive health status
 */
export async function GET(request: NextRequest) {
  const checks = await Promise.all([
    checkDatabase(),
    checkRedis(),
  ]);

  const status = aggregateStatus(checks);
  const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);

  const response: HealthResponse = {
    status,
    timestamp: new Date().toISOString(),
    version: packageJson.version,
    uptime_seconds: uptimeSeconds,
    checks,
  };

  // Return 200 for healthy/degraded, 503 for unhealthy
  const httpStatus = status === 'unhealthy' ? 503 : 200;

  return NextResponse.json(response, { status: httpStatus });
}
