import { openai } from '@ai-sdk/openai';
import { embed, embedMany } from 'ai';
import { Index } from '@upstash/vector';

// Lazy initialization of Upstash Vector client for user RAG
let userRagClient: Index | null = null;

function getUserRagClient(): Index {
  if (!userRagClient) {
    // Environment variables for user-specific RAG database
    const userRagUrl = process.env.UPSTASH_USER_RAG_REST_URL;
    const userRagToken = process.env.UPSTASH_USER_RAG_REST_TOKEN;

    // Check if required environment variables are available
    if (!userRagUrl || !userRagToken) {
      console.error('Error: Missing UPSTASH_USER_RAG environment variables.');
      console.error(
        'Make sure UPSTASH_USER_RAG_REST_URL and UPSTASH_USER_RAG_REST_TOKEN are set in .env.local',
      );
      throw new Error('Missing UPSTASH_USER_RAG environment variables');
    }

    // Configure Upstash Vector client for user RAG
    userRagClient = new Index({
      url: userRagUrl,
      token: userRagToken,
    });
  }

  return userRagClient;
}

const embeddingModel = openai.embedding('text-embedding-3-small');

/**
 * Generate text chunks from content for better embedding
 */
const generateChunks = (
  content: string,
  chunkSize = 1000,
  overlap = 200,
): string[] => {
  const chunks: string[] = [];
  const sentences = content.split(/[.!?]+/).filter((s) => s.trim().length > 0);

  let currentChunk = '';

  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();
    if (!trimmedSentence) continue;

    // If adding this sentence would exceed chunk size, save current chunk and start new one
    if (
      currentChunk.length + trimmedSentence.length > chunkSize &&
      currentChunk.length > 0
    ) {
      chunks.push(currentChunk.trim());

      // Start new chunk with overlap from previous chunk
      const words = currentChunk.split(' ');
      const overlapWords = words.slice(-Math.floor(overlap / 10)); // Approximate word overlap
      currentChunk = `${overlapWords.join(' ')} ${trimmedSentence}`;
    } else {
      currentChunk += `${currentChunk ? ' ' : ''}${trimmedSentence}`;
    }
  }

  // Add the last chunk if it has content
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  // If no chunks were created (very short content), return the original content
  return chunks.length > 0 ? chunks : [content];
};

/**
 * Process a user document and store its chunks and embeddings in user-specific namespace
 */
export const processUserDocument = async (
  userId: string,
  documentId: string,
  content: string,
  metadata: {
    fileName: string;
    category: string;
    fileType?: string;
  },
): Promise<void> => {
  try {
    console.log(
      `User RAG: Processing document ${documentId} for user ${userId}`,
    );

    // Generate chunks from content
    const chunks = generateChunks(content);
    console.log(`User RAG: Generated ${chunks.length} chunks from document`);

    // Generate embeddings for chunks
    const { embeddings } = await embedMany({
      model: embeddingModel,
      values: chunks,
    });

    // Combine chunks with embeddings
    const embeddingsData = chunks.map((chunk, i) => ({
      chunk,
      embedding: embeddings[i],
    }));

    console.log(
      `User RAG: Generated embeddings with dimension ${embeddingsData[0]?.embedding.length || 0}`,
    );

    // Store chunks and embeddings in user-specific namespace
    const vectors = embeddingsData.map(({ chunk, embedding }, index) => ({
      id: `${documentId}-${index}`,
      vector: embedding,
      metadata: {
        userId,
        documentId,
        chunk,
        fileName: metadata.fileName,
        category: metadata.category,
        fileType: metadata.fileType || 'unknown',
        createdAt: new Date().toISOString(),
      },
    }));

    // Upsert vectors in batches to avoid rate limits, using user namespace
    const batchSize = 100;
    const namespaceClient = getUserRagClient().namespace(userId);

    for (let i = 0; i < vectors.length; i += batchSize) {
      const batch = vectors.slice(i, i + batchSize);
      try {
        await namespaceClient.upsert(batch);
        console.log(
          `User RAG: Successfully stored batch ${i / batchSize + 1} of ${Math.ceil(vectors.length / batchSize)} in namespace ${userId}`,
        );
      } catch (upsertError) {
        console.error(
          `User RAG: Error storing vector batch ${i / batchSize + 1} for user ${userId}:`,
          upsertError,
        );
      }
    }

    console.log(
      `User RAG: Successfully stored ${embeddingsData.length} embeddings for user ${userId}`,
    );
  } catch (error) {
    console.error(
      `User RAG: Error processing document for user ${userId}:`,
      error,
    );
    throw error;
  }
};

