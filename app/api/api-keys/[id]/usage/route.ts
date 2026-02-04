import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import { apiKey, apiKeyUsage } from '@/lib/db/schema';
import { eq, and, desc, gte, sql } from 'drizzle-orm';

// GET /api/api-keys/[id]/usage - Get usage stats for an API key
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const url = new URL(request.url);
    const days = parseInt(url.searchParams.get('days') || '30', 10);

    if (!id) {
      return NextResponse.json(
        { error: 'API key ID is required' },
        { status: 400 }
      );
    }

    // Check that the key belongs to the user
    const [existingKey] = await db
      .select({
        id: apiKey.id,
        name: apiKey.name,
        usageCount: apiKey.usageCount,
        lastUsedAt: apiKey.lastUsedAt,
        createdAt: apiKey.createdAt,
      })
      .from(apiKey)
      .where(
        and(
          eq(apiKey.id, id),
          eq(apiKey.userId, session.user.id)
        )
      );

    if (!existingKey) {
      return NextResponse.json(
        { error: 'API key not found' },
        { status: 404 }
      );
    }

    // Get date range
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get recent usage logs
    const recentLogs = await db
      .select({
        endpoint: apiKeyUsage.endpoint,
        method: apiKeyUsage.method,
        statusCode: apiKeyUsage.statusCode,
        responseTimeMs: apiKeyUsage.responseTimeMs,
        totalTokens: apiKeyUsage.totalTokens,
        createdAt: apiKeyUsage.createdAt,
      })
      .from(apiKeyUsage)
      .where(
        and(
          eq(apiKeyUsage.apiKeyId, id),
          gte(apiKeyUsage.createdAt, startDate)
        )
      )
      .orderBy(desc(apiKeyUsage.createdAt))
      .limit(100);

    // Aggregate stats
    const aggregateStats = await db
      .select({
        totalRequests: sql<number>`count(*)::int`,
        totalTokens: sql<number>`coalesce(sum(${apiKeyUsage.totalTokens}), 0)::int`,
        avgResponseTime: sql<number>`coalesce(avg(${apiKeyUsage.responseTimeMs}), 0)::int`,
        successCount: sql<number>`count(*) filter (where ${apiKeyUsage.statusCode} >= 200 and ${apiKeyUsage.statusCode} < 300)::int`,
        errorCount: sql<number>`count(*) filter (where ${apiKeyUsage.statusCode} >= 400)::int`,
      })
      .from(apiKeyUsage)
      .where(
        and(
          eq(apiKeyUsage.apiKeyId, id),
          gte(apiKeyUsage.createdAt, startDate)
        )
      );

    // Daily breakdown
    const dailyBreakdown = await db
      .select({
        date: sql<string>`date_trunc('day', ${apiKeyUsage.createdAt})::date::text`,
        requests: sql<number>`count(*)::int`,
        tokens: sql<number>`coalesce(sum(${apiKeyUsage.totalTokens}), 0)::int`,
      })
      .from(apiKeyUsage)
      .where(
        and(
          eq(apiKeyUsage.apiKeyId, id),
          gte(apiKeyUsage.createdAt, startDate)
        )
      )
      .groupBy(sql`date_trunc('day', ${apiKeyUsage.createdAt})`)
      .orderBy(sql`date_trunc('day', ${apiKeyUsage.createdAt})`);

    // Endpoint breakdown
    const endpointBreakdown = await db
      .select({
        endpoint: apiKeyUsage.endpoint,
        method: apiKeyUsage.method,
        requests: sql<number>`count(*)::int`,
        avgResponseTime: sql<number>`coalesce(avg(${apiKeyUsage.responseTimeMs}), 0)::int`,
      })
      .from(apiKeyUsage)
      .where(
        and(
          eq(apiKeyUsage.apiKeyId, id),
          gte(apiKeyUsage.createdAt, startDate)
        )
      )
      .groupBy(apiKeyUsage.endpoint, apiKeyUsage.method)
      .orderBy(sql`count(*) desc`)
      .limit(10);

    return NextResponse.json({
      key: {
        id: existingKey.id,
        name: existingKey.name,
        totalRequests: existingKey.usageCount,
        lastUsedAt: existingKey.lastUsedAt,
        createdAt: existingKey.createdAt,
      },
      period: {
        days,
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString(),
      },
      stats: aggregateStats[0] || {
        totalRequests: 0,
        totalTokens: 0,
        avgResponseTime: 0,
        successCount: 0,
        errorCount: 0,
      },
      daily: dailyBreakdown,
      endpoints: endpointBreakdown,
      recentLogs,
    });
  } catch (error) {
    console.error('Error fetching API key usage:', error);
    return NextResponse.json(
      { error: 'Failed to fetch API key usage' },
      { status: 500 }
    );
  }
}
