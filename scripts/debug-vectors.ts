#!/usr/bin/env tsx

import { config } from 'dotenv';
import path from 'node:path';
import { Index } from '@upstash/vector';

// Load environment variables
config({ path: path.resolve(process.cwd(), '.env.local') });

async function debugVectors() {
  console.log('🔍 Debugging vector storage...');

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

    // Get database info
    const info = await client.info();
    console.log('📊 Database info:', JSON.stringify(info, null, 2));

    // Try to fetch specific vectors by ID
    const testIds = [
      'b297cc86-d80b-4189-b639-b6698df4e6f4-0',
      '61548049-136f-4a75-8acf-2703b038c087-0',
      '603b37b2-b955-4fe0-ac19-9bfd6ecc72cc-0',
      'aecbac23-ff24-4d0f-9b59-c1c965cbd8d6-0',
    ];

    console.log('\n🔍 Trying to fetch vectors by ID...');

    // Test fetching from default namespace
    try {
      console.log('📋 Fetching from default namespace...');
      const defaultResults = await client.fetch(testIds);
      console.log(
        `Found ${defaultResults.length} vectors in default namespace`,
      );
      defaultResults.forEach((result, index) => {
        if (result) {
          console.log(`  ${index + 1}. ID: ${result.id}`);
          console.log(`     Metadata:`, result.metadata);
        }
      });
    } catch (fetchError) {
      console.log('❌ Error fetching from default namespace:', fetchError);
    }

    // Test fetching from user namespaces
    const userIds = [
      '4963f143-cfdd-4f4b-aaf4-b50a735eca54',
      '72091c65-d97f-43a7-84e8-137d83a9e22e',
    ];

    for (const userId of userIds) {
      try {
        console.log(`\n📋 Fetching from namespace: ${userId}`);
        const namespaceResults = await client.fetch(testIds, {
          namespace: userId,
        });
        console.log(
          `Found ${namespaceResults.length} vectors in namespace ${userId}`,
        );
        namespaceResults.forEach((result, index) => {
          if (result) {
            console.log(`  ${index + 1}. ID: ${result.id}`);
            console.log(`     Metadata:`, result.metadata);
          }
        });
      } catch (fetchError) {
        console.log(`❌ Error fetching from namespace ${userId}:`, fetchError);
      }
    }

    // Try a simple query with very low threshold
    console.log('\n🔍 Testing simple query...');
    try {
      const simpleQuery = await client.query({
        vector: new Array(1536).fill(0),
        topK: 10,
        includeMetadata: true,
      });
      console.log(`Simple query (no namespace): ${simpleQuery.length} results`);
    } catch (queryError) {
      console.log('❌ Simple query error:', queryError);
    }
  } catch (error) {
    console.error('❌ Error debugging vectors:', error);
  }
}

debugVectors().catch(console.error);
