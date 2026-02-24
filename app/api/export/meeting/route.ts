import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { getAccessContext, incrementUsageCounter } from '@/lib/entitlements';
import { trackBlockedAction } from '@/lib/analytics';
import { db } from '@/lib/db';
import { l10Meeting, l10AgendaItem, l10Issue, l10Todo } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import {
  createPDF,
  addHeader,
  addSectionHeading,
  addBodyText,
  addTable,
  addFooter,
  pdfToBuffer,
} from '@/lib/export/pdf-generator';
import {
  createSubtitle,
  createHeading,
  createBodyText,
  createBulletList,
  createTable,
  generateDocx,
} from '@/lib/export/docx-generator';
import type { Paragraph, Table } from 'docx';

// Meeting data structure (matches database schema)
interface MeetingData {
  id: string;
  title: string;
  date: Date;
  status: string;
  rating: number | null;
  notes: string | null;
  agenda: Array<{
    id: string;
    type: string;
    title: string;
    duration: number;
    completed: boolean;
    notes: string | null;
    orderIndex: number;
  }>;
  issues: Array<{
    id: string;
    title: string;
    description: string | null;
    status: string;
    priority: string;
  }>;
  todos: Array<{
    id: string;
    task: string;
    owner: string;
    dueDate: Date | null;
    completed: boolean;
  }>;
}

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

    // Generate PDF export
    if (format === 'pdf') {
      const pdfBuffer = generateMeetingPdf(meetingData as MeetingData);
      return new NextResponse(new Uint8Array(pdfBuffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="L10-Meeting-${formatDate(meeting.date)}.pdf"`,
        },
      });
    }

    // Generate DOCX export
    if (format === 'docx') {
      const docxBuffer = await generateMeetingDocx(meetingData as MeetingData);
      return new NextResponse(new Uint8Array(docxBuffer), {
        status: 200,
        headers: {
          'Content-Type':
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': `attachment; filename="L10-Meeting-${formatDate(meeting.date)}.docx"`,
        },
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

/**
 * Format date for filename
 */
function formatDate(date: Date | null): string {
  if (!date) return 'unknown';
  return new Date(date).toISOString().split('T')[0];
}

/**
 * Format date for display
 */
function formatDisplayDate(date: Date | null): string {
  if (!date) return 'Not specified';
  return new Date(date).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Generate PDF for L10 Meeting
 */
function generateMeetingPdf(meeting: MeetingData): Buffer {
  const doc = createPDF(meeting.title || 'Level 10 Meeting');
  let y = addHeader(
    doc,
    'Level 10 Meeting™ Recap',
    `${meeting.title || 'Weekly Meeting'} - ${formatDisplayDate(meeting.date)}`,
  );

  // Meeting Info
  y = addSectionHeading(doc, 'Meeting Information', y);
  y = addBodyText(doc, `Status: ${meeting.status || 'Completed'}`, y);
  if (meeting.rating) {
    y = addBodyText(doc, `Rating: ${meeting.rating}/10`, y);
  }
  if (meeting.notes) {
    y = addBodyText(doc, `Notes: ${meeting.notes}`, y);
  }
  y += 5;

  // Agenda Items
  if (meeting.agenda.length > 0) {
    y = addSectionHeading(doc, 'Agenda Items', y);
    for (const item of meeting.agenda) {
      const status = item.completed ? '✓' : '○';
      y = addBodyText(doc, `${status} ${item.title} (${item.type})`, y);
      if (item.notes) {
        y = addBodyText(doc, `   Notes: ${item.notes}`, y, { indent: 25 });
      }
    }
    y += 5;
  }

  // Issues (IDS)
  if (meeting.issues.length > 0) {
    y = addSectionHeading(doc, 'IDS™ (Issues)', y);
    y = addTable(
      doc,
      {
        headers: ['Issue', 'Priority', 'Status'],
        rows: meeting.issues.map((issue) => ({
          cells: [issue.title, issue.priority, issue.status],
        })),
      },
      y,
      { columnWidths: [100, 35, 35] },
    );
    y += 5;
  }

  // To-Dos
  if (meeting.todos.length > 0) {
    y = addSectionHeading(doc, 'To-Do List', y);
    y = addTable(
      doc,
      {
        headers: ['To-Do', 'Owner', 'Due Date', 'Status'],
        rows: meeting.todos.map((todo) => ({
          cells: [
            todo.task,
            todo.owner,
            todo.dueDate ? formatDate(todo.dueDate) : 'No date',
            todo.completed ? 'Done' : 'Pending',
          ],
        })),
      },
      y,
      { columnWidths: [70, 40, 35, 25] },
    );
    y += 5;
  }

  addFooter(doc, 'EOS AI - Level 10 Meeting');
  return pdfToBuffer(doc);
}

/**
 * Generate DOCX for L10 Meeting
 */
async function generateMeetingDocx(meeting: MeetingData): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [];

  children.push(
    createSubtitle(
      `${meeting.title || 'Weekly Meeting'} - ${formatDisplayDate(meeting.date)}`,
    ),
  );

  // Meeting Info
  children.push(createHeading('Meeting Information'));
  children.push(createBodyText(`Status: ${meeting.status || 'Completed'}`));
  if (meeting.rating) {
    children.push(createBodyText(`Rating: ${meeting.rating}/10`));
  }
  if (meeting.notes) {
    children.push(createBodyText(`Notes: ${meeting.notes}`));
  }

  // Agenda Items
  if (meeting.agenda.length > 0) {
    children.push(createHeading('Agenda Items'));
    const agendaItems = meeting.agenda.map((item) => {
      const status = item.completed ? '✓' : '○';
      return `${status} ${item.title} (${item.type})${item.notes ? ` - ${item.notes}` : ''}`;
    });
    children.push(...createBulletList(agendaItems));
  }

  // Issues (IDS)
  if (meeting.issues.length > 0) {
    children.push(createHeading('IDS™ (Issues)'));
    children.push(
      createTable({
        headers: ['Issue', 'Priority', 'Status'],
        rows: meeting.issues.map((issue) => [
          issue.title,
          issue.priority,
          issue.status,
        ]),
      }),
    );
  }

  // To-Dos
  if (meeting.todos.length > 0) {
    children.push(createHeading('To-Do List'));
    children.push(
      createTable({
        headers: ['To-Do', 'Owner', 'Due Date', 'Status'],
        rows: meeting.todos.map((todo) => [
          todo.task,
          todo.owner,
          todo.dueDate ? formatDate(todo.dueDate) : 'No date',
          todo.completed ? 'Done' : 'Pending',
        ]),
      }),
    );
  }

  return generateDocx(meeting.title || 'Level 10 Meeting Recap', children);
}
