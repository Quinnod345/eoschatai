import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import {
  l10Meeting,
  l10AgendaItem,
  l10Issue,
  l10Todo,
  document,
} from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod/v3';

const createMeetingSchema = z.object({
  composerId: z.string().min(1).max(255),
  title: z.string().trim().min(1).max(255),
  attendees: z.array(z.string().max(255)).max(100).optional().default([]),
});

const updateMeetingSchema = z.object({
  meetingId: z.string().uuid(),
  updates: z
    .object({
      title: z.string().trim().min(1).max(255).optional(),
      status: z.enum(['active', 'completed', 'archived']).optional(),
      attendees: z.array(z.string().max(255)).max(100).optional(),
      rating: z.number().int().min(1).max(10).nullable().optional(),
      notes: z.string().max(10_000).nullable().optional(),
      date: z.coerce.date().optional(),
    })
    .strict(),
});

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
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch (error) {
      if (error instanceof SyntaxError) {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
      }
      throw error;
    }

    const parsedBody = createMeetingSchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: parsedBody.error.errors[0]?.message || 'Validation failed' },
        { status: 400 },
      );
    }
    const { composerId, title, attendees } = parsedBody.data;

    const [composerDoc] = await db
      .select({ id: document.id, userId: document.userId })
      .from(document)
      .where(eq(document.id, composerId));

    if (!composerDoc || composerDoc.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Composer document not found' },
        { status: 404 },
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
    return NextResponse.json(
      { error: 'Failed to create meeting' },
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
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch (error) {
      if (error instanceof SyntaxError) {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
      }
      throw error;
    }

    const parsedBody = updateMeetingSchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: parsedBody.error.errors[0]?.message || 'Validation failed' },
        { status: 400 },
      );
    }
    const { meetingId, updates } = parsedBody.data;

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
    const updateSet: Record<string, unknown> = {
      updatedAt: new Date(),
    };
    if (updates.title !== undefined) updateSet.title = updates.title;
    if (updates.status !== undefined) updateSet.status = updates.status;
    if (updates.attendees !== undefined) updateSet.attendees = updates.attendees;
    if (updates.rating !== undefined) updateSet.rating = updates.rating;
    if (updates.notes !== undefined) updateSet.notes = updates.notes;
    if (updates.date !== undefined) updateSet.date = updates.date;

    if (Object.keys(updateSet).length === 1) {
      return NextResponse.json({ error: 'No valid updates provided' }, { status: 400 });
    }

    const [updatedMeeting] = await db
      .update(l10Meeting)
      .set(updateSet)
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
