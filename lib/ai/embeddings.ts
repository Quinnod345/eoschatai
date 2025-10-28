import { embed, embedMany } from 'ai';
import { openai } from '@ai-sdk/openai';
import { Index } from '@upstash/vector';
import dotenv from 'dotenv';
import path from 'node:path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const upstashUrl = process.env.UPSTASH_VECTOR_REST_URL;
const upstashToken = process.env.UPSTASH_VECTOR_REST_TOKEN;

// Check if required environment variables are available
if (!upstashUrl || !upstashToken) {
  console.error('Error: Missing UPSTASH_VECTOR environment variables.');
  console.error(
    'Make sure UPSTASH_VECTOR_REST_URL and UPSTASH_VECTOR_REST_TOKEN are set in .env.local',
  );
  // Don't throw error here to allow the module to load, but operations will fail
}

// Configure Upstash Vector client
const upstashVectorClient =
  upstashUrl && upstashToken
    ? new Index({
        url: upstashUrl,
        token: upstashToken,
      })
    : null;

const embeddingModel = openai.embedding('text-embedding-ada-002');

// In-process cache for query embeddings to avoid duplicate work across RAG branches
type CachedEmbedding = { createdAtMs: number; vector: number[] };
const EMBEDDING_CACHE_TTL_MS = 60_000; // 60s
const EMBEDDING_CACHE_MAX_SIZE = 200;
const embeddingCache: Map<string, CachedEmbedding> = new Map();

function getCachedEmbeddingIfFresh(key: string): number[] | null {
  const cached = embeddingCache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.createdAtMs > EMBEDDING_CACHE_TTL_MS) {
    embeddingCache.delete(key);
    return null;
  }
  return cached.vector;
}

function setCachedEmbedding(key: string, vector: number[]) {
  if (embeddingCache.size >= EMBEDDING_CACHE_MAX_SIZE) {
    const firstKey = embeddingCache.keys().next().value as string | undefined;
    if (firstKey) embeddingCache.delete(firstKey);
  }
  embeddingCache.set(key, { createdAtMs: Date.now(), vector });
}

/**
 * Enhances a search query for better semantic matching
 */
const enhanceSearchQuery = (query: string): string => {
  const lowerQuery = query.toLowerCase();

  // Check for integrator-related queries
  if (lowerQuery.includes('integrator')) {
    // If about relationship with visionary
    if (
      lowerQuery.includes('visionary') ||
      lowerQuery.includes('relationship') ||
      lowerQuery.includes('work with') ||
      lowerQuery.includes('work together')
    ) {
      console.log('RAG: Enhancing query for visionary-integrator relationship');
      return 'visionary integrator relationship';
    }

    // If question asks about execution or implementing, simplify to core terms
    if (
      lowerQuery.includes('execute') ||
      lowerQuery.includes('execution') ||
      lowerQuery.includes('implement') ||
      lowerQuery.includes('how') ||
      lowerQuery.includes('vision')
    ) {
      console.log('RAG: Enhancing integrator search query for better matching');
      return 'integrator execute vision';
    }
  }

  // Return original query if no specific enhancement
  return query;
};

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
export const generateEmbedding = async (
  query: string | any,
): Promise<number[]> => {
  // Ensure the query is a string (in case it's passed as an object)
  let queryText = typeof query === 'string' ? query : '';

  // Handle case where the query might be an object with text property
  if (typeof query === 'object' && query !== null) {
    if (query.text && typeof query.text === 'string') {
      queryText = query.text;
    } else {
      // Try to convert to string if it's a complex object
      queryText = JSON.stringify(query);
    }
  }

  try {
    const cached = getCachedEmbeddingIfFresh(queryText);
    if (cached) return cached;

    const { embedding } = await embed({
      model: embeddingModel,
      value: queryText,
    });

    setCachedEmbedding(queryText, embedding);
    return embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    // Return empty array in case of error to avoid breaking the app
    return [];
  }
};

/**
 * Processes a document and stores its chunks and embeddings in Upstash Vector
 */
