import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import {
  voiceRecording,
  voiceTranscript,
  l10AgendaItem,
} from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { put } from '@vercel/blob';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get all recordings for the user, including L10 recordings
    const recordings = await db
      .select({
        recording: voiceRecording,
        transcript: voiceTranscript,
      })
      .from(voiceRecording)
      .leftJoin(
        voiceTranscript,
        eq(voiceRecording.id, voiceTranscript.recordingId),
      )
      .where(eq(voiceRecording.userId, session.user.id))
      .orderBy(desc(voiceRecording.createdAt));

    return NextResponse.json({ recordings });
  } catch (error) {
    console.error('Error fetching recordings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recordings' },
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
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;
    const title = formData.get('title') as string;
    const agendaItemId = formData.get('agendaItemId') as string | null;

    if (!audioFile || !title) {
      return NextResponse.json(
        { error: 'Audio file and title required' },
        { status: 400 },
      );
    }

    // Upload to blob storage
    const blob = await put(audioFile.name, audioFile, {
      access: 'public',
      contentType: audioFile.type,
    });

    // Create the recording in database
    const [recording] = await db
      .insert(voiceRecording)
      .values({
        userId: session.user.id,
        title,
        audioUrl: blob.url,
        duration: 0, // Will be updated after processing
        fileSize: audioFile.size,
        mimeType: audioFile.type,
      })
      .returning();

    // If this is for an L10 agenda item, update the agenda item
    if (agendaItemId) {
      await db
        .update(l10AgendaItem)
        .set({ recordingId: recording.id })
        .where(eq(l10AgendaItem.id, agendaItemId));
    }

    return NextResponse.json({ recording });
  } catch (error) {
    console.error('Error creating recording:', error);
    return NextResponse.json(
      { error: 'Failed to create recording' },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const recordingId = searchParams.get('id');

    if (!recordingId) {
      return NextResponse.json(
        { error: 'Recording ID required' },
        { status: 400 },
      );
    }

    // Verify ownership
    const [recording] = await db
      .select()
      .from(voiceRecording)
      .where(
        and(
          eq(voiceRecording.id, recordingId),
          eq(voiceRecording.userId, session.user.id),
        ),
      );

    if (!recording) {
      return NextResponse.json(
        { error: 'Recording not found' },
        { status: 404 },
      );
    }

    // Delete from database (cascades to transcript)
    await db.delete(voiceRecording).where(eq(voiceRecording.id, recordingId));

    // TODO: Delete from blob storage

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting recording:', error);
    return NextResponse.json(
      { error: 'Failed to delete recording' },
      { status: 500 },
    );
  }
}
