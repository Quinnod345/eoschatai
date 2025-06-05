import { openai } from '@ai-sdk/openai';
import { embed } from 'ai';
import { Index } from '@upstash/vector';
import { db } from '@/lib/db';
import { userDocuments } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// Lazy initialization of Upstash Vector client for user RAG
let userRagClient: Index | null = null;

function getUserRagClient(): Index {
  if (!userRagClient) {
    const userRagUrl = process.env.UPSTASH_USER_RAG_REST_URL;
    const userRagToken = process.env.UPSTASH_USER_RAG_REST_TOKEN;

    if (!userRagUrl || !userRagToken) {
      throw new Error('Missing UPSTASH_USER_RAG environment variables');
    }

    userRagClient = new Index({
      url: userRagUrl,
      token: userRagToken,
    });
  }

  return userRagClient;
}

const embeddingModel = openai.embedding('text-embedding-ada-002');

// Cosine similarity function
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * WORKAROUND: Find relevant user content by fetching vectors by ID and computing similarity manually
 */
export const findRelevantUserContentWorkaround = async (
  userId: string,
  query: string,
  limit = 5,
  minRelevance = 0.5,
): Promise<{ content: string; relevance: number; metadata: any }[]> => {
  try {
    console.log(
      `User RAG Workaround: Searching for user ${userId} with query: "${query}" (threshold: ${minRelevance})`,
    );

    // Step 1: Get user documents from database to know which vectors exist
    const userDocs = await db
      .select()
      .from(userDocuments)
      .where(eq(userDocuments.userId, userId));

    if (userDocs.length === 0) {
      console.log(`User RAG Workaround: No documents found for user ${userId}`);
      return [];
    }

    console.log(
      `User RAG Workaround: Found ${userDocs.length} documents for user ${userId}`,
    );

    // Step 2: Generate embedding for the query
    const { embedding: queryEmbedding } = await embed({
      model: embeddingModel,
      value: query,
    });

    console.log(
      `User RAG Workaround: Generated ${queryEmbedding.length}-dimensional embedding`,
    );

    // Step 3: Fetch all vectors for user documents and compute similarity
    const results: { content: string; relevance: number; metadata: any }[] = [];

    for (const doc of userDocs) {
      console.log(`User RAG Workaround: Processing document ${doc.fileName}`);

      // Try to fetch vectors for this document (we know the ID pattern)
      let chunkIndex = 0;
      let foundChunks = 0;

      while (foundChunks < 20) {
        // Reasonable limit to avoid infinite loop
        const vectorId = `${doc.id}-${chunkIndex}`;

        try {
          const vectorResult = await getUserRagClient().fetch([vectorId], {
            namespace: userId,
            includeMetadata: true,
            includeVectors: true,
          });

          if (vectorResult?.[0]?.vector) {
            const vector = vectorResult[0];
            foundChunks++;

            // Compute cosine similarity
            const similarity = cosineSimilarity(queryEmbedding, vector.vector!);

            console.log(
              `User RAG Workaround: Vector ${vectorId} similarity: ${(similarity * 100).toFixed(1)}%`,
            );

            if (similarity >= minRelevance) {
              results.push({
                content: (vector.metadata?.chunk as string) || '',
                relevance: similarity,
                metadata: {
                  documentId: vector.metadata?.documentId,
                  fileName: vector.metadata?.fileName,
                  category: vector.metadata?.category,
                  fileType: vector.metadata?.fileType,
                  createdAt: vector.metadata?.createdAt,
                },
              });
            }
          } else {
            // No more vectors for this document
            break;
          }
        } catch (error) {
          // Vector doesn't exist, try next one
          break;
        }

        chunkIndex++;
      }

      console.log(
        `User RAG Workaround: Found ${foundChunks} chunks for document ${doc.fileName}`,
      );
    }

    // Step 4: Sort by relevance and return top results
    results.sort((a, b) => b.relevance - a.relevance);
    const topResults = results.slice(0, limit);

    console.log(
      `User RAG Workaround: Found ${results.length} total results, returning top ${topResults.length}`,
    );

    // Log top results
    topResults.forEach((result, i) => {
      const snippet = result.content.substring(0, 100);
      console.log(
        `User RAG Workaround chunk ${i + 1}: Relevance ${(result.relevance * 100).toFixed(1)}%, File: ${result.metadata.fileName}, Content: ${snippet}...`,
      );
    });

    return topResults;
  } catch (error) {
    console.error(
      `User RAG Workaround: Error in findRelevantUserContentWorkaround for user ${userId}:`,
      error,
    );
    return [];
  }
};
