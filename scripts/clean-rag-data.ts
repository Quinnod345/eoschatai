import { embed } from 'ai';
import { openai } from '@ai-sdk/openai';
import { Index } from '@upstash/vector';
import dotenv from 'dotenv';
import path from 'node:path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Setup Upstash Vector client
const upstashVectorClient = new Index({
  url: process.env.UPSTASH_VECTOR_REST_URL || '',
  token: process.env.UPSTASH_VECTOR_REST_TOKEN || '',
});

// OpenAI embedding model
const embeddingModel = openai.embedding('text-embedding-ada-002');

/**
 * Truncates a vector to the specified dimension
 */
const truncateVector = (vector: number[], targetDimension = 1024): number[] => {
  if (vector.length <= targetDimension) {
    return vector;
  }
  return vector.slice(0, targetDimension);
};

/**
 * Searches for and deletes content from vector store by keyword
 */
async function deleteContentByKeyword(
  keyword: string,
): Promise<{ deleted: number }> {
  try {
    console.log(`Searching for content containing "${keyword}"...`);

    // First, find entries containing the keyword
    const { embedding } = await embed({
      model: embeddingModel,
      value: keyword,
    });

    // Truncate the embedding for Upstash Vector
    const truncatedEmbedding = truncateVector(embedding, 1024);

    // Search for similar vectors (potential matches)
    const results = await upstashVectorClient.query({
      vector: truncatedEmbedding,
      topK: 50, // Get many results to find all matches
      includeMetadata: true,
    });

    if (!results || results.length === 0) {
      console.log(`No vectors found matching keyword "${keyword}"`);
      return { deleted: 0 };
    }

    // Find exact keyword matches in metadata content
    console.log(
      `Found ${results.length} potential matches, checking content...`,
    );

    // Display the first few results
    results.slice(0, 5).forEach((result, i) => {
      const metadataChunk = result.metadata?.chunk;
      const chunkPreview =
        typeof metadataChunk === 'string'
          ? metadataChunk.substring(0, 100)
          : '[No text content]';

      console.log(
        `Result ${i + 1}:`,
        chunkPreview,
        `... (score: ${result.score?.toFixed(2)})`,
      );
    });

    // Find exact keyword matches
    const matchingIds = results
      .filter(
        (result) =>
          result.metadata?.chunk &&
          typeof result.metadata.chunk === 'string' &&
          result.metadata.chunk.toLowerCase().includes(keyword.toLowerCase()),
      )
      .map((result) => String(result.id));

    if (matchingIds.length === 0) {
      console.log(`No content found containing "${keyword}"`);
      return { deleted: 0 };
    }

    console.log(
      `Found ${matchingIds.length} vectors containing "${keyword}", deleting...`,
    );

    // Delete the matching vectors
    for (const id of matchingIds) {
      await upstashVectorClient.delete({ ids: [id] });
      console.log(`Deleted vector with ID: ${id}`);
    }

    return { deleted: matchingIds.length };
  } catch (error) {
    console.error('Error deleting content:', error);
    throw error;
  }
}

// Main function to run the script
async function main() {
  const keywordToDelete = process.argv[2] || 'gala apples';

  if (
    !process.env.UPSTASH_VECTOR_REST_URL ||
    !process.env.UPSTASH_VECTOR_REST_TOKEN
  ) {
    console.error(
      'Error: UPSTASH_VECTOR_REST_URL and UPSTASH_VECTOR_REST_TOKEN must be set',
    );
    process.exit(1);
  }

  console.log('Running RAG database cleanup');
  console.log(`Target keyword: "${keywordToDelete}"`);

  try {
    const result = await deleteContentByKeyword(keywordToDelete);
    console.log(
      `Successfully deleted ${result.deleted} vectors containing "${keywordToDelete}"`,
    );
  } catch (error) {
    console.error('Failed to clean up database:', error);
    process.exit(1);
  }
}

// Run the script
main().catch(console.error);
