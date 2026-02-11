import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import { l10Todo, l10Meeting } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod/v3';

const createTodoSchema = z.object({
  meetingId: z.string().uuid(),
  task: z.string().trim().min(1).max(10_000),
  owner: z.string().trim().min(1).max(255),
  dueDate: z.string().optional(),
});

const updateTodoSchema = z.object({
  todoId: z.string().uuid(),
  updates: z
    .object({
      task: z.string().trim().min(1).max(10_000).optional(),
      owner: z.string().trim().min(1).max(255).optional(),
      dueDate: z.string().nullable().optional(),
      completed: z.boolean().optional(),
    })
    .strict(),
});

const parseIsoDate = (value: string): Date | null => {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
};

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

    const parsedBody = createTodoSchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: parsedBody.error.errors[0]?.message || 'Validation failed' },
        { status: 400 },
      );
    }
    const { meetingId, task, owner, dueDate } = parsedBody.data;
    const parsedDueDate = dueDate ? parseIsoDate(dueDate) : null;
    if (dueDate && !parsedDueDate) {
      return NextResponse.json({ error: 'Invalid dueDate' }, { status: 400 });
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
        dueDate: parsedDueDate,
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
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch (error) {
      if (error instanceof SyntaxError) {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
      }
      throw error;
    }

    const parsedBody = updateTodoSchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: parsedBody.error.errors[0]?.message || 'Validation failed' },
        { status: 400 },
      );
    }
    const { todoId, updates } = parsedBody.data;

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

    const updateSet: Record<string, unknown> = {};
    if (updates.task !== undefined) updateSet.task = updates.task;
    if (updates.owner !== undefined) updateSet.owner = updates.owner;
    if (updates.dueDate !== undefined) {
      if (updates.dueDate === null) {
        updateSet.dueDate = null;
      } else {
        const parsedDueDate = parseIsoDate(updates.dueDate);
        if (!parsedDueDate) {
          return NextResponse.json({ error: 'Invalid dueDate' }, { status: 400 });
        }
        updateSet.dueDate = parsedDueDate;
      }
    }
    if (updates.completed !== undefined) {
      updateSet.completed = updates.completed;
      updateSet.completedAt = updates.completed ? new Date() : null;
    }

    if (Object.keys(updateSet).length === 0) {
      return NextResponse.json({ error: 'No valid updates provided' }, { status: 400 });
    }

    // Update the todo
    const [updatedTodo] = await db
      .update(l10Todo)
      .set(updateSet)
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
