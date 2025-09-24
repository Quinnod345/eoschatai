import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import { voiceRecording, voiceTranscript } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import OpenAI from 'openai';
import { Redis } from '@upstash/redis';

// Node runtime (transcription may take time)
export const runtime = 'nodejs';

// Initialize OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Optional Redis for job status tracking
let redis: Redis | null = null;
function getRedis() {
  if (redis) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  redis = new Redis({ url, token });
  return redis;
}

function formatSeconds(secs: number | undefined): string {
  const safe = !secs || secs < 0 ? 0 : secs;
  const m = Math.floor(safe / 60);
  const s = Math.floor(safe % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

async function setStatus(recordingId: string, status: string, error?: string) {
  const client = getRedis();
  if (!client) return;
  try {
    await client.hset(`recording:status:${recordingId}`, {
      status,
      error: error || '',
      updatedAt: Date.now().toString(),
    });
    await client.expire(`recording:status:${recordingId}`, 60 * 60); // 1 hour TTL
  } catch (e) {
    // ignore cache failures
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const recordingId = body?.recordingId as string | undefined;
    if (!recordingId) {
      return NextResponse.json(
        { error: 'recordingId is required' },
        { status: 400 },
      );
    }

    // Verify recording exists and belongs to user
    const [rec] = await db
      .select()
      .from(voiceRecording)
      .where(
        and(
          eq(voiceRecording.id, recordingId),
          eq(voiceRecording.userId, session.user.id),
        ),
      )
      .limit(1);

    if (!rec) {
      return NextResponse.json(
        { error: 'Recording not found' },
        { status: 404 },
      );
    }

    // If transcript already exists, short-circuit
    const existing = await db
      .select()
      .from(voiceTranscript)
      .where(eq(voiceTranscript.recordingId, recordingId))
      .limit(1);
    if (existing.length > 0) {
      return NextResponse.json({ status: 'ready' });
    }

    // Mark status as queued
    await setStatus(recordingId, 'queued');

    // Fetch audio file from blob storage
    const audioRes = await fetch(rec.audioUrl);
    if (!audioRes.ok) {
      await setStatus(recordingId, 'error', 'Failed to fetch audio');
      return NextResponse.json(
        { error: 'Failed to fetch audio from storage' },
        { status: 502 },
      );
    }
    const arrayBuffer = await audioRes.arrayBuffer();
    const contentType = rec.mimeType || 'audio/mpeg';
    const fileName = `recording-${recordingId}.${
      contentType.split('/')[1] || 'mp3'
    }`;

    // Construct a File for OpenAI API
    const file = new File(
      [new Blob([arrayBuffer], { type: contentType })],
      fileName,
      {
        type: contentType,
      },
    );

    // Start transcription
    await setStatus(recordingId, 'transcribing');

    const transcription = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['segment'],
    } as any);

    const data: any = transcription;
    const fullText: string = data.text || '';
    const segs: any[] = Array.isArray(data.segments) ? data.segments : [];

    // Build enriched segments with time ranges and naive speaker tag
    const segments = segs.map((seg: any) => ({
      speaker: 1,
      text: String(seg.text || '').trim(),
      start: Number(seg.start || 0),
      end: Number(seg.end || 0),
    }));

    // Save transcript to DB (upsert behavior)
    // Delete old record if any to avoid unique conflicts
    try {
      await db
        .delete(voiceTranscript)
        .where(eq(voiceTranscript.recordingId, recordingId));
    } catch (_) {
      // ignore
    }

    await db.insert(voiceTranscript).values({
      recordingId,
      fullTranscript: fullText,
      segments: segments as any,
      speakerCount: 1,
    });

    // Build content with embedded timecodes for RAG
    const content = (
      segments.length > 0
        ? segments
            .map(
              (seg) =>
                `[$${formatSeconds(seg.start)}-$${formatSeconds(seg.end)}] ${seg.text}`,
            )
            .join('\n')
        : fullText
    ).trim();

    try {
      const { processUserDocument } = await import('@/lib/ai/user-rag');
      await processUserDocument(session.user.id, recordingId, content, {
        fileName: rec.title || 'Voice Recording',
        category: 'Recording',
        fileType: rec.mimeType || 'audio',
      });
    } catch (e) {
      // RAG failure should not fail the whole request, but log it
      console.error('Error generating embeddings for recording', e);
    }

    await setStatus(recordingId, 'ready');

    return NextResponse.json({ status: 'ready' });
  } catch (error: any) {
    console.error('Transcription error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to transcribe recording' },
      { status: 500 },
    );
  }
}
