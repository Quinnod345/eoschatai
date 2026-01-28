import { auth } from '@/app/(auth)/auth';
import {
  getChatById,
  getActiveStreamByChatId,
  markStreamInterrupted,
  markLatestUserMessageAsStopped,
} from '@/lib/db/queries';
import { cleanupStreamBuffer } from '@/lib/stream/buffer-service';
import { createClient } from 'redis';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: chatId } = await params;

  if (!chatId) {
    return new Response('Chat ID is required', { status: 400 });
  }

  const session = await auth();

  if (!session?.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    // Verify the chat exists and belongs to the user
    const chat = await getChatById({ id: chatId });

    if (!chat) {
      return new Response('Chat not found', { status: 404 });
    }

    if (chat.userId !== session.user.id) {
      return new Response('Forbidden', { status: 403 });
    }

    // Mark the latest user message as stopped so it doesn't count toward daily limit
    try {
      await markLatestUserMessageAsStopped({ chatId });
      console.log(`Marked latest user message as stopped for chat: ${chatId}`);
    } catch (markError) {
      console.warn(
        `Failed to mark message as stopped for chat ${chatId}:`,
        markError,
      );
      // Continue with stream cleanup
    }

    // Get active stream for this chat
    let activeStream = null;
    try {
      activeStream = await getActiveStreamByChatId({ chatId });
      if (activeStream) {
        console.log(`Found active stream for chat: ${chatId}`, {
          streamId: activeStream.id,
          status: activeStream.status,
          composerDocumentId: activeStream.composerDocumentId,
        });
      }
    } catch (error) {
      console.warn(`Failed to get active stream for chat ${chatId}:`, error);
    }

    // Mark stream as interrupted (not deleted) to allow content recovery
    if (activeStream) {
      try {
        // Get partial content from Redis buffer before marking as interrupted
        const { getStreamBufferState } = await import(
          '@/lib/stream/buffer-service'
        );
        const bufferState = await getStreamBufferState(activeStream.id);

        // Mark stream as interrupted with metadata
        const streamMeta = activeStream.metadata as {
          composerKind?: string;
          composerTitle?: string;
        } | null;
        await markStreamInterrupted({
          streamId: activeStream.id,
          metadata: {
            partialContent: bufferState?.metadata?.partialContent as
              | string
              | undefined,
            composerKind: streamMeta?.composerKind,
            composerTitle: streamMeta?.composerTitle,
          },
        });

        console.log(`Marked stream as interrupted: ${activeStream.id}`);
      } catch (interruptError) {
        console.warn(
          `Failed to mark stream as interrupted for ${activeStream?.id}:`,
          interruptError,
        );
      }

      // Clean up Redis buffer data (but keep database record for recovery)
      try {
        await cleanupStreamBuffer(activeStream.id);
        console.log(`Cleaned up Redis buffer for stream: ${activeStream.id}`);
      } catch (bufferError) {
        console.warn(
          `Failed to cleanup buffer for stream ${activeStream.id}:`,
          bufferError,
        );
      }
    }

    // Clean up legacy resumable-stream Redis data if any
    if (process.env.REDIS_URL) {
      try {
        const redisUrl = process.env.REDIS_URL.replace(/^["'](.*)["']$/, '$1');
        const redis = createClient({ url: redisUrl });

        await redis.connect();
        console.log('Connected to Redis for legacy stream cleanup');

        // Clean up legacy resumable-stream keys
        if (activeStream) {
          const streamId = activeStream.id;

          // Delete legacy resumable-stream keys
          const legacyKeys = await redis.keys(`resumable-stream:${streamId}:*`);
          if (legacyKeys.length > 0) {
            await redis.del(legacyKeys);
            console.log(
              `Cleared ${legacyKeys.length} legacy Redis keys for stream: ${streamId}`,
            );
          }

          // Delete legacy pubsub keys
          const pubsubKeys = await redis.keys(
            `resumable-stream:${streamId}:pubsub:*`,
          );
          if (pubsubKeys.length > 0) {
            await redis.del(pubsubKeys);
            console.log(
              `Cleared ${pubsubKeys.length} legacy pubsub keys for stream: ${streamId}`,
            );
          }

          // Delete nexus metadata if any
          await redis.del(`nexus:${streamId}:metadata`);
          await redis.del(`nexus:${streamId}:citations`);
        }

        await redis.disconnect();
        console.log('Disconnected from Redis after cleanup');
      } catch (redisError) {
        console.warn(
          'Failed to connect to Redis for stream cleanup:',
          redisError,
        );
        // Continue anyway - database state has been updated
      }
    }

    console.log(`Stream stopped and marked as interrupted for chat: ${chatId}`);

    return new Response(
      JSON.stringify({
        success: true,
        streamId: activeStream?.id || null,
        status: 'interrupted',
        message:
          'Stream stopped. Content has been saved and can be recovered on page reload.',
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );
  } catch (error) {
    console.error('Error stopping stream:', error);
    return new Response('Internal server error', { status: 500 });
  }
}
