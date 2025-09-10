import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import {
  l10Meeting,
  l10AgendaItem,
  l10Issue,
  l10Todo,
  voiceRecording,
  voiceTranscript,
} from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const composerId = searchParams.get('composerId');

  if (!composerId) {
    return NextResponse.json(
      { error: 'Composer ID required' },
      { status: 400 },
    );
  }

  try {
    // Get all meetings for this composer
    const meetings = await db
      .select()
      .from(l10Meeting)
      .where(
        and(
          eq(l10Meeting.userId, session.user.id),
          eq(l10Meeting.composerId, composerId),
        ),
      )
      .orderBy(desc(l10Meeting.date));

    // Get all related data for each meeting
    const meetingsWithData = await Promise.all(
      meetings.map(async (meeting) => {
        const [agendaItems, issues, todos] = await Promise.all([
          db
            .select()
            .from(l10AgendaItem)
            .where(eq(l10AgendaItem.meetingId, meeting.id))
            .orderBy(l10AgendaItem.orderIndex),
          db.select().from(l10Issue).where(eq(l10Issue.meetingId, meeting.id)),
          db.select().from(l10Todo).where(eq(l10Todo.meetingId, meeting.id)),
        ]);

        return {
          ...meeting,
          agenda: agendaItems,
          issues,
          todos,
        };
      }),
    );

    return NextResponse.json({ meetings: meetingsWithData });
  } catch (error) {
    console.error('Error fetching L10 meetings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch meetings' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { composerId, title, attendees } = body;

    if (!composerId || !title) {
      return NextResponse.json(
        { error: 'Composer ID and title required' },
        { status: 400 },
      );
    }

    // Create the meeting
    const [meeting] = await db
      .insert(l10Meeting)
      .values({
        userId: session.user.id,
        composerId,
        title,
        date: new Date(),
        attendees: attendees || [],
      })
      .returning();

    // Create default agenda items
    const defaultAgendaItems: Array<{
      type:
        | 'segue'
        | 'scorecard'
        | 'rocks'
        | 'headlines'
        | 'todo'
        | 'ids'
        | 'conclusion';
      title: string;
      duration: number;
      orderIndex: number;
    }> = [
      { type: 'segue', title: 'Segue - Good News', duration: 5, orderIndex: 0 },
      {
        type: 'scorecard',
        title: 'Scorecard Review',
        duration: 5,
        orderIndex: 1,
      },
      { type: 'rocks', title: 'Rock Review', duration: 5, orderIndex: 2 },
      {
        type: 'headlines',
        title: 'Customer/Employee Headlines',
        duration: 5,
        orderIndex: 3,
      },
      { type: 'todo', title: 'To-Do List Review', duration: 5, orderIndex: 4 },
      {
        type: 'ids',
        title: 'IDS (Identify, Discuss, Solve)',
        duration: 60,
        orderIndex: 5,
      },
      { type: 'conclusion', title: 'Conclusion', duration: 5, orderIndex: 6 },
    ];

    const agendaItems = await db
      .insert(l10AgendaItem)
      .values(
        defaultAgendaItems.map((item) => ({
          meetingId: meeting.id,
          ...item,
        })),
      )
      .returning();

    return NextResponse.json({
      meeting: {
        ...meeting,
        agenda: agendaItems,
        issues: [],
        todos: [],
      },
    });
  } catch (error) {
    console.error('Error creating L10 meeting:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    const errorDetails =
      error instanceof Error && 'code' in error
        ? (error as any).code
        : undefined;
    return NextResponse.json(
      {
        error: 'Failed to create meeting',
        details: errorMessage,
        code: errorDetails,
      },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { meetingId, updates } = body;

    if (!meetingId) {
      return NextResponse.json(
        { error: 'Meeting ID required' },
        { status: 400 },
      );
    }

    // Verify ownership
    const [existingMeeting] = await db
      .select()
      .from(l10Meeting)
      .where(
        and(
          eq(l10Meeting.id, meetingId),
          eq(l10Meeting.userId, session.user.id),
        ),
      );

    if (!existingMeeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }

    // Update the meeting
    const [updatedMeeting] = await db
      .update(l10Meeting)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(l10Meeting.id, meetingId))
      .returning();

    return NextResponse.json({ meeting: updatedMeeting });
  } catch (error) {
    console.error('Error updating L10 meeting:', error);
    return NextResponse.json(
      { error: 'Failed to update meeting' },
      { status: 500 },
    );
  }
}
