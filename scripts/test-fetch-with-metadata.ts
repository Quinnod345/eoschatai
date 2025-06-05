#!/usr/bin/env tsx

import { config } from 'dotenv';
import { Index } from '@upstash/vector';

// Load environment variables
config({ path: '.env.local' });

async function testFetchWithMetadata() {
  console.log('=== Testing Fetch with Metadata ===');
  console.log('');

  if (
    !process.env.UPSTASH_USER_RAG_REST_URL ||
    !process.env.UPSTASH_USER_RAG_REST_TOKEN
  ) {
    console.log('❌ User RAG environment variables are not set!');
    return;
  }

  try {
    // Create client
    const client = new Index({
      url: process.env.UPSTASH_USER_RAG_REST_URL,
      token: process.env.UPSTASH_USER_RAG_REST_TOKEN,
    });

    const userId = '4963f143-cfdd-4f4b-aaf4-b50a735eca54';
    const vectorIds = [
      'b297cc86-d80b-4189-b639-b6698df4e6f4-0',
      'b297cc86-d80b-4189-b639-b6698df4e6f4-1',
      '61548049-136f-4a75-8acf-2703b038c087-0',
      '61548049-136f-4a75-8acf-2703b038c087-1',
    ];

    console.log('1. Fetching vectors with metadata...');

    for (const vectorId of vectorIds) {
      console.log(`\nFetching: ${vectorId}`);

      try {
        // Fetch with metadata and vectors
        const result = await client.fetch([vectorId], {
          namespace: userId,
          includeMetadata: true,
          includeVectors: true,
        });

        console.log(`Result:`, JSON.stringify(result, null, 2));

        if (result?.[0]) {
          const vector = result[0];
          console.log(`ID: ${vector.id}`);
          console.log(`Has vector: ${vector.vector ? 'Yes' : 'No'}`);
          console.log(`Vector length: ${vector.vector?.length || 'N/A'}`);
          console.log(`Metadata:`, vector.metadata);

          if (vector.metadata) {
            console.log(`  - userId: ${vector.metadata.userId}`);
            console.log(`  - fileName: ${vector.metadata.fileName}`);
            console.log(`  - category: ${vector.metadata.category}`);
            console.log(
              `  - chunk preview: ${vector.metadata.chunk?.substring(0, 100) || 'No chunk'}...`,
            );
          }
        }
      } catch (error) {
        console.log(`Error fetching ${vectorId}:`, error);
      }
    }

    console.log('\n2. Testing query with one of the actual vectors...');

    // Get a vector and use it for similarity search
    try {
      const sampleVector = await client.fetch(
        ['b297cc86-d80b-4189-b639-b6698df4e6f4-0'],
        {
          namespace: userId,
          includeVectors: true,
        },
      );

      if (sampleVector?.[0]?.vector) {
        console.log('Using actual vector for similarity search...');

        const queryResult = await client.query({
          vector: sampleVector[0].vector,
          topK: 5,
          includeMetadata: true,
          includeVectors: false,
          namespace: userId,
        });

        console.log(
          `Query with actual vector found: ${queryResult?.length || 0} results`,
        );

        if (queryResult && queryResult.length > 0) {
          queryResult.forEach((result: any, i: number) => {
            console.log(
              `${i + 1}. Score: ${result.score?.toFixed(4) || 'N/A'}`,
            );
            console.log(`   ID: ${result.id}`);
            console.log(`   File: ${result.metadata?.fileName || 'Unknown'}`);
            console.log('');
          });
        }
      }
    } catch (error) {
      console.log('Error with vector similarity search:', error);
    }
  } catch (error) {
    console.error('Error during metadata test:', error);
  }
}

// Run the test
testFetchWithMetadata().catch(console.error);
