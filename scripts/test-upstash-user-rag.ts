#!/usr/bin/env tsx

import { config } from 'dotenv';
import path from 'node:path';
import { Index } from '@upstash/vector';

// Load environment variables
config({ path: path.resolve(process.cwd(), '.env.local') });

async function testUpstashUserRAG() {
  console.log('🔍 Testing Upstash User RAG connection...');

  // Check environment variables
  const userRagUrl = process.env.UPSTASH_USER_RAG_REST_URL;
  const userRagToken = process.env.UPSTASH_USER_RAG_REST_TOKEN;

  console.log(`URL: ${userRagUrl ? 'Set' : 'Missing'}`);
  console.log(`Token: ${userRagToken ? 'Set' : 'Missing'}`);

  if (!userRagUrl || !userRagToken) {
    console.error('❌ Missing environment variables');
    return;
  }

  try {
    // Create client
    const client = new Index({
      url: userRagUrl,
      token: userRagToken,
    });

    console.log('✅ Client created successfully');

    // Test basic info
    try {
      const info = await client.info();
      console.log('📊 Database info:', info);
    } catch (infoError) {
      console.log('ℹ️ Info not available:', infoError);
    }

    // Test storing a simple vector
    const testUserId = 'test-user-123';
    const testVector = {
      id: 'test-vector-1',
      vector: new Array(1536).fill(0.1), // Simple test vector
      metadata: {
        userId: testUserId,
        test: true,
        content: 'This is a test document',
      },
    };

    console.log('📤 Storing test vector...');
    await client.upsert([testVector], { namespace: testUserId });
    console.log('✅ Test vector stored successfully');

    // Test querying the vector
    console.log('🔍 Querying test vector...');
    const queryResults = await client.query({
      vector: new Array(1536).fill(0.1),
      topK: 5,
      includeMetadata: true,
      namespace: testUserId,
    });

    console.log(`📊 Query results: ${queryResults.length} vectors found`);
    queryResults.forEach((result, index) => {
      console.log(
        `  ${index + 1}. ID: ${result.id}, Score: ${result.score}, Metadata:`,
        result.metadata,
      );
    });

    // Test querying without namespace
    console.log('🔍 Querying without namespace...');
    const noNamespaceResults = await client.query({
      vector: new Array(1536).fill(0.1),
      topK: 5,
      includeMetadata: true,
    });

    console.log(
      `📊 No namespace query results: ${noNamespaceResults.length} vectors found`,
    );

    // Clean up test vector
    console.log('🧹 Cleaning up test vector...');
    await client.delete(['test-vector-1'], { namespace: testUserId });
    console.log('✅ Test vector deleted');
  } catch (error) {
    console.error('❌ Error testing Upstash User RAG:', error);
  }
}

testUpstashUserRAG().catch(console.error);
