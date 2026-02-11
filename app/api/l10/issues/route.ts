import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import { l10Issue, l10Meeting } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod/v3';

const createIssueSchema = z.object({
  meetingId: z.string().uuid(),
  title: z.string().trim().min(1).max(255),
  description: z.string().max(10_000).optional(),
  priority: z.enum(['high', 'medium', 'low']).optional().default('medium'),
  owner: z.string().trim().max(255).optional(),
});

const updateIssueSchema = z.object({
  issueId: z.string().uuid(),
  updates: z
    .object({
      title: z.string().trim().min(1).max(255).optional(),
      description: z.string().max(10_000).nullable().optional(),
      priority: z.enum(['high', 'medium', 'low']).optional(),
      status: z.enum(['identified', 'discussing', 'solving', 'solved']).optional(),
      owner: z.string().trim().max(255).nullable().optional(),
    })
    .strict(),
});

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

    const parsedBody = createIssueSchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: parsedBody.error.errors[0]?.message || 'Validation failed' },
        { status: 400 },
      );
    }
    const { meetingId, title, description, priority, owner } = parsedBody.data;

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

    // Create the issue
    const [issue] = await db
      .insert(l10Issue)
      .values({
        meetingId,
        title,
        description,
        priority: priority || 'medium',
        owner,
      })
      .returning();

    return NextResponse.json({ issue });
  } catch (error) {
    console.error('Error creating L10 issue:', error);
    return NextResponse.json(
      { error: 'Failed to create issue' },
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

    const parsedBody = updateIssueSchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: parsedBody.error.errors[0]?.message || 'Validation failed' },
        { status: 400 },
      );
    }
    const { issueId, updates } = parsedBody.data;

    // Get the issue and verify ownership through meeting
    const [issue] = await db
      .select({
        issue: l10Issue,
        meeting: l10Meeting,
      })
      .from(l10Issue)
      .innerJoin(l10Meeting, eq(l10Issue.meetingId, l10Meeting.id))
      .where(eq(l10Issue.id, issueId));

    if (!issue || issue.meeting.userId !== session.user.id) {
      return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
    }

    const updateSet: Record<string, unknown> = {};
    if (updates.title !== undefined) updateSet.title = updates.title;
    if (updates.description !== undefined) updateSet.description = updates.description;
    if (updates.priority !== undefined) updateSet.priority = updates.priority;
    if (updates.owner !== undefined) updateSet.owner = updates.owner;
    if (updates.status !== undefined) {
      updateSet.status = updates.status;
      updateSet.resolvedAt = updates.status === 'solved' ? new Date() : null;
    }

    if (Object.keys(updateSet).length === 0) {
      return NextResponse.json({ error: 'No valid updates provided' }, { status: 400 });
    }

    // Update the issue
    const [updatedIssue] = await db
      .update(l10Issue)
      .set(updateSet)
      .where(eq(l10Issue.id, issueId))
      .returning();

    return NextResponse.json({ issue: updatedIssue });
  } catch (error) {
    console.error('Error updating L10 issue:', error);
    return NextResponse.json(
      { error: 'Failed to update issue' },
      { status: 500 },
    );
  }
}
