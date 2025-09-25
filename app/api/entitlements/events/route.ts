import { NextResponse } from 'next/server';

import { FEATURE_FLAGS } from '@/lib/config/feature-flags';
import { getRedisClient } from '@/lib/redis/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!FEATURE_FLAGS.entitlements_ws) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('user_id');
  if (!userId) {
    return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });
  }

  const redis = getRedisClient();
  if (!redis) {
    return NextResponse.json({ error: 'Realtime disabled' }, { status: 503 });
  }

  const subscriber = redis.subscribe(`user:${userId}`);

  let heartbeat: NodeJS.Timeout | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();

      const send = (event: string, data?: unknown) => {
        const payload = data ? `event: ${event}\ndata: ${JSON.stringify(data)}\n\n` : `event: ${event}\n\n`;
        controller.enqueue(encoder.encode(payload));
      };

      send('ready', { ok: true });

      const messageListener = (event: { message: unknown }) => {
        send('message', event.message);
      };

      const errorListener = (error: Error) => {
        console.error('[entitlements.events] Redis subscription error', error);
        send('error', { error: error.message });
      };

      subscriber.on('message', messageListener);
      subscriber.on('error', errorListener);

      heartbeat = setInterval(() => {
        send('heartbeat');
      }, 30_000);
    },
    async cancel() {
      if (heartbeat) {
        clearInterval(heartbeat);
      }
      subscriber.removeAllListeners();
      await subscriber.unsubscribe();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      Connection: 'keep-alive',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}
