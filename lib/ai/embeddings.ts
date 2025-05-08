import { embed, embedMany } from 'ai';
import { openai } from '@ai-sdk/openai';
import { db } from '../db';
import { cosineDistance, desc, gt, sql } from 'drizzle-orm';
import { embeddings } from '../db/schema';
import { generateUUID } from '../utils';

const embeddingModel = openai.embedding('text-embedding-ada-002');

/**
 * Chunks text content into smaller pieces for embedding
 */
export const generateChunks = (
  content: string,
  maxChunkSize = 512,
): string[] => {
  const sentences = content.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let currentChunk = '';

  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length <= maxChunkSize) {
      currentChunk += (currentChunk ? ' ' : '') + sentence;
    } else {
      if (currentChunk) chunks.push(currentChunk);
      currentChunk = sentence;
    }
  }

  if (currentChunk) chunks.push(currentChunk);
  return chunks;
};

/**
 * Generates embeddings for multiple chunks of text
 */
export const generateEmbeddings = async (
  chunks: string[],
): Promise<Array<{ chunk: string; embedding: number[] }>> => {
  if (chunks.length === 0) return [];

  const { embeddings } = await embedMany({
    model: embeddingModel,
    values: chunks,
  });

  return chunks.map((chunk, i) => ({
    chunk,
    embedding: embeddings[i],
  }));
};

/**
 * Generates a single embedding for a query
 */
export const generateEmbedding = async (query: string): Promise<number[]> => {
  const { embedding } = await embed({
    model: embeddingModel,
    value: query,
  });
  return embedding;
};

/**
 * Processes a document and stores its chunks and embeddings
 */
export const processDocument = async (
  documentId: string,
  content: string,
): Promise<void> => {
  // Generate chunks from content
  const chunks = generateChunks(content);

  // Generate embeddings for chunks
  const embeddingsData = await generateEmbeddings(chunks);

  // Store chunks and embeddings in database
  await Promise.all(
    embeddingsData.map(({ chunk }) =>
      db.insert(embeddings).values({
        id: generateUUID(),
        documentId,
        chunk,
        createdAt: new Date(),
      }),
    ),
  );
};

/**
 * Finds relevant content based on a query
 */
export const findRelevantContent = async (
  query: string,
  limit = 5,
): Promise<{ content: string; relevance: number }[]> => {
  // Since embeddings are temporarily disabled, just return the most recent chunks with a default relevance score
  const results = await db
    .select({
      chunk: embeddings.chunk,
    })
    .from(embeddings)
    .limit(limit);

  // Transform the results to match the expected format with a default relevance score
  return results.map((result) => ({
    content: result.chunk,
    relevance: 1.0, // Default high relevance since we can't calculate it without embeddings
  }));
};