export const processDocument = async (
  documentId: string,
  content: string,
  options?: {
    useSummary?: boolean;
    documentKind?: string;
    documentTitle?: string;
  },
): Promise<void> => {
  if (!upstashVectorClient) {
    console.warn(
      'RAG: Skipping document processing because Upstash Vector is not configured.',
    );
    return;
  }

  const { useSummary = true, documentKind, documentTitle } = options || {};

  try {
    // CRITICAL FIX: Delete ALL old embeddings for this document first
    // This prevents orphaned chunks when document is edited
    console.log(`RAG: Deleting old embeddings for document ${documentId}`);
    try {
      // Query for all vectors with this documentId prefix
      const oldVectors = await upstashVectorClient.query({
        data: documentId, // Search by metadata
        topK: 1000, // Get all possible matches
        includeMetadata: true,
      });

      // Filter to exact documentId matches and collect IDs
      const idsToDelete: string[] = [];
      for (let i = 0; i < 100; i++) {
        // Max 100 chunks per document
        idsToDelete.push(`${documentId}-${i}`);
      }
      // Also delete summary chunk if exists
      idsToDelete.push(`${documentId}-summary`);

      // Delete in batches
      if (idsToDelete.length > 0) {
        await upstashVectorClient.delete(idsToDelete);
        console.log(
          `RAG: Deleted ${idsToDelete.length} potential old embeddings for document ${documentId}`,
        );
      }
    } catch (deleteError) {
      console.warn(
        'RAG: Error deleting old embeddings (continuing anyway):',
        deleteError,
      );
      // Continue even if delete fails - upsert will overwrite
    }

    // Check if document is large and should use summary
    const isLargeDocument = content.length > 5000;
    let summaryText = '';
    const shouldUseSummary = useSummary && isLargeDocument && documentKind;

    if (shouldUseSummary) {
      console.log(
        `RAG: Document is large (${content.length} chars), generating summary...`,
      );

      try {
        const { summarizeComposer } = await import('./composer-summarizer');
        const mockDocument = {
          id: documentId,
          title: documentTitle || 'Document',
          content,
          kind: documentKind as any,
        } as any;

        summaryText = await summarizeComposer(mockDocument);

        if (summaryText) {
          console.log(
            `RAG: Generated summary (${summaryText.length} chars, ${((summaryText.length / content.length) * 100).toFixed(1)}% of original)`,
          );

          // Store summary in database
          const { db } = await import('@/lib/db');
          const { document } = await import('@/lib/db/schema');
          const { eq } = await import('drizzle-orm');

          await db
            .update(document)
            .set({ contentSummary: summaryText })
            .where(eq(document.id, documentId));

          console.log(
            `RAG: Stored summary in database for document ${documentId}`,
          );
        }
      } catch (summaryError) {
        console.error('RAG: Error generating summary:', summaryError);
        // Continue with full content embeddings
      }
    }

    // Generate chunks from content (always create full content chunks as fallback)
    const chunks = generateChunks(content);
    console.log(`RAG: Generated ${chunks.length} chunks from full document content`);

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
      `RAG: Generated embeddings with dimension ${embeddingsData[0]?.embedding.length || 0}`,
    );

    // Store chunks and embeddings in Upstash Vector
    const vectors = embeddingsData.map(({ chunk, embedding }, index) => ({
      id: `${documentId}-${index}`,
      vector: embedding,
      metadata: {
        documentId,
        chunk,
        createdAt: new Date().toISOString(),
        isSummary: false,
      },
    }));

    // If we have a summary, also create summary embeddings (preferred for retrieval)
    if (summaryText && summaryText.length > 0) {
      console.log(`RAG: Generating embeddings for summary...`);

      const summaryChunks = generateChunks(summaryText, 512);
      const { embeddings: summaryEmbeddings } = await embedMany({
        model: embeddingModel,
        values: summaryChunks,
      });

      // Add summary vectors with special metadata
      const summaryVectors = summaryChunks.map((chunk, index) => ({
        id: `${documentId}-summary-${index}`,
        vector: summaryEmbeddings[index],
        metadata: {
          documentId,
          chunk,
          createdAt: new Date().toISOString(),
          isSummary: true, // Mark as summary for prioritized retrieval
        },
      }));

      vectors.push(...summaryVectors);
      console.log(
        `RAG: Added ${summaryVectors.length} summary embeddings (total: ${vectors.length} vectors)`,
      );
    }

    // Upsert vectors in batches to avoid rate limits
    const batchSize = 100;
    for (let i = 0; i < vectors.length; i += batchSize) {
      const batch = vectors.slice(i, i + batchSize);
      try {
        await upstashVectorClient.upsert(batch);
        console.log(
          `RAG: Successfully stored batch ${i / batchSize + 1} of ${Math.ceil(vectors.length / batchSize)}`,
        );
      } catch (upsertError) {
        console.error(
          `RAG: Error storing vector batch ${i / batchSize + 1}:`,
          upsertError,
        );
      }
    }

    console.log(
      `RAG: Successfully stored ${embeddingsData.length} embeddings in vector database`,
    );
  } catch (error) {
    console.error('RAG: Error processing document:', error);
    throw error; // Rethrow to let the caller handle it
  }
};

/**
 * Type for Upstash Vector query results
 */
type UpstashVectorResult = {
  id: string;
  score: number;
  vector?: number[];
  metadata?: {
    chunk?: string;
    documentId?: string;
    createdAt?: string;
  };
};

/**
 * Finds relevant content based on a query using Upstash Vector
 */