/**
 * Find relevant user documents based on a query using user-specific namespace
 */
export const findRelevantUserContent = async (
  userId: string,
  query: string,
  limit = 5,
  minRelevance = 0.4, // text-embedding-3-small produces lower cosine scores than ada-002
  precomputedEmbedding?: number[],
): Promise<{ content: string; relevance: number; metadata: any }[]> => {
  try {
    console.log(
      `User RAG: Searching for user ${userId} with query: "${query}" (threshold: ${minRelevance})`,
    );

    // Reuse embedding when provided by the caller to avoid duplicate generation.
    const embedding =
      Array.isArray(precomputedEmbedding) && precomputedEmbedding.length > 0
        ? precomputedEmbedding
        : (
            await embed({
              model: embeddingModel,
              value: query,
            })
          ).embedding;

    console.log(
      `User RAG: Generated ${embedding.length}-dimensional embedding`,
    );

    try {
      // Use namespace method for proper namespace handling
      const namespaceClient = getUserRagClient().namespace(userId);

      const results = await namespaceClient.query({
        vector: embedding,
        topK: limit + 10, // Get extra results for filtering
        includeMetadata: true,
        includeVectors: false,
      });

      console.log(
        `User RAG: Query returned ${results?.length || 0} results from namespace ${userId}`,
      );

      if (!results || results.length === 0) {
        console.log(`User RAG: No results found in namespace ${userId}`);
        return [];
      }

      // No need to filter by userId anymore since we're using namespace
      const userResults = results;
      console.log(
        `User RAG: Found ${userResults.length} results for user ${userId}`,
      );

      if (userResults.length === 0) {
        console.log(
          `User RAG: No results found for user ${userId} after filtering by userId`,
        );
        return [];
      }

      // Log user-specific results before further filtering
      userResults.slice(0, 5).forEach((result: any, i: number) => {
        console.log(`User RAG User Result ${i + 1}:`, {
          score: result.score,
          fileName: result.metadata?.fileName,
          category: result.metadata?.category,
          contentPreview:
            `${result.metadata?.chunk?.substring(0, 50)}...` || 'No content',
        });
      });

      // Transform and filter results by relevance
      const transformedResults = userResults
        .map((result: any) => ({
          content: result.metadata?.chunk || '',
          relevance: result.score || 0,
          metadata: {
            documentId: result.metadata?.documentId,
            fileName: result.metadata?.fileName,
            category: result.metadata?.category,
            fileType: result.metadata?.fileType,
            createdAt: result.metadata?.createdAt,
          },
        }))
        .filter(
          (result) =>
            result.relevance >= minRelevance && result.content.length > 0,
        );

      console.log(
        `User RAG: Found ${results.length} results, ${transformedResults.length} above threshold (${minRelevance * 100}%) for user ${userId}`,
      );

      // Log top results
      transformedResults.slice(0, 3).forEach((result, i) => {
        const snippet = result.content.substring(0, 100);
        console.log(
          `User RAG chunk ${i + 1}: Relevance ${(result.relevance * 100).toFixed(1)}%, File: ${result.metadata.fileName}, Content: ${snippet}...`,
        );
      });

      return transformedResults.slice(0, limit);
    } catch (upstashError: any) {
      console.error(
        `User RAG: Error querying namespace ${userId}:`,
        upstashError,
      );
      return [];
    }
  } catch (error) {
    console.error(
      `User RAG: Error in findRelevantUserContent for user ${userId}:`,
      error,
    );
    return [];
  }
};

/**
 * Delete all documents for a user from their namespace
 */
