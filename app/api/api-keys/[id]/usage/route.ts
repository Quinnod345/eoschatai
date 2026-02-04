import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import { apiKey, apiKeyUsageLog } from '@/lib/db/schema';
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
        requestCount: apiKey.requestCount,
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
        endpoint: apiKeyUsageLog.endpoint,
        method: apiKeyUsageLog.method,
        statusCode: apiKeyUsageLog.statusCode,
        responseTimeMs: apiKeyUsageLog.responseTimeMs,
        tokensUsed: apiKeyUsageLog.tokensUsed,
        createdAt: apiKeyUsageLog.createdAt,
      })
      .from(apiKeyUsageLog)
      .where(
        and(
          eq(apiKeyUsageLog.apiKeyId, id),
          gte(apiKeyUsageLog.createdAt, startDate)
        )
      )
      .orderBy(desc(apiKeyUsageLog.createdAt))
      .limit(100);

    // Aggregate stats
    const aggregateStats = await db
      .select({
        totalRequests: sql<number>`count(*)::int`,
        totalTokens: sql<number>`coalesce(sum(${apiKeyUsageLog.tokensUsed}), 0)::int`,
        avgResponseTime: sql<number>`coalesce(avg(${apiKeyUsageLog.responseTimeMs}), 0)::int`,
        successCount: sql<number>`count(*) filter (where ${apiKeyUsageLog.statusCode} >= 200 and ${apiKeyUsageLog.statusCode} < 300)::int`,
        errorCount: sql<number>`count(*) filter (where ${apiKeyUsageLog.statusCode} >= 400)::int`,
      })
      .from(apiKeyUsageLog)
      .where(
        and(
          eq(apiKeyUsageLog.apiKeyId, id),
          gte(apiKeyUsageLog.createdAt, startDate)
        )
      );

    // Daily breakdown
    const dailyBreakdown = await db
      .select({
        date: sql<string>`date_trunc('day', ${apiKeyUsageLog.createdAt})::date::text`,
        requests: sql<number>`count(*)::int`,
        tokens: sql<number>`coalesce(sum(${apiKeyUsageLog.tokensUsed}), 0)::int`,
      })
      .from(apiKeyUsageLog)
      .where(
        and(
          eq(apiKeyUsageLog.apiKeyId, id),
          gte(apiKeyUsageLog.createdAt, startDate)
        )
      )
      .groupBy(sql`date_trunc('day', ${apiKeyUsageLog.createdAt})`)
      .orderBy(sql`date_trunc('day', ${apiKeyUsageLog.createdAt})`);

    // Endpoint breakdown
    const endpointBreakdown = await db
      .select({
        endpoint: apiKeyUsageLog.endpoint,
        method: apiKeyUsageLog.method,
        requests: sql<number>`count(*)::int`,
        avgResponseTime: sql<number>`coalesce(avg(${apiKeyUsageLog.responseTimeMs}), 0)::int`,
      })
      .from(apiKeyUsageLog)
      .where(
        and(
          eq(apiKeyUsageLog.apiKeyId, id),
          gte(apiKeyUsageLog.createdAt, startDate)
        )
      )
      .groupBy(apiKeyUsageLog.endpoint, apiKeyUsageLog.method)
      .orderBy(sql`count(*) desc`)
      .limit(10);

    return NextResponse.json({
      key: {
        id: existingKey.id,
        name: existingKey.name,
        totalRequests: existingKey.requestCount,
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
