import { auth } from '@/app/(auth)/auth';
import {
  deleteStreamIdsByChatId,
  getChatById,
  getStreamIdsByChatId,
  markLatestUserMessageAsStopped,
} from '@/lib/db/queries';
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
      console.warn(`Failed to mark message as stopped for chat ${chatId}:`, markError);
      // Continue with stream cleanup
    }

    // Get all stream IDs for this chat before deleting them
    let streamIds: string[] = [];
    try {
      streamIds = await getStreamIdsByChatId({ chatId });
      console.log(`Found ${streamIds.length} stream IDs for chat: ${chatId}`);
    } catch (error) {
      console.warn(`Failed to get stream IDs for chat ${chatId}:`, error);
    }

    // Clear Redis stream data for each stream ID
    if (streamIds.length > 0 && process.env.REDIS_URL) {
      try {
        const redisUrl = process.env.REDIS_URL.replace(/^["'](.*)["']$/, '$1');
        const redis = createClient({ url: redisUrl });

        await redis.connect();
        console.log('Connected to Redis for stream cleanup');

        // Clear resumable stream data from Redis
        // The resumable-stream library uses keys like: `resumable-stream:${streamId}:*`
        for (const streamId of streamIds) {
          try {
            // Delete all Redis keys related to this stream
            const keys = await redis.keys(`resumable-stream:${streamId}:*`);
            if (keys.length > 0) {
              await redis.del(keys);
              console.log(
                `Cleared ${keys.length} Redis keys for stream: ${streamId}`,
              );
            }

            // Also try to delete the main stream key
            await redis.del(`resumable-stream:${streamId}`);

            // Clear any pubsub channels related to this stream
            const pubsubKeys = await redis.keys(
              `resumable-stream:${streamId}:pubsub:*`,
            );
            if (pubsubKeys.length > 0) {
              await redis.del(pubsubKeys);
              console.log(
                `Cleared ${pubsubKeys.length} pubsub keys for stream: ${streamId}`,
              );
            }
          } catch (streamError) {
            console.warn(
              `Failed to clear Redis data for stream ${streamId}:`,
              streamError,
            );
          }
        }

        await redis.disconnect();
        console.log('Disconnected from Redis after cleanup');
      } catch (redisError) {
        console.warn(
          'Failed to connect to Redis for stream cleanup:',
          redisError,
        );
        // Continue anyway - database cleanup will still work
      }
    }

    // Delete all stream IDs from database to prevent resumption
    try {
      await deleteStreamIdsByChatId({ chatId });
      console.log(`Stream IDs deleted from database for chat: ${chatId}`);
    } catch (streamError) {
      console.warn(
        `Failed to delete stream IDs from database for chat ${chatId}:`,
        streamError,
      );
      // Continue anyway - Redis cleanup may have worked
    }

    console.log(`Stream stopped and cleaned up for chat: ${chatId}`);

    return new Response(
      JSON.stringify({
        success: true,
        clearedStreams: streamIds.length,
        message: 'Stream stopped and all resumable data cleared',
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
