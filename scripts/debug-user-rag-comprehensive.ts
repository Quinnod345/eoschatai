#!/usr/bin/env tsx

import { config } from 'dotenv';
import { Index } from '@upstash/vector';

// Load environment variables
config({ path: '.env.local' });

async function comprehensiveDebug() {
  const userId = '4963f143-cfdd-4f4b-aaf4-b50a735eca54';

  console.log('=== Comprehensive User RAG Debug ===');
  console.log(`User ID: ${userId}`);
  console.log('');

  // Check environment variables
  console.log('1. Environment Variables:');
  console.log(
    `UPSTASH_USER_RAG_REST_URL: ${process.env.UPSTASH_USER_RAG_REST_URL ? 'SET' : 'NOT SET'}`,
  );
  console.log(
    `UPSTASH_USER_RAG_REST_TOKEN: ${process.env.UPSTASH_USER_RAG_REST_TOKEN ? 'SET' : 'NOT SET'}`,
  );
  console.log('');

  if (
    !process.env.UPSTASH_USER_RAG_REST_URL ||
    !process.env.UPSTASH_USER_RAG_REST_TOKEN
  ) {
    console.log('❌ User RAG environment variables are not set!');
    return;
  }

  try {
    // Create client directly
    const client = new Index({
      url: process.env.UPSTASH_USER_RAG_REST_URL,
      token: process.env.UPSTASH_USER_RAG_REST_TOKEN,
    });

    console.log('2. Database Info:');
    try {
      const info = await client.info();
      console.log(`Database info:`, info);
    } catch (error) {
      console.log(`Error getting database info:`, error);
    }
    console.log('');

    console.log('3. Checking user namespace with different approaches:');

    // Approach 1: Query with dummy vector and namespace
    console.log('Approach 1: Query with namespace parameter');
    try {
      const results1 = await client.query({
        vector: new Array(1536).fill(0),
        topK: 10,
        includeMetadata: true,
        includeVectors: false,
        namespace: userId,
      });
      console.log(`Results with namespace: ${results1?.length || 0}`);
      if (results1 && results1.length > 0) {
        console.log('Sample result:', results1[0]);
      }
    } catch (error) {
      console.log('Error with namespace query:', error);
    }

    // Approach 2: Query without namespace (get all)
    console.log('\nApproach 2: Query without namespace (all vectors)');
    try {
      const results2 = await client.query({
        vector: new Array(1536).fill(0),
        topK: 50,
        includeMetadata: true,
        includeVectors: false,
      });
      console.log(`Total results without namespace: ${results2?.length || 0}`);

      if (results2 && results2.length > 0) {
        console.log('All vectors found:');
        results2.forEach((v: any, i: number) => {
          console.log(`  ${i + 1}. ID: ${v.id}`);
          console.log(`     User ID: ${v.metadata?.userId || 'No userId'}`);
          console.log(`     File: ${v.metadata?.fileName || 'No fileName'}`);
          console.log(
            `     Category: ${v.metadata?.category || 'No category'}`,
          );
          console.log('');
        });

        // Filter for our user
        const userVectors = results2.filter(
          (v: any) => v.metadata?.userId === userId,
        );
        console.log(`Vectors for user ${userId}: ${userVectors.length}`);
      }
    } catch (error) {
      console.log('Error with general query:', error);
    }

    // Approach 3: Try to list namespaces if possible
    console.log('\nApproach 3: Checking database stats');
    try {
      const stats = await client.info();
      console.log('Database stats:', stats);
    } catch (error) {
      console.log('Error getting stats:', error);
    }
  } catch (error) {
    console.error('Error during comprehensive debug:', error);
  }
}

// Run the debug function
comprehensiveDebug().catch(console.error);
