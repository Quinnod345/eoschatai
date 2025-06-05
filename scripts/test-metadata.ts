#!/usr/bin/env tsx

import { config } from 'dotenv';
import path from 'node:path';
import { Index } from '@upstash/vector';

// Load environment variables
config({ path: path.resolve(process.cwd(), '.env.local') });

async function testMetadata() {
  console.log('🔍 Testing metadata storage and retrieval...');

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

    const testNamespace = 'metadata-test';
    const testVector = {
      id: 'metadata-test-1',
      vector: new Array(1536).fill(0.1),
      metadata: {
        userId: 'test-user',
        documentId: 'test-doc',
        chunk: 'This is a test chunk of content for testing metadata storage',
        fileName: 'test-file.txt',
        category: 'Test',
        fileType: 'text',
        createdAt: new Date().toISOString(),
      },
    };

    console.log('📤 Storing vector with metadata...');
    console.log('Metadata to store:', testVector.metadata);

    await client.upsert([testVector], { namespace: testNamespace });
    console.log('✅ Vector stored');

    // Test fetching by ID
    console.log('\n📋 Fetching by ID...');
    const fetchResults = await client.fetch([testVector.id], {
      namespace: testNamespace,
    });
    console.log(`Found ${fetchResults.length} vectors`);

    if (fetchResults.length > 0 && fetchResults[0]) {
      console.log('Retrieved vector:');
      console.log('  ID:', fetchResults[0].id);
      console.log('  Metadata:', fetchResults[0].metadata);
    }

    // Test querying
    console.log('\n🔍 Testing query...');
    const queryResults = await client.query({
      vector: new Array(1536).fill(0.1),
      topK: 5,
      includeMetadata: true,
    });

    console.log(`Query found ${queryResults.length} results`);
    queryResults.forEach((result, index) => {
      console.log(`  ${index + 1}. ID: ${result.id}`);
      console.log(`     Score: ${result.score}`);
      console.log(`     Metadata:`, result.metadata);
    });

    // Clean up
    console.log('\n🧹 Cleaning up...');
    await client.delete([testVector.id], { namespace: testNamespace });
    console.log('✅ Test vector deleted');
  } catch (error) {
    console.error('❌ Error testing metadata:', error);
  }
}

testMetadata().catch(console.error);
