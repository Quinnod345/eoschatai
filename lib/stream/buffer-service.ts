import 'server-only';

import { getRedisClient } from '../redis/client';

/**
 * UIMessage chunk structure for buffering
 */
export interface BufferedChunk {
  seq: number; // Sequence number for ordering
  timestamp: number;
  chunk: unknown; // The actual UIMessage chunk data
}

/**
 * Stream buffer state
 */
export interface StreamBufferState {
  streamId: string;
  chatId: string;
  messageId?: string;
  composerDocumentId?: string;
  status: 'active' | 'completed' | 'interrupted' | 'errored';
  chunkCount: number;
  createdAt: number;
  lastActiveAt: number;
  metadata?: Record<string, unknown>;
}

// Key patterns
const STREAM_CHUNKS_KEY = (streamId: string) => `stream:${streamId}:chunks`;
const STREAM_STATE_KEY = (streamId: string) => `stream:${streamId}:state`;
const STREAM_COMPOSER_KEY = (documentId: string) =>
  `composer:stream:${documentId}:content`;

// TTL values
const STREAM_TTL_SECONDS = 3600; // 1 hour
const COMPOSER_CONTENT_TTL_SECONDS = 1800; // 30 minutes

/**
 * Stream Buffer Service for buffering UIMessage chunks to Redis
 * Enables resumable streams on page reload
 */
export class StreamBufferService {
  private redis = getRedisClient();
  private sequenceCounter = 0;

  constructor(private streamId: string) {}

  /**
   * Check if Redis is available for buffering
   */
  isAvailable(): boolean {
    return this.redis !== null;
  }

