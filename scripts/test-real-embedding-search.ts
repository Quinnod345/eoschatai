#!/usr/bin/env tsx

import { config } from 'dotenv';
import { openai } from '@ai-sdk/openai';
import { embed } from 'ai';
import { Index } from '@upstash/vector';

// Load environment variables
config({ path: '.env.local' });

const embeddingModel = openai.embedding('text-embedding-ada-002');

async function testRealEmbeddingSearch() {
  console.log('=== Testing Real Embedding Search ===');
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

    console.log('1. Database info:');
    const info = await client.info();
    console.log(`Total vectors: ${info.vectorCount}`);
    console.log('Namespaces:', info.namespaces);
    console.log('');

    // Test with various real embeddings
    const testQueries = [
      'financial planning',
      'scorecard metrics',
      'business process',
      'quarterly review',
      'performance indicators',
      'document',
      'text',
      'content',
    ];

    for (const query of testQueries) {
      console.log(`Testing query: "${query}"`);

      // Generate real embedding
      const { embedding } = await embed({
        model: embeddingModel,
        value: query,
      });

      // Search without namespace
      const results = await client.query({
        vector: embedding,
        topK: 20,
        includeMetadata: true,
        includeVectors: false,
        // NO namespace
      });

      console.log(`  Total results: ${results?.length || 0}`);

      if (results && results.length > 0) {
        console.log('  All results:');
        results.forEach((result: any, i: number) => {
          console.log(
            `    ${i + 1}. Score: ${result.score?.toFixed(4) || 'N/A'}`,
          );
          console.log(`       User: ${result.metadata?.userId || 'Unknown'}`);
          console.log(`       File: ${result.metadata?.fileName || 'Unknown'}`);
          console.log(
            `       Content: ${result.metadata?.chunk?.substring(0, 50) || 'No content'}...`,
          );
        });

        // Filter for our user
        const userId = '4963f143-cfdd-4f4b-aaf4-b50a735eca54';
        const userResults = results.filter(
          (r: any) => r.metadata?.userId === userId,
        );
        console.log(`  Results for user ${userId}: ${userResults.length}`);

        if (userResults.length > 0) {
          console.log('  User-specific results:');
          userResults.forEach((result: any, i: number) => {
            console.log(
              `    ${i + 1}. Score: ${result.score?.toFixed(4) || 'N/A'}`,
            );
            console.log(
              `       File: ${result.metadata?.fileName || 'Unknown'}`,
            );
            console.log(
              `       Content: ${result.metadata?.chunk?.substring(0, 100) || 'No content'}...`,
            );
          });
        }
      }
      console.log('');
    }
  } catch (error) {
    console.error('Error during real embedding search test:', error);
  }
}

// Run the test
testRealEmbeddingSearch().catch(console.error);
