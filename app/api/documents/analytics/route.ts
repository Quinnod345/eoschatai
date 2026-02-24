import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import { userDocuments, contextUsageLog } from '@/lib/db/schema';
import { eq, and, gte, sql } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Build date filter if provided
    const dateFilters = [];
    if (startDate) {
      dateFilters.push(gte(contextUsageLog.createdAt, new Date(startDate)));
    }
    if (endDate) {
      const endDateTime = new Date(endDate);
      endDateTime.setHours(23, 59, 59, 999);
      dateFilters.push(
        sql`${contextUsageLog.createdAt} <= ${endDateTime}`,
      );
    }

    // Get all user documents with usage stats
    const documents = await db
      .select({
        id: userDocuments.id,
        fileName: userDocuments.fileName,
        category: userDocuments.category,
        fileSize: userDocuments.fileSize,
        createdAt: userDocuments.createdAt,
        isContext: userDocuments.isContext,
      })
      .from(userDocuments)
      .where(eq(userDocuments.userId, session.user.id))
      .orderBy(userDocuments.createdAt);

    // Get usage statistics from context usage logs
    // Since we don't have a direct documentId in contextUsageLog,
    // we'll count userChunks as a proxy for document usage
    const usageStats = await db
      .select({
        userId: contextUsageLog.userId,
        timesUsed: sql<number>`COUNT(*)`,
        lastUsed: sql<Date>`MAX(${contextUsageLog.createdAt})`,
        totalChunks: sql<number>`SUM(${contextUsageLog.userChunks})`,
        avgChunks: sql<number>`AVG(${contextUsageLog.userChunks})`,
      })
      .from(contextUsageLog)
      .where(
        and(
          eq(contextUsageLog.userId, session.user.id),
          ...dateFilters,
        ),
      )
      .groupBy(contextUsageLog.userId);

    const userUsage = usageStats[0] || {
      timesUsed: 0,
      lastUsed: null,
      totalChunks: 0,
      avgChunks: 0,
    };

    // Calculate document-level analytics
    const documentAnalytics = documents.map((doc) => {
      // Estimate usage based on whether document is active in context
      const estimatedUsage = doc.isContext ? Number(userUsage.timesUsed) : 0;
      const estimatedChunks = doc.isContext ? Number(userUsage.avgChunks) : 0;

      return {
        documentId: doc.id,
        fileName: doc.fileName,
        category: doc.category,
        fileSize: doc.fileSize,
        uploadedAt: doc.createdAt,
        isContext: doc.isContext,
        timesUsed: estimatedUsage,
        lastUsed: userUsage.lastUsed,
        avgRelevance: estimatedChunks > 0 ? Math.min(100, estimatedChunks * 10) : 0,
        status: doc.isContext
          ? estimatedUsage > 0
            ? 'active'
            : 'unused'
          : 'not_indexed',
      };
    });

    // Sort by times used (descending)
    documentAnalytics.sort((a, b) => b.timesUsed - a.timesUsed);

    // Calculate summary stats
    const totalDocuments = documents.length;
    const activeDocuments = documentAnalytics.filter(
      (d) => d.status === 'active',
    ).length;
    const unusedDocuments = documentAnalytics.filter(
      (d) => d.status === 'unused',
    ).length;
    const totalSize = documents.reduce((sum, d) => sum + d.fileSize, 0);

    // Most used categories
    const categoryCounts: Record<string, number> = {};
    documents.forEach((doc) => {
      categoryCounts[doc.category] = (categoryCounts[doc.category] || 0) + 1;
    });

    return NextResponse.json({
      summary: {
        totalDocuments,
        activeDocuments,
        unusedDocuments,
        notIndexedDocuments: totalDocuments - activeDocuments - unusedDocuments,
        totalSize,
        totalSizeMB: Math.round((totalSize / (1024 * 1024)) * 100) / 100,
      },
      documents: documentAnalytics,
      categoryBreakdown: Object.entries(categoryCounts).map(
        ([category, count]) => ({
          category,
          count,
          percentage: (count / totalDocuments) * 100,
        }),
      ),
      dateRange: {
        start: startDate || null,
        end: endDate || null,
      },
    });
  } catch (error) {
    console.error('Error fetching document analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 },
    );
  }
}


