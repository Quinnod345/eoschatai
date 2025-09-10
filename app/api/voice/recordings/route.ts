import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import { voiceRecording, voiceTranscript } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { put } from '@vercel/blob';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const recordings = await db
      .select({
        recording: voiceRecording,
        transcript: voiceTranscript,
      })
      .from(voiceRecording)
      .leftJoin(
        voiceTranscript,
        eq(voiceTranscript.recordingId, voiceRecording.id),
      )
      .where(eq(voiceRecording.userId, session.user.id))
      .orderBy(desc(voiceRecording.createdAt));

    return NextResponse.json({ recordings });
  } catch (error) {
    console.error('Failed to fetch recordings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recordings' },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File;
    const title = (formData.get('title') as string) || 'Untitled Recording';
    const duration = parseInt((formData.get('duration') as string) || '0');

    if (!audioFile) {
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 },
      );
    }

    // Upload audio to Vercel Blob
    const blob = await put(
      `recordings/${session.user.id}/${Date.now()}-${audioFile.name}`,
      audioFile,
      {
        access: 'public',
      },
    );

    // Save recording to database
    const [newRecording] = await db
      .insert(voiceRecording)
      .values({
        userId: session.user.id,
        title,
        audioUrl: blob.url,
        duration,
        fileSize: audioFile.size,
        mimeType: audioFile.type,
      })
      .returning();

    return NextResponse.json({ recording: newRecording });
  } catch (error) {
    console.error('Failed to save recording:', error);
    return NextResponse.json(
      { error: 'Failed to save recording' },
      { status: 500 },
    );
  }
}