  /**
   * Initialize a new stream buffer
   */
  async initializeStream(params: {
    chatId: string;
    messageId?: string;
    composerDocumentId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<boolean> {
    if (!this.redis) {
      console.log('[StreamBuffer] Redis not available, skipping initialization');
      return false;
    }

    try {
      const state: StreamBufferState = {
        streamId: this.streamId,
        chatId: params.chatId,
        messageId: params.messageId,
        composerDocumentId: params.composerDocumentId,
        status: 'active',
        chunkCount: 0,
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
        metadata: params.metadata,
      };

      await this.redis.setex(
        STREAM_STATE_KEY(this.streamId),
        STREAM_TTL_SECONDS,
        JSON.stringify(state),
      );

      console.log(`[StreamBuffer] Initialized stream buffer: ${this.streamId}`);
      return true;
    } catch (error) {
      console.error('[StreamBuffer] Failed to initialize stream:', error);
      return false;
    }
  }

  /**
   * Append a chunk to the stream buffer
   */
  async appendChunk(chunk: unknown): Promise<boolean> {
    if (!this.redis) {
      console.log('[StreamBuffer] Redis not available for chunk append');
      return false;
    }

    try {
      const bufferedChunk: BufferedChunk = {
        seq: this.sequenceCounter++,
        timestamp: Date.now(),
        chunk,
      };

      // Use RPUSH to append to the list
      const key = STREAM_CHUNKS_KEY(this.streamId);
      await this.redis.rpush(key, JSON.stringify(bufferedChunk));

      // Refresh TTL on each chunk
      await this.redis.expire(key, STREAM_TTL_SECONDS);

      // Log first few chunks and then every 50th
      if (this.sequenceCounter <= 3 || this.sequenceCounter % 50 === 0) {
        console.log(
          `[StreamBuffer] Appended chunk ${this.sequenceCounter} for stream ${this.streamId}`,
        );
      }

      // Update state chunk count periodically (every 10 chunks)
      if (this.sequenceCounter % 10 === 0) {
        await this.updateState({ chunkCount: this.sequenceCounter });
      }

      return true;
    } catch (error) {
      console.error('[StreamBuffer] Failed to append chunk:', error);
      return false;
    }
  }

  /**
   * Get buffered chunks from a specific sequence number
   */
  async getChunks(fromSeq = 0): Promise<BufferedChunk[]> {
    if (!this.redis) {
      return [];
    }

    try {
      const rawChunks = await this.redis.lrange(
        STREAM_CHUNKS_KEY(this.streamId),
        0,
        -1,
      );

      const chunks: BufferedChunk[] = rawChunks
        .map((raw: unknown) => {
          try {
            // Upstash auto-parses JSON, handle both cases
            if (typeof raw === 'object' && raw !== null) {
              return raw as BufferedChunk;
            }
            if (typeof raw === 'string') {
              return JSON.parse(raw) as BufferedChunk;
            }
            return null;
          } catch {
            return null;
          }
        })
        .filter((c): c is BufferedChunk => c !== null && c.seq >= fromSeq);

      console.log(
        `[StreamBuffer] Retrieved ${chunks.length} chunks from seq ${fromSeq}`,
      );
      return chunks;
    } catch (error) {
      console.error('[StreamBuffer] Failed to get chunks:', error);
      return [];
    }
  }

  /**
   * Get stream buffer state
   */
  async getState(): Promise<StreamBufferState | null> {
    if (!this.redis) {
      return null;
    }

    try {
      const stateData = await this.redis.get(STREAM_STATE_KEY(this.streamId));
      if (!stateData) {
        return null;
      }

      // Upstash auto-parses JSON, so handle both string and object cases
      if (typeof stateData === 'object') {
        return stateData as StreamBufferState;
      }

      // If it's a string, try to parse it
      if (typeof stateData === 'string') {
        return JSON.parse(stateData) as StreamBufferState;
      }

      return null;
    } catch (error) {
      console.error('[StreamBuffer] Failed to get state:', error);
      return null;
    }
  }

  /**
   * Update stream buffer state
   */
  async updateState(
    updates: Partial<Omit<StreamBufferState, 'streamId' | 'createdAt'>>,
  ): Promise<boolean> {
    if (!this.redis) {
      return false;
    }

    try {
      const currentState = await this.getState();
      if (!currentState) {
        return false;
      }

      const newState: StreamBufferState = {
        ...currentState,
        ...updates,
        lastActiveAt: Date.now(),
      };

      await this.redis.setex(
        STREAM_STATE_KEY(this.streamId),
        STREAM_TTL_SECONDS,
        JSON.stringify(newState),
      );

      return true;
    } catch (error) {
      console.error('[StreamBuffer] Failed to update state:', error);
      return false;
    }
  }

  /**
   * Mark stream as completed
   */
  async markCompleted(): Promise<boolean> {
    console.log(`[StreamBuffer] Marking stream completed: ${this.streamId}`);
    return this.updateState({
      status: 'completed',
      chunkCount: this.sequenceCounter,
    });
  }

  /**
   * Mark stream as interrupted (user stopped or page unloaded)
   */
  async markInterrupted(): Promise<boolean> {
    console.log(`[StreamBuffer] Marking stream interrupted: ${this.streamId}`);
    return this.updateState({
      status: 'interrupted',
      chunkCount: this.sequenceCounter,
    });
  }

  /**
   * Mark stream as errored
   */
  async markErrored(error?: string): Promise<boolean> {
    console.log(`[StreamBuffer] Marking stream errored: ${this.streamId}`);
    return this.updateState({
      status: 'errored',
      chunkCount: this.sequenceCounter,
      metadata: error ? { error } : undefined,
    });
  }

  /**
   * Cleanup stream buffer data
   */
  async cleanup(): Promise<boolean> {
    if (!this.redis) {
      return false;
    }

    try {
      await this.redis.del(
        STREAM_CHUNKS_KEY(this.streamId),
        STREAM_STATE_KEY(this.streamId),
      );
      console.log(`[StreamBuffer] Cleaned up stream: ${this.streamId}`);
      return true;
    } catch (error) {
      console.error('[StreamBuffer] Failed to cleanup:', error);
      return false;
    }
  }

  /**
   * Get the current chunk count
   */
  getChunkCount(): number {
    return this.sequenceCounter;
  }
}

/**
 * Composer content buffer for incremental saves during streaming
 */
export class ComposerContentBuffer {
  private redis = getRedisClient();

  constructor(private documentId: string) {}

  /**
   * Check if Redis is available
   */
  isAvailable(): boolean {
    return this.redis !== null;
  }

  /**
   * Save partial composer content
   */
  async savePartialContent(content: string): Promise<boolean> {
    if (!this.redis) {
      return false;
    }

    try {
      await this.redis.setex(
        STREAM_COMPOSER_KEY(this.documentId),
        COMPOSER_CONTENT_TTL_SECONDS,
        content,
      );
      return true;
    } catch (error) {
      console.error('[ComposerBuffer] Failed to save partial content:', error);
      return false;
    }
  }

  /**
   * Get partial composer content
   */
  async getPartialContent(): Promise<string | null> {
    if (!this.redis) {
      return null;
    }

    try {
      const content = await this.redis.get(STREAM_COMPOSER_KEY(this.documentId));
      return content as string | null;
    } catch (error) {
      console.error('[ComposerBuffer] Failed to get partial content:', error);
      return null;
    }
  }

  /**
   * Cleanup partial content
   */
  async cleanup(): Promise<boolean> {
    if (!this.redis) {
      return false;
    }

    try {
      await this.redis.del(STREAM_COMPOSER_KEY(this.documentId));
      return true;
    } catch (error) {
      console.error('[ComposerBuffer] Failed to cleanup:', error);
      return false;
    }
  }
}

/**
 * Get stream buffer state by stream ID (static helper)
 */
export async function getStreamBufferState(
  streamId: string,
): Promise<StreamBufferState | null> {
  const buffer = new StreamBufferService(streamId);
  return buffer.getState();
}

/**
 * Get buffered chunks by stream ID (static helper)
 */
export async function getBufferedChunks(
  streamId: string,
  fromSeq = 0,
): Promise<BufferedChunk[]> {
  const buffer = new StreamBufferService(streamId);
  return buffer.getChunks(fromSeq);
}

/**
 * Cleanup stream buffer by stream ID (static helper)
 */
export async function cleanupStreamBuffer(streamId: string): Promise<boolean> {
  const buffer = new StreamBufferService(streamId);
  return buffer.cleanup();
}