export const deleteUserDocuments = async (
  userId: string,
): Promise<{ deleted: number }> => {
  try {
    console.log(`User RAG: Deleting all documents for user ${userId}`);

    const namespaceClient = getUserRagClient().namespace(userId);

    // Use range to list all vectors in the namespace
    const vectorIds: string[] = [];
    let cursor = '';

    while (true) {
      const rangeResult = await namespaceClient.range({
        cursor,
        limit: 1000,
        includeMetadata: false,
        includeVectors: false,
      });

      if (rangeResult.vectors) {
        vectorIds.push(...rangeResult.vectors.map((v) => v.id));
      }

      if (!rangeResult.nextCursor) {
        break;
      }

      cursor = rangeResult.nextCursor;
    }

    if (vectorIds.length === 0) {
      console.log(`User RAG: No documents found for user ${userId}`);
      return { deleted: 0 };
    }

    // Delete all vectors in batches
    const batchSize = 100;
    for (let i = 0; i < vectorIds.length; i += batchSize) {
      const batch = vectorIds.slice(i, i + batchSize);
      await namespaceClient.delete(batch);
    }

    console.log(
      `User RAG: Deleted ${vectorIds.length} vectors for user ${userId}`,
    );

    return { deleted: vectorIds.length };
  } catch (error) {
    console.error(
      `User RAG: Error deleting documents for user ${userId}:`,
      error,
    );
    throw error;
  }
};

/**
 * Delete a specific document for a user
 */
export const deleteUserDocument = async (
  userId: string,
  documentId: string,
): Promise<{ deleted: number }> => {
  try {
    console.log(`User RAG: Deleting document ${documentId} for user ${userId}`);

    // Use the user-specific namespace client
    const namespaceClient = getUserRagClient().namespace(userId);

    // Use range to list all vectors in the user's namespace
    const vectorIds: string[] = [];
    let cursor = '';

    while (true) {
      const rangeResult = await namespaceClient.range({
        cursor,
        limit: 1000,
        includeMetadata: true,
        includeVectors: false,
      });

      if (rangeResult.vectors) {
        // Filter vectors that belong to this document
        const documentVectorIds = rangeResult.vectors
          .filter((v) => v.metadata?.documentId === documentId)
          .map((v) => v.id);

        vectorIds.push(...documentVectorIds);
      }

      if (!rangeResult.nextCursor) {
        break;
      }

      cursor = rangeResult.nextCursor;
    }

    if (vectorIds.length === 0) {
      console.log(
        `User RAG: No vectors found for document ${documentId} of user ${userId}`,
      );
      return { deleted: 0 };
    }

    // Delete vectors in batches
    const batchSize = 100;
    for (let i = 0; i < vectorIds.length; i += batchSize) {
      const batch = vectorIds.slice(i, i + batchSize);
      await namespaceClient.delete(batch);
    }

    console.log(
      `User RAG: Deleted ${vectorIds.length} vectors for document ${documentId} of user ${userId}`,
    );

    return { deleted: vectorIds.length };
  } catch (error) {
    console.error(
      `User RAG: Error deleting document ${documentId} for user ${userId}:`,
      error,
    );
    throw error;
  }
};

/**
 * Get user document statistics
 */
export const getUserDocumentStats = async (
  userId: string,
): Promise<{
  totalChunks: number;
  documentCount: number;
  categories: string[];
}> => {
  try {
    console.log(`User RAG: Getting stats for user ${userId}`);

    // Query vectors for the user (limited to avoid rate limits)
    const allVectors = await getUserRagClient().query({
      vector: new Array(1536).fill(0), // Dummy vector
      topK: 100, // Reasonable limit to avoid exceeding read limits
      includeMetadata: true,
      includeVectors: false,
    });

    if (!allVectors || allVectors.length === 0) {
      return { totalChunks: 0, documentCount: 0, categories: [] };
    }

    const documentIds = new Set<string>();
    const categories = new Set<string>();

    allVectors.forEach((v: any) => {
      if (v.metadata?.documentId) {
        documentIds.add(v.metadata.documentId);
      }
      if (v.metadata?.category) {
        categories.add(v.metadata.category);
      }
    });

    return {
      totalChunks: allVectors.length,
      documentCount: documentIds.size,
      categories: Array.from(categories),
    };
  } catch (error) {
    console.error(`User RAG: Error getting stats for user ${userId}:`, error);
    return { totalChunks: 0, documentCount: 0, categories: [] };
  }
};

/**
 * Debug function to check what's in a user's namespace
 */
