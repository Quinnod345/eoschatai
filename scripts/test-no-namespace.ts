#!/usr/bin/env tsx

import { config } from 'dotenv';
import { openai } from '@ai-sdk/openai';
import { embed } from 'ai';
import { Index } from '@upstash/vector';

// Load environment variables
config({ path: '.env.local' });

const embeddingModel = openai.embedding('text-embedding-3-small');

async function testNoNamespace() {
  const userId = '4963f143-cfdd-4f4b-aaf4-b50a735eca54';
  const query = 'financial';

  console.log('=== Testing Search WITHOUT Namespace ===');
  console.log(`Query: ${query}`);
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

    console.log('1. Generating embedding for query...');
    const { embedding } = await embed({
      model: embeddingModel,
      value: query,
    });
    console.log(`Generated ${embedding.length}-dimensional embedding`);
    console.log('');

    console.log('2. Searching WITHOUT namespace parameter...');
    const results = await client.query({
      vector: embedding,
      topK: 20,
      includeMetadata: true,
      includeVectors: false,
      // NO namespace parameter - search all
    });

    console.log(`Found ${results?.length || 0} results across all namespaces`);

    if (results && results.length > 0) {
      console.log('\nAll Results:');
      results.forEach((result: any, i: number) => {
        console.log(`${i + 1}. Score: ${result.score?.toFixed(4) || 'N/A'}`);
        console.log(`   User ID: ${result.metadata?.userId || 'Unknown'}`);
        console.log(`   File: ${result.metadata?.fileName || 'Unknown'}`);
        console.log(`   Category: ${result.metadata?.category || 'Unknown'}`);
        console.log(
          `   Content: ${result.metadata?.chunk?.substring(0, 100) || 'No content'}...`,
        );
        console.log('');
      });

      // Filter for our specific user
      const userResults = results.filter(
        (r: any) => r.metadata?.userId === userId,
      );
      console.log(`\nResults for user ${userId}: ${userResults.length}`);

      if (userResults.length > 0) {
        console.log('User-specific results:');
        userResults.forEach((result: any, i: number) => {
          console.log(`${i + 1}. Score: ${result.score?.toFixed(4) || 'N/A'}`);
          console.log(`   File: ${result.metadata?.fileName || 'Unknown'}`);
          console.log(
            `   Content: ${result.metadata?.chunk?.substring(0, 100) || 'No content'}...`,
          );
          console.log('');
        });
      }
    } else {
      console.log('No results found even without namespace filter');
    }
  } catch (error) {
    console.error('Error during search test:', error);
  }
}

// Run the test
testNoNamespace().catch(console.error);
