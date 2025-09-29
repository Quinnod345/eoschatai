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

    // Check monthly export limit if applicable
    const monthlyLimit = 10; // You can make this configurable
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

    // Fetch the VTO document
    const [vtoDoc] = await db
      .select()
      .from(document)
      .where(
        and(
          eq(document.id, documentId),
          eq(document.userId, session.user.id),
          eq(document.kind, 'vto'),
        ),
      )
      .limit(1);

    if (!vtoDoc) {
      return NextResponse.json(
        { error: 'VTO document not found' },
        { status: 404 },
      );
    }

    // Extract VTO data
    const content = vtoDoc.content || '';
    const vtoMatch = content.match(/VTO_DATA_BEGIN\n([\s\S]*?)\nVTO_DATA_END/);

    if (!vtoMatch) {
      return NextResponse.json(
        { error: 'Invalid VTO document format' },
        { status: 400 },
      );
    }

    const vtoData = JSON.parse(vtoMatch[1]);

    // Increment usage counter
    await incrementUsageCounter(session.user.id, 'exports_month', 1);

    if (format === 'json') {
      // Return raw VTO data as JSON
      return NextResponse.json({
        title: vtoDoc.title,
        createdAt: vtoDoc.createdAt,
        data: vtoData,
      });
    }

    // For PDF/DOCX export, we'll need to implement the conversion logic
    // This is a placeholder for now
    if (format === 'pdf') {
      // TODO: Implement PDF generation
      // For now, return a message indicating the feature is in development
      return NextResponse.json({
        message: 'PDF export functionality is being implemented',
        data: vtoData,
      });
    }

    if (format === 'docx') {
      // TODO: Implement DOCX generation
      // For now, return a message indicating the feature is in development
      return NextResponse.json({
        message: 'DOCX export functionality is being implemented',
        data: vtoData,
      });
    }

    return NextResponse.json(
      { error: 'Invalid export format' },
      { status: 400 },
    );
  } catch (error) {
    console.error('[export.vto] Export failed', error);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}

