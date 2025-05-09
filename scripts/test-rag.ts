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
 * Helper function to convert between Upstash Vector and our internal format
 */
const upstashToInternal = (
  results: any[],
): Array<{ content: string; relevance: number }> => {
  return results.map((result) => ({
    content: result.metadata?.chunk || '',
    relevance: result.score || 0,
  }));
};

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
      console.log(
        'RAG TEST: Enhancing query for visionary-integrator relationship',
      );
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
      console.log(
        'RAG TEST: Enhancing integrator search query for better matching',
      );
      return 'integrator execute vision';
    }
  }

  // Return original query if no specific enhancement
  return query;
};

/**
 * Test RAG search with a specific query
 */
async function testRagSearch(query: string): Promise<void> {
  try {
    console.log(`RAG TEST: Searching for "${query}"`);

    // Enhance the query for better matching
    const enhancedQuery = enhanceSearchQuery(query);
    if (enhancedQuery !== query) {
      console.log(`RAG TEST: Enhanced query to "${enhancedQuery}"`);
    }

    // Generate embedding for the query
    const { embedding } = await embed({
      model: embeddingModel,
      value: enhancedQuery,
    });

    console.log(
      `RAG TEST: Generated ${embedding.length}-dimensional embedding`,
    );

    // Query Upstash Vector using the embedding
    const results = await upstashVectorClient.query({
      vector: embedding,
      topK: 10, // Get top 10 results
      includeMetadata: true,
      includeVectors: false,
    });

    console.log(`RAG TEST: Found ${results.length} results.`);

    // Log a sample raw result to see its structure
    if (results.length > 0) {
      console.log('\nRAW RESULT STRUCTURE:');
      console.log(JSON.stringify(results[0], null, 2));
    }

    // Display ALL results with their relevance scores
    console.log('------------- RAG TEST RESULTS -------------');

    const transformedResults = upstashToInternal(results);

    // For each result, try to fetch the full document
    console.log('Fetching full documents for each result...');
    for (let i = 0; i < results.length; i++) {
      try {
        const result = results[i];
        console.log(`\nResult #${i + 1}:`);
        console.log(`  ID: ${result.id}`);
        console.log(`  Relevance: ${(result.score * 100).toFixed(2)}%`);

        // Now fetch the document by ID to get full metadata
        const document = await upstashVectorClient.fetch({
          ids: [result.id],
          includeMetadata: true,
          includeVectors: false,
        });

        if (document && document.length > 0 && document[0].metadata?.chunk) {
          console.log(
            `  Content: ${document[0].metadata.chunk.substring(0, 200)}...`,
          );
        } else {
          console.log('  Content: [No metadata available]');
        }
        console.log('--------------------------------------------');
      } catch (error) {
        console.error(`Error fetching result ${i}:`, error);
      }
    }

    // Show detailed analysis of threshold filtering
    console.log('\nThreshold Analysis:');
    [0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9].forEach((threshold) => {
      const filtered = transformedResults.filter(
        (r) => r.relevance >= threshold,
      );
      console.log(
        `  Threshold ${(threshold * 100).toFixed(0)}%: ${filtered.length} results would pass`,
      );
    });
  } catch (error) {
    console.error('RAG TEST Error:', error);
  }
}

/**
 * Fetch a document by ID to check if it's properly stored with metadata
 */
async function fetchDocumentById(id: string): Promise<void> {
  try {
    console.log(`RAG TEST: Fetching document with ID: ${id}`);

    // Fetch document by ID (using ids array)
    const document = await upstashVectorClient.fetch({
      ids: [`${id}-0`], // Assuming the first chunk uses -0 suffix
      includeMetadata: true,
      includeVector: false,
    });

    console.log('Document fetch result:');
    console.log(JSON.stringify(document, null, 2));

    if (document && document.length > 0) {
      console.log('\nDocument data:');
      console.log('ID:', document[0].id);
      console.log('Metadata:', document[0].metadata);
    } else {
      console.log('No document found with that ID');
    }
  } catch (error) {
    console.error('Error fetching document:', error);
  }
}

// Main execution
async function main() {
  // Get command from arguments
  const command = process.argv[2] || 'search';

  if (command === 'search') {
    const query = process.argv[3] || 'how do integrators execute a vision';
    await testRagSearch(query);
  } else if (command === 'fetch') {
    const id = process.argv[3];
    if (!id) {
      console.error('Please provide a document ID to fetch');
      process.exit(1);
    }
    await fetchDocumentById(id);
  } else {
    console.error('Unknown command. Use "search" or "fetch"');
  }
}

// Run the script
main()
  .then(() => console.log('RAG TEST completed.'))
  .catch(console.error);
