import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { getAccessContext, incrementUsageCounter } from '@/lib/entitlements';
import { trackBlockedAction } from '@/lib/analytics';
import { db } from '@/lib/db';
import { l10Meeting, l10AgendaItem, l10Issue, l10Todo } from '@/lib/db/schema';
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
    const monthlyLimit = 10;
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

    const { meetingId, format = 'pdf' } = await request.json();

    if (!meetingId) {
      return NextResponse.json(
        { error: 'Meeting ID is required' },
        { status: 400 },
      );
    }

    // Fetch the meeting and related data
    const [meeting] = await db
      .select()
      .from(l10Meeting)
      .where(
        and(
          eq(l10Meeting.id, meetingId),
          eq(l10Meeting.userId, session.user.id),
        ),
      )
      .limit(1);

    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }

    // Fetch related data
    const [agendaItems, issues, todos] = await Promise.all([
      db
        .select()
        .from(l10AgendaItem)
        .where(eq(l10AgendaItem.meetingId, meeting.id))
        .orderBy(l10AgendaItem.orderIndex),
      db.select().from(l10Issue).where(eq(l10Issue.meetingId, meeting.id)),
      db.select().from(l10Todo).where(eq(l10Todo.meetingId, meeting.id)),
    ]);

    const meetingData = {
      ...meeting,
      agenda: agendaItems,
      issues,
      todos,
    };

    // Increment usage counter
    await incrementUsageCounter(session.user.id, 'exports_month', 1);

    if (format === 'json') {
      // Return meeting data as JSON
      return NextResponse.json({
        title: meeting.title,
        date: meeting.date,
        data: meetingData,
      });
    }

    // For PDF/DOCX export
    if (format === 'pdf') {
      // TODO: Implement PDF generation for L10 meetings
      // This would create a formatted meeting recap document
      return NextResponse.json({
        message: 'PDF export for meetings is being implemented',
        data: meetingData,
      });
    }

    if (format === 'docx') {
      // TODO: Implement DOCX generation for L10 meetings
      // We could use the docx library like in the text composer
      return NextResponse.json({
        message: 'DOCX export for meetings is being implemented',
        data: meetingData,
      });
    }

    return NextResponse.json(
      { error: 'Invalid export format' },
      { status: 400 },
    );
  } catch (error) {
    console.error('[export.meeting] Export failed', error);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}

