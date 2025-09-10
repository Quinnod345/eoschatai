import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import { l10Todo, l10Meeting } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { meetingId, task, owner, dueDate } = body;

    if (!meetingId || !task || !owner) {
      return NextResponse.json(
        { error: 'Meeting ID, task, and owner required' },
        { status: 400 },
      );
    }

    // Verify meeting ownership
    const [meeting] = await db
      .select()
      .from(l10Meeting)
      .where(
        and(
          eq(l10Meeting.id, meetingId),
          eq(l10Meeting.userId, session.user.id),
        ),
      );

    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }

    // Create the todo
    const [todo] = await db
      .insert(l10Todo)
      .values({
        meetingId,
        task,
        owner,
        dueDate: dueDate ? new Date(dueDate) : null,
      })
      .returning();

    return NextResponse.json({ todo });
  } catch (error) {
    console.error('Error creating L10 todo:', error);
    return NextResponse.json(
      { error: 'Failed to create todo' },
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
    const { todoId, updates } = body;

    if (!todoId) {
      return NextResponse.json({ error: 'Todo ID required' }, { status: 400 });
    }

    // Get the todo and verify ownership through meeting
    const [todo] = await db
      .select({
        todo: l10Todo,
        meeting: l10Meeting,
      })
      .from(l10Todo)
      .innerJoin(l10Meeting, eq(l10Todo.meetingId, l10Meeting.id))
      .where(eq(l10Todo.id, todoId));

    if (!todo || todo.meeting.userId !== session.user.id) {
      return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
    }

    // Update the todo
    const [updatedTodo] = await db
      .update(l10Todo)
      .set({
        ...updates,
        completedAt: updates.completed ? new Date() : null,
      })
      .where(eq(l10Todo.id, todoId))
      .returning();

    return NextResponse.json({ todo: updatedTodo });
  } catch (error) {
    console.error('Error updating L10 todo:', error);
    return NextResponse.json(
      { error: 'Failed to update todo' },
      { status: 500 },
    );
  }
}