export const findRelevantContent = async (
  query: string | any,
  limit = 5,
  minRelevance = 0.8, // Increase to 80% for better quality matches
): Promise<{ content: string; relevance: number }[]> => {
  if (!upstashVectorClient) {
    console.warn(
      'RAG: Upstash Vector is not configured; returning no relevant content.',
    );
    return [];
  }

  try {
    // Ensure the query is a string (in case it's passed as an object)
    let queryText = typeof query === 'string' ? query : '';

    // Handle case where the query might be an object with text property
    if (typeof query === 'object' && query !== null) {
      if (query.text && typeof query.text === 'string') {
        queryText = query.text;
      } else {
        // Try to convert to string if it's a complex object
        queryText = JSON.stringify(query);
      }
    }

    // Enhance the search query for better semantic matching
    const enhancedQuery = enhanceSearchQuery(queryText);

    // Log the original and enhanced queries
    if (enhancedQuery !== queryText) {
      console.log(
        `RAG: Enhanced query from "${queryText}" to "${enhancedQuery}"`,
      );
    } else {
      console.log('RAG: Using original query:', queryText);
    }

    // Generate embedding for the query (reuse cached embedding when available)
    let embedding = getCachedEmbeddingIfFresh(enhancedQuery);
    if (!embedding) {
      const result = await embed({
        model: embeddingModel,
        value: enhancedQuery,
      });
      embedding = result.embedding;
      setCachedEmbedding(enhancedQuery, embedding);
    }

    // Log the dimensions for debugging
    console.log(`RAG: Generated ${embedding.length}-dimensional embedding`);

    try {
      // Query Upstash Vector using the embedding
      const results = await upstashVectorClient.query({
        vector: embedding,
        topK: limit + 5, // Get a few extra results so we can filter by relevance
        includeMetadata: true,
        includeVectors: false,
      });

      // Transform and filter the results by relevance
      const transformedResults = upstashToInternal(
        results as UpstashVectorResult[],
      );

      // Filter results by minimum relevance threshold
      const filteredResults = transformedResults.filter(
        (result) => result.relevance >= minRelevance,
      );

      // Log more detailed information about the results
      console.log(
        `RAG: Found ${transformedResults.length} results, ${filteredResults.length} above threshold (${minRelevance * 100}%)`,
      );

      // Show first few results with content snippets
      filteredResults.slice(0, 3).forEach((result, i) => {
        const snippet = result.content?.substring(0, 100) || '';
        console.log(
          `RAG chunk ${i + 1}: Relevance ${(result.relevance * 100).toFixed(1)}%, Content: ${snippet}...`,
        );
      });

      // Only return the limited number of high-quality results
      return filteredResults.slice(0, limit);
    } catch (upstashError: any) {
      console.error('Error querying Upstash Vector:', upstashError);

      // If getting dimension errors, log a more detailed error
      if (
        upstashError?.message &&
        typeof upstashError.message === 'string' &&
        upstashError.message.includes('Invalid vector dimension')
      ) {
        console.error(
          'Vector dimension mismatch. Please check your Upstash Vector index configuration.',
        );
        return [];
      }

      // For other errors, log but return empty results
      console.error('RAG: Unknown error with vector search, skipping');
      return [];
    }
  } catch (error: any) {
    console.error('Error in findRelevantContent:', error);
    console.log('RAG: Skipping search due to vector store errors');
    return [];
  }
};

/**
 * Helper function to convert between Upstash Vector and our internal format
 */
const upstashToInternal = (
  results: UpstashVectorResult[],
): Array<{ content: string; relevance: number }> => {
  return results.map((result: UpstashVectorResult) => ({
    content: result.metadata?.chunk || '',
    relevance: result.score || 0,
  }));
};

/**
 * Searches for and deletes content from vector store by keyword
 */
export const deleteContentByKeyword = async (
  keyword: string,
): Promise<{ deleted: number }> => {
  if (!upstashVectorClient) {
    console.warn('RAG: Upstash Vector is not configured; nothing to delete.');
    return { deleted: 0 };
  }

  try {
    // First, find entries containing the keyword
    const cached = getCachedEmbeddingIfFresh(keyword);
    const embedding =
      cached ||
      (
        await embed({
          model: embeddingModel,
          value: keyword,
        })
      ).embedding;
    if (!cached) setCachedEmbedding(keyword, embedding);

    // Search for similar vectors (potential matches)
    const results = await upstashVectorClient.query({
      vector: embedding,
      topK: 50, // Get many results to find all matches
      includeMetadata: true,
    });

    if (!results || results.length === 0) {
      console.log(`RAG: No vectors found matching keyword "${keyword}"`);
      return { deleted: 0 };
    }

    // Find exact keyword matches in metadata content
    const matchingIds = results
      .filter(
        (result) =>
          result.metadata?.chunk &&
          typeof result.metadata.chunk === 'string' &&
          result.metadata.chunk.toLowerCase().includes(keyword.toLowerCase()),
      )
      .map((result) => result.id);

    if (matchingIds.length === 0) {
      console.log(`RAG: No content found containing "${keyword}"`);
      return { deleted: 0 };
    }

    console.log(
      `RAG: Found ${matchingIds.length} vectors containing "${keyword}", deleting...`,
    );

    // Delete the matching vectors
    for (const id of matchingIds) {
      await upstashVectorClient.delete({ ids: [id as string] });
    }

    return { deleted: matchingIds.length };
  } catch (error) {
    console.error('RAG: Error deleting content:', error);
    throw error;
  }
};
