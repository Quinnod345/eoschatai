#!/usr/bin/env tsx

import { config } from 'dotenv';
import { openai } from '@ai-sdk/openai';
import { embed } from 'ai';
import { Index } from '@upstash/vector';

// Load environment variables
config({ path: '.env.local' });

const embeddingModel = openai.embedding('text-embedding-ada-002');

async function testUserRagSearch() {
  const userId = '4963f143-cfdd-4f4b-aaf4-b50a735eca54';
  const query = 'cyberquest';

  console.log('=== Testing User RAG Search with Real Embedding ===');
  console.log(`User ID: ${userId}`);
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

    console.log('2. Searching with updated User RAG function...');
    const { findRelevantUserContent } = await import('../lib/ai/user-rag');
    const results = await findRelevantUserContent(userId, query, 10, 0.3);

    console.log(`Found ${results?.length || 0} results`);

    if (results && results.length > 0) {
      console.log('\nResults:');
      results.forEach((result: any, i: number) => {
        console.log(
          `${i + 1}. Relevance: ${(result.relevance * 100).toFixed(1)}%`,
        );
        console.log(`   File: ${result.metadata?.fileName || 'Unknown'}`);
        console.log(`   Category: ${result.metadata?.category || 'Unknown'}`);
        console.log(
          `   Content: ${result.content?.substring(0, 100) || 'No content'}...`,
        );
        console.log('');
      });
    } else {
      console.log('No results found');
    }

    console.log('3. Testing with different queries...');
    const testQueries = [
      'financial',
      'scorecard',
      'planning',
      'cover letter',
      'process',
    ];

    for (const testQuery of testQueries) {
      console.log(`\nTesting query: "${testQuery}"`);
      const testResults = await findRelevantUserContent(
        userId,
        testQuery,
        3,
        0.3,
      );

      console.log(`  Results: ${testResults?.length || 0}`);
      if (testResults && testResults.length > 0) {
        const topResult = testResults[0];
        console.log(
          `  Top result: ${(topResult.relevance * 100).toFixed(1)}% - ${topResult.metadata?.fileName}`,
        );
      }
    }
  } catch (error) {
    console.error('Error during search test:', error);
  }
}

// Run the test
testUserRagSearch().catch(console.error);
