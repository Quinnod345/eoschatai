import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import { l10Issue, l10Meeting } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { meetingId, title, description, priority, owner } = body;

    if (!meetingId || !title) {
      return NextResponse.json(
        { error: 'Meeting ID and title required' },
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
    const body = await request.json();
    const { issueId, updates } = body;

    if (!issueId) {
      return NextResponse.json({ error: 'Issue ID required' }, { status: 400 });
    }

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

    // Update the issue
    const [updatedIssue] = await db
      .update(l10Issue)
      .set({
        ...updates,
        resolvedAt: updates.status === 'solved' ? new Date() : null,
      })
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
