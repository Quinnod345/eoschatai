import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { getAccessContext, incrementUsageCounter } from '@/lib/entitlements';
import { trackBlockedAction } from '@/lib/analytics';
import { db } from '@/lib/db';
import { document } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check entitlements
    const accessContext = await getAccessContext(session.user.id);

    if (!accessContext.entitlements.features.export) {
      await trackBlockedAction({
        feature: 'export',
        reason: 'not_enabled',
        user_id: session.user.id,
        org_id: accessContext.user.orgId,
        status: 403,
      });

      return NextResponse.json(
        {
          code: 'ENTITLEMENT_BLOCK',
          feature: 'export',
          reason: 'not_enabled',
        },
        { status: 403 },
      );
    }

    // Check monthly export limit
    const monthlyLimit = 10; // Configurable limit
    if (accessContext.user.usageCounters.exports_month >= monthlyLimit) {
      await trackBlockedAction({
        feature: 'export',
        reason: 'limit_exceeded',
        user_id: session.user.id,
        org_id: accessContext.user.orgId,
        status: 403,
      });

      return NextResponse.json(
        {
          code: 'ENTITLEMENT_BLOCK',
          feature: 'export',
          reason: 'limit_exceeded',
        },
        { status: 403 },
      );
    }

    const { documentId, format = 'pdf' } = await request.json();

    if (!documentId) {
      return NextResponse.json(
        { error: 'Document ID is required' },
        { status: 400 },
      );
    }

    // Fetch the accountability chart document
    const [acDoc] = await db
      .select()
      .from(document)
      .where(
        and(
          eq(document.id, documentId),
          eq(document.userId, session.user.id),
          eq(document.kind, 'accountability'),
        ),
      )
      .limit(1);

    if (!acDoc) {
      return NextResponse.json(
        { error: 'Accountability chart document not found' },
        { status: 404 },
      );
    }

    // Parse accountability chart data
    const content = acDoc.content || '';
    let acData;

    try {
      // Try to parse as JSON first (new format)
      acData = JSON.parse(content);
    } catch {
      // Fall back to extracting from wrapped format
      const acMatch = content.match(/AC_DATA_BEGIN\n([\s\S]*?)\nAC_DATA_END/);
      if (acMatch) {
        acData = JSON.parse(acMatch[1]);
      } else {
        return NextResponse.json(
          { error: 'Invalid accountability chart format' },
          { status: 400 },
        );
      }
    }

    // Increment usage counter
    await incrementUsageCounter(session.user.id, 'exports_month', 1);

    if (format === 'json') {
      // Return raw AC data as JSON
      return NextResponse.json({
        title: acDoc.title,
        createdAt: acDoc.createdAt,
        data: acData,
      });
    }

    // For PDF/DOCX export, we'll need to implement the conversion logic
    if (format === 'pdf') {
      // TODO: Implement PDF generation for accountability charts
      // This would involve creating a visual representation of the org chart
      return NextResponse.json({
        message: 'PDF export for accountability charts is being implemented',
        data: acData,
      });
    }

    if (format === 'docx') {
      // TODO: Implement DOCX generation for accountability charts
      return NextResponse.json({
        message: 'DOCX export for accountability charts is being implemented',
        data: acData,
      });
    }

    return NextResponse.json(
      { error: 'Invalid export format' },
      { status: 400 },
    );
  } catch (error) {
    console.error('[export.ac] Export failed', error);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}

