#!/usr/bin/env tsx

import { config } from 'dotenv';
import { Index } from '@upstash/vector';

// Load environment variables
config({ path: '.env.local' });

async function testRangeOperation() {
  console.log('=== Testing Range Operation ===');
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

    // Try range operation without namespace
    console.log('2. Range operation without namespace:');
    try {
      const rangeResult = await client.range({
        cursor: '',
        limit: 20,
        includeMetadata: true,
        includeVectors: false,
      });

      console.log(`Range result: ${rangeResult.vectors?.length || 0} vectors`);
      console.log(`Next cursor: ${rangeResult.nextCursor || 'none'}`);

      if (rangeResult.vectors && rangeResult.vectors.length > 0) {
        console.log('Vectors found:');
        rangeResult.vectors.forEach((v: any, i: number) => {
          console.log(`  ${i + 1}. ID: ${v.id}`);
          console.log(`     User: ${v.metadata?.userId || 'Unknown'}`);
          console.log(`     File: ${v.metadata?.fileName || 'Unknown'}`);
          console.log(
            `     Content: ${v.metadata?.chunk?.substring(0, 50) || 'No content'}...`,
          );
          console.log('');
        });
      }
    } catch (error) {
      console.log('Range operation error:', error);
    }

    // Try range operation with specific namespace
    const userId = '4963f143-cfdd-4f4b-aaf4-b50a735eca54';
    console.log(`3. Range operation with namespace ${userId}:`);
    try {
      const rangeResult = await client.range({
        cursor: '',
        limit: 20,
        includeMetadata: true,
        includeVectors: false,
        namespace: userId,
      });

      console.log(`Range result: ${rangeResult.vectors?.length || 0} vectors`);

      if (rangeResult.vectors && rangeResult.vectors.length > 0) {
        console.log('User vectors found:');
        rangeResult.vectors.forEach((v: any, i: number) => {
          console.log(`  ${i + 1}. ID: ${v.id}`);
          console.log(`     File: ${v.metadata?.fileName || 'Unknown'}`);
          console.log(
            `     Content: ${v.metadata?.chunk?.substring(0, 100) || 'No content'}...`,
          );
          console.log('');
        });
      }
    } catch (error) {
      console.log('Range operation with namespace error:', error);
    }

    // Try to reset/flush the database
    console.log('4. Testing database reset/flush:');
    try {
      const resetResult = await client.reset();
      console.log('Reset result:', resetResult);
    } catch (error) {
      console.log('Reset not supported or error:', error);
    }
  } catch (error) {
    console.error('Error during range operation test:', error);
  }
}

// Run the test
testRangeOperation().catch(console.error);
