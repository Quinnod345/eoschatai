#!/usr/bin/env tsx

import { config } from 'dotenv';
import path from 'node:path';
import { Index } from '@upstash/vector';
import { openai } from '@ai-sdk/openai';
import { embed } from 'ai';

// Load environment variables
config({ path: path.resolve(process.cwd(), '.env.local') });

async function testRealQuery() {
  console.log('🔍 Testing User RAG with real embeddings...');

  const userRagUrl = process.env.UPSTASH_USER_RAG_REST_URL;
  const userRagToken = process.env.UPSTASH_USER_RAG_REST_TOKEN;

  if (!userRagUrl || !userRagToken) {
    console.error('❌ Missing environment variables');
    return;
  }

  try {
    const client = new Index({
      url: userRagUrl,
      token: userRagToken,
    });

    const embeddingModel = openai.embedding('text-embedding-ada-002');

    // Test with a real query
    const testQuery = 'financial planning scorecard';
    console.log(`🔍 Testing query: "${testQuery}"`);

    // Generate real embedding
    console.log('🧠 Generating embedding...');
    const { embedding } = await embed({
      model: embeddingModel,
      value: testQuery,
    });

    console.log(`✅ Generated ${embedding.length}-dimensional embedding`);

    // Test both users
    const userIds = [
      '4963f143-cfdd-4f4b-aaf4-b50a735eca54',
      '72091c65-d97f-43a7-84e8-137d83a9e22e',
    ];

    for (const userId of userIds) {
      console.log(`\n👤 Testing user: ${userId}`);

      // Query with real embedding
      const results = await client.query({
        vector: embedding,
        topK: 5,
        includeMetadata: true,
        namespace: userId,
      });

      console.log(`📊 Found ${results.length} results:`);
      results.forEach((result, index) => {
        console.log(`  ${index + 1}. ID: ${result.id}`);
        console.log(`     Score: ${(result.score * 100).toFixed(1)}%`);
        console.log(`     File: ${result.metadata?.fileName || 'Unknown'}`);
        console.log(`     Category: ${result.metadata?.category || 'Unknown'}`);
        if (result.metadata?.chunk) {
          const preview = result.metadata.chunk.substring(0, 100);
          console.log(`     Content: ${preview}...`);
        }
      });
    }
  } catch (error) {
    console.error('❌ Error testing real query:', error);
  }
}

testRealQuery().catch(console.error);
