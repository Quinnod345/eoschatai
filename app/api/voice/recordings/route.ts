import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import { voiceRecording, voiceTranscript } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { put } from '@vercel/blob';
import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Background transcription function
async function transcribeInBackground(
  recordingId: string,
  audioUrl: string,
  mimeType: string | null,
  title: string | null,
  userId: string,
) {
  try {
    // Check if transcript already exists
    const existing = await db
      .select()
      .from(voiceTranscript)
      .where(eq(voiceTranscript.recordingId, recordingId))
      .limit(1);
    if (existing.length > 0) {
      return; // Already transcribed
    }

    // Fetch audio file
    const audioRes = await fetch(audioUrl);
    if (!audioRes.ok) {
      throw new Error('Failed to fetch audio from storage');
    }

    const arrayBuffer = await audioRes.arrayBuffer();
    const blob = new Blob([arrayBuffer], { type: mimeType || 'audio/mpeg' });

    // For MP4 files or problematic formats, we'll still try but use a simpler approach
    // OpenAI Whisper sometimes has issues with certain MP4 codecs
    const isProblematicFormat =
      mimeType?.includes('mp4') || mimeType?.includes('video');
    const fileExtension = isProblematicFormat
      ? 'm4a'
      : mimeType?.split('/')[1] || 'mp3';
    const fileName = `recording-${recordingId}.${fileExtension}`;

    // Create File object for OpenAI - if MP4, present it as M4A which is better supported
    const file = new File([blob], fileName, {
      type: isProblematicFormat ? 'audio/m4a' : mimeType || 'audio/mpeg',
    });

    // Call OpenAI Whisper API
    let transcription: any;
    try {
      transcription = await openai.audio.transcriptions.create({
        file,
        model: 'whisper-1',
        response_format: 'verbose_json',
        timestamp_granularities: ['segment'],
      } as any);
    } catch (whisperError: any) {
      console.error('Whisper API error:', whisperError);

      // If it's a format error, try again with basic settings
      if (
        whisperError.message?.includes('Invalid file format') ||
        whisperError.status === 400
      ) {
        console.log('Retrying with basic transcription settings...');
        try {
          // Try with minimal options - just the file and model
          transcription = await openai.audio.transcriptions.create({
            file,
            model: 'whisper-1',
          });

          // Convert simple response to verbose format
          if (
            typeof transcription === 'string' ||
            (transcription as any).text
          ) {
            const text =
              typeof transcription === 'string'
                ? transcription
                : (transcription as any).text;
            transcription = {
              text,
              segments: [],
            } as any;
          }
        } catch (retryError: any) {
          console.error('Retry also failed:', retryError);
          throw new Error(
            `Audio format not supported. Try converting to MP3 or M4A format. ${retryError?.message || ''}`,
          );
        }
      } else {
        throw whisperError;
      }
    }

    const data: any = transcription;
    const fullText: string = data.text || '';
    const segments = (data.segments || []).map((seg: any) => ({
      speaker: 1,
      text: String(seg.text || '').trim(),
      start: Number(seg.start || 0),
      end: Number(seg.end || 0),
    }));

    // Save transcript
    await db.insert(voiceTranscript).values({
      recordingId,
      fullTranscript: fullText,
      segments: segments as any,
      speakerCount: 1,
      content: fullText, // Add plain content for easy access
    });

    // Process for RAG if available
    try {
      const { processUserDocument } = await import('@/lib/ai/user-rag');
      const content =
        segments.length > 0
          ? segments
              .map(
                (seg: any) =>
                  `[${formatTime(seg.start)}-${formatTime(seg.end)}] ${seg.text}`,
              )
              .join('\n')
          : fullText;

      await processUserDocument(userId, recordingId, content, {
        fileName: title || 'Voice Recording',
        category: 'Recording',
        fileType: mimeType || 'audio',
      });
    } catch (e) {
      console.error('Error processing for RAG:', e);
    }
  } catch (error: any) {
    console.error('Transcription error:', error);

    // Save error state to database so UI can show it
    try {
      await db.insert(voiceTranscript).values({
        recordingId,
        fullTranscript: '',
        content: `[Transcription Error: ${error.message || 'Unknown error'}]`,
        segments: [] as any,
        speakerCount: 0,
      });
    } catch (dbError) {
      console.error('Failed to save error state:', dbError);
    }

    throw error;
  }
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

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
    const duration = Number.parseInt(
      (formData.get('duration') as string) || '0',
    );

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
        contentType: audioFile.type || undefined,
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

    // Kick off background transcription without waiting
    transcribeInBackground(
      newRecording.id,
      newRecording.audioUrl,
      newRecording.mimeType,
      newRecording.title,
      session.user.id,
    ).catch((err) => {
      console.error('Background transcription error:', err);
    });

    return NextResponse.json({
      id: newRecording.id,
      audioUrl: newRecording.audioUrl,
      duration: newRecording.duration,
    });
  } catch (error) {
    console.error('Failed to save recording:', error);
    return NextResponse.json(
      { error: 'Failed to save recording' },
      { status: 500 },
    );
  }
}
