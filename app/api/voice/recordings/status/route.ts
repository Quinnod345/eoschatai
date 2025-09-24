import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import { voiceRecording, voiceTranscript } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { Redis } from '@upstash/redis';

export const runtime = 'nodejs';

let redis: Redis | null = null;
function getRedis() {
  if (redis) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  redis = new Redis({ url, token });
  return redis;
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const recordingId = searchParams.get('recordingId');
  if (!recordingId) {
    return NextResponse.json(
      { error: 'recordingId is required' },
      { status: 400 },
    );
  }

  try {
    // Verify ownership
    const [rec] = await db
      .select({ id: voiceRecording.id })
      .from(voiceRecording)
      .where(
        and(
          eq(voiceRecording.id, recordingId),
          eq(voiceRecording.userId, session.user.id),
        ),
      )
      .limit(1);

    if (!rec) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // If we already have a transcript, check if it's an error or success
    const [tr] = await db
      .select({ id: voiceTranscript.id, content: voiceTranscript.content })
      .from(voiceTranscript)
      .where(eq(voiceTranscript.recordingId, recordingId))
      .limit(1);
    if (tr) {
      // Check if content indicates an error
      if (tr.content?.startsWith('ERROR:')) {
        const errorMessage = tr.content.substring(6); // Remove "ERROR:" prefix
        return NextResponse.json({
          status: 'error',
          error: errorMessage,
          transcript: '', // Don't return error text as transcript
        });
      }
      return NextResponse.json({
        status: 'ready',
        transcript: tr.content || '',
      });
    }

    // Else, check Redis status if available
    const client = getRedis();
    if (client) {
      try {
        const status = await client.hgetall(`recording:status:${recordingId}`);
        if (status && (status as any).status) {
          return NextResponse.json({
            status: (status as any).status,
            ...(status as any),
          });
        }
      } catch (_) {
        // ignore cache failures
      }
    }

    // Default to uploading/transcribing unknown
    return NextResponse.json({ status: 'unknown' });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to get status' },
      { status: 500 },
    );
  }
}
