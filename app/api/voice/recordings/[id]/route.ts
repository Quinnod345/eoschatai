import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import { voiceRecording, voiceTranscript } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { del } from '@vercel/blob';

// DELETE endpoint
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const params = await context.params;
    const recordingId = params.id;

    // Get the recording to verify ownership and get blob URL
    const [recording] = await db
      .select()
      .from(voiceRecording)
      .where(
        and(
          eq(voiceRecording.id, recordingId),
          eq(voiceRecording.userId, session.user.id),
        ),
      )
      .limit(1);

    if (!recording) {
      return NextResponse.json(
        { error: 'Recording not found' },
        { status: 404 },
      );
    }

    // Delete the audio file from blob storage
    try {
      await del(recording.audioUrl);
    } catch (blobError) {
      console.error('Failed to delete blob:', blobError);
      // Continue anyway - blob might already be deleted
    }

    // Delete transcript first (foreign key constraint)
    await db
      .delete(voiceTranscript)
      .where(eq(voiceTranscript.recordingId, recordingId));

    // Delete the recording
    await db.delete(voiceRecording).where(eq(voiceRecording.id, recordingId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete recording:', error);
    return NextResponse.json(
      { error: 'Failed to delete recording' },
      { status: 500 },
    );
  }
}

// PATCH endpoint for updating metadata
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const params = await context.params;
    const recordingId = params.id;
    const body = await request.json();

    // Validate ownership
    const [existing] = await db
      .select()
      .from(voiceRecording)
      .where(
        and(
          eq(voiceRecording.id, recordingId),
          eq(voiceRecording.userId, session.user.id),
        ),
      )
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { error: 'Recording not found' },
        { status: 404 },
      );
    }

    // Build update object
    const updates: any = {
      updatedAt: new Date(),
    };

    if (body.title !== undefined) updates.title = body.title;
    if (body.meetingType !== undefined) updates.meetingType = body.meetingType;
    if (body.tags !== undefined) updates.tags = body.tags;

    // Update recording
    const [updated] = await db
      .update(voiceRecording)
      .set(updates)
      .where(eq(voiceRecording.id, recordingId))
      .returning();

    return NextResponse.json({ recording: updated });
  } catch (error) {
    console.error('Failed to update recording:', error);
    return NextResponse.json(
      { error: 'Failed to update recording' },
      { status: 500 },
    );
  }
}


