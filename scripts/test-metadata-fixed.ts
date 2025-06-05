#!/usr/bin/env tsx

import { config } from 'dotenv';
import path from 'node:path';
import { Index } from '@upstash/vector';

// Load environment variables
config({ path: path.resolve(process.cwd(), '.env.local') });

async function testMetadataFixed() {
  console.log('🔍 Testing metadata with includeMetadata option...');

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

    const testNamespace = 'metadata-test-2';
    const testVector = {
      id: 'metadata-test-2',
      vector: new Array(1536).fill(0.2),
      metadata: {
        userId: 'test-user-2',
        documentId: 'test-doc-2',
        chunk: 'This is another test chunk for metadata testing',
        fileName: 'test-file-2.txt',
        category: 'Test2',
        fileType: 'text',
        createdAt: new Date().toISOString(),
      },
    };

    console.log('📤 Storing vector with metadata...');
    console.log('Metadata to store:', testVector.metadata);

    await client.upsert([testVector], { namespace: testNamespace });
    console.log('✅ Vector stored');

    // Test fetching by ID with includeMetadata
    console.log('\n📋 Fetching by ID with includeMetadata...');
    try {
      const fetchResults = await client.fetch([testVector.id], {
        namespace: testNamespace,
        includeMetadata: true,
      });
      console.log(`Found ${fetchResults.length} vectors`);

      if (fetchResults.length > 0 && fetchResults[0]) {
        console.log('Retrieved vector:');
        console.log('  ID:', fetchResults[0].id);
        console.log('  Metadata:', fetchResults[0].metadata);
      }
    } catch (fetchError) {
      console.log('❌ Fetch with includeMetadata failed:', fetchError);

      // Try without includeMetadata
      console.log('📋 Trying fetch without includeMetadata...');
      const fetchResults = await client.fetch([testVector.id], {
        namespace: testNamespace,
      });
      console.log(`Found ${fetchResults.length} vectors`);

      if (fetchResults.length > 0 && fetchResults[0]) {
        console.log('Retrieved vector:');
        console.log('  ID:', fetchResults[0].id);
        console.log('  Metadata:', fetchResults[0].metadata);
      }
    }

    // Test querying with different approaches
    console.log('\n🔍 Testing query with exact vector match...');
    const queryResults = await client.query({
      vector: new Array(1536).fill(0.2), // Exact match
      topK: 5,
      includeMetadata: true,
    });

    console.log(`Query found ${queryResults.length} results`);
    queryResults.forEach((result, index) => {
      console.log(`  ${index + 1}. ID: ${result.id}`);
      console.log(`     Score: ${result.score}`);
      console.log(`     Metadata:`, result.metadata);
    });

    // Test with a broader query
    console.log('\n🔍 Testing broader query...');
    const broadQuery = await client.query({
      vector: new Array(1536).fill(0.1), // Different vector
      topK: 10,
      includeMetadata: true,
    });

    console.log(`Broad query found ${broadQuery.length} results`);

    // Clean up
    console.log('\n🧹 Cleaning up...');
    await client.delete([testVector.id], { namespace: testNamespace });
    console.log('✅ Test vector deleted');
  } catch (error) {
    console.error('❌ Error testing metadata:', error);
  }
}

testMetadataFixed().catch(console.error);