export const debugUserNamespace = async (
  userId: string,
): Promise<{
  totalVectors: number;
  sampleVectors: any[];
  namespaceInfo: any;
}> => {
  try {
    console.log(`User RAG Debug: Checking vectors for user ${userId}`);

    // Use namespace to get vectors for this user
    const namespaceClient = getUserRagClient().namespace(userId);

    // Use range to list vectors in the namespace
    const rangeResult = await namespaceClient.range({
      cursor: '',
      limit: 100,
      includeMetadata: true,
      includeVectors: false,
    });

    const userVectors = rangeResult.vectors || [];

    console.log(
      `User RAG Debug: Found ${userVectors.length} vectors in namespace ${userId}`,
    );

    // Log sample vectors with their metadata
    const sampleVectors = userVectors.slice(0, 5).map((v: any) => ({
      id: v.id,
      score: v.score,
      metadata: v.metadata,
      contentPreview:
        `${v.metadata?.chunk?.substring(0, 100)}...` || 'No content',
    }));

    sampleVectors.forEach((v, i) => {
      console.log(`User RAG Debug Vector ${i + 1}:`, {
        id: v.id,
        fileName: v.metadata?.fileName,
        category: v.metadata?.category,
        contentPreview: v.contentPreview,
      });
    });

    return {
      totalVectors: userVectors.length,
      sampleVectors,
      namespaceInfo: {
        userId,
        hasVectors: userVectors.length > 0,
        vectorIds: userVectors.map((v: any) => v.id),
      },
    };
  } catch (error) {
    console.error(
      `User RAG Debug: Error checking vectors for user ${userId}:`,
      error,
    );
    return {
      totalVectors: 0,
      sampleVectors: [],
      namespaceInfo: {
        error: error instanceof Error ? error.message : String(error),
      },
    };
  }
};

/**
 * Enhanced search function with lower threshold for debugging
 */
export const findRelevantUserContentDebug = async (
  userId: string,
  query: string,
  limit = 10,
  minRelevance = 0.3, // Lower threshold for debugging
): Promise<{ content: string; relevance: number; metadata: any }[]> => {
  try {
    console.log(
      `User RAG Debug: Searching for user ${userId} with query: "${query}" (threshold: ${minRelevance})`,
    );

    // Generate embedding for the query
    const { embedding } = await embed({
      model: embeddingModel,
      value: query,
    });

    console.log(
      `User RAG Debug: Generated ${embedding.length}-dimensional embedding`,
    );

    try {
      // Query user-specific namespace in Upstash Vector
      const results = await getUserRagClient().query({
        vector: embedding,
        topK: limit + 10, // Get extra results for filtering
        includeMetadata: true,
        includeVectors: false,
        // Use user-specific namespace (removed due to API changes)
      });

      console.log(
        `User RAG Debug: Raw query returned ${results?.length || 0} results`,
      );

      if (!results || results.length === 0) {
        console.log(`User RAG Debug: No results found for user ${userId}`);

        // Also check if there are ANY vectors in the namespace
        const debugInfo = await debugUserNamespace(userId);
        console.log(
          `User RAG Debug: Namespace has ${debugInfo.totalVectors} total vectors`,
        );

        return [];
      }

      // Log all results before filtering
      results.forEach((result: any, i: number) => {
        console.log(`User RAG Debug Result ${i + 1}:`, {
          score: result.score,
          fileName: result.metadata?.fileName,
          contentPreview:
            `${result.metadata?.chunk?.substring(0, 50)}...` || 'No content',
        });
      });

      // Transform and filter results
      const transformedResults = results
        .map((result: any) => ({
          content: result.metadata?.chunk || '',
          relevance: result.score || 0,
          metadata: {
            documentId: result.metadata?.documentId,
            fileName: result.metadata?.fileName,
            category: result.metadata?.category,
            fileType: result.metadata?.fileType,
            createdAt: result.metadata?.createdAt,
          },
        }))
        .filter(
          (result) =>
            result.relevance >= minRelevance && result.content.length > 0,
        );

      console.log(
        `User RAG Debug: Found ${results.length} results, ${transformedResults.length} above threshold (${minRelevance * 100}%) for user ${userId}`,
      );

      // Log top results
      transformedResults.slice(0, 5).forEach((result, i) => {
        const snippet = result.content.substring(0, 100);
        console.log(
          `User RAG Debug chunk ${i + 1}: Relevance ${(result.relevance * 100).toFixed(1)}%, File: ${result.metadata.fileName}, Content: ${snippet}...`,
        );
      });

      return transformedResults.slice(0, limit);
    } catch (upstashError: any) {
      console.error(
        `User RAG Debug: Error querying namespace ${userId}:`,
        upstashError,
      );
      return [];
    }
  } catch (error) {
    console.error(
      `User RAG Debug: Error in findRelevantUserContentDebug for user ${userId}:`,
      error,
    );
    return [];
  }
};
