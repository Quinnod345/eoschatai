#!/usr/bin/env tsx

import { config } from 'dotenv';
import { Index } from '@upstash/vector';

// Load environment variables
config({ path: '.env.local' });

async function testFetchById() {
  console.log('=== Testing Fetch by ID ===');
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

    console.log('1. Getting database info...');
    const info = await client.info();
    console.log(`Total vectors: ${info.vectorCount}`);
    console.log('Namespaces:', info.namespaces);
    console.log('');

    // Try to fetch vectors by constructing likely IDs
    const userId = '4963f143-cfdd-4f4b-aaf4-b50a735eca54';
    const documentIds = [
      'b297cc86-d80b-4189-b639-b6698df4e6f4', // Cover Letter
      '61548049-136f-4a75-8acf-2703b038c087', // Scorecard
    ];

    console.log('2. Trying to fetch vectors by ID...');

    for (const docId of documentIds) {
      for (let i = 0; i < 5; i++) {
        const vectorId = `${docId}-${i}`;
        console.log(`Trying to fetch: ${vectorId}`);

        try {
          const result = await client.fetch([vectorId], { namespace: userId });
          console.log(`Result for ${vectorId}:`, result);
        } catch (error) {
          console.log(`Error fetching ${vectorId}:`, error);
        }
      }
    }

    console.log('');
    console.log('3. Trying range query...');
    try {
      const rangeResult = await client.range({
        cursor: '',
        limit: 10,
        includeMetadata: true,
        includeVectors: false,
      });
      console.log('Range result:', rangeResult);
    } catch (error) {
      console.log('Range query error:', error);
    }

    console.log('');
    console.log('4. Trying list operation...');
    try {
      // Some vector databases support list operations
      const listResult = await (client as any).list?.({ namespace: userId });
      console.log('List result:', listResult);
    } catch (error) {
      console.log('List operation not supported or error:', error);
    }
  } catch (error) {
    console.error('Error during fetch test:', error);
  }
}

// Run the test
testFetchById().catch(console.error);
