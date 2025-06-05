#!/usr/bin/env tsx

import { config } from 'dotenv';
import {
  debugUserNamespace,
  findRelevantUserContentDebug,
} from '../lib/ai/user-rag';

// Load environment variables
config({ path: '.env.local' });

async function debugUserRag() {
  const userId = '4963f143-cfdd-4f4b-aaf4-b50a735eca54'; // Your user ID from the logs
  const query = 'cyberquest';

  console.log('=== User RAG Debug Script ===');
  console.log(`User ID: ${userId}`);
  console.log(`Query: ${query}`);
  console.log('');

  try {
    // Check what's in the user's namespace
    console.log('1. Checking user namespace...');
    const debugInfo = await debugUserNamespace(userId);

    console.log(`Total vectors in namespace: ${debugInfo.totalVectors}`);
    console.log(`Has vectors: ${debugInfo.namespaceInfo.hasVectors}`);

    if (debugInfo.sampleVectors.length > 0) {
      console.log('\nSample vectors:');
      debugInfo.sampleVectors.forEach((v, i) => {
        console.log(`  ${i + 1}. ID: ${v.id}`);
        console.log(`     File: ${v.metadata?.fileName || 'Unknown'}`);
        console.log(`     Category: ${v.metadata?.category || 'Unknown'}`);
        console.log(`     Content: ${v.contentPreview}`);
        console.log('');
      });
    } else {
      console.log('No vectors found in namespace');
    }

    // Try searching with debug function
    console.log('2. Testing search with debug function...');
    const results = await findRelevantUserContentDebug(userId, query, 10, 0.1); // Very low threshold

    console.log(`Search results: ${results.length}`);
    results.forEach((result, i) => {
      console.log(
        `  ${i + 1}. Relevance: ${(result.relevance * 100).toFixed(1)}%`,
      );
      console.log(`     File: ${result.metadata?.fileName || 'Unknown'}`);
      console.log(`     Content: ${result.content.substring(0, 100)}...`);
      console.log('');
    });
  } catch (error) {
    console.error('Error during debug:', error);
  }
}

// Run the debug function
debugUserRag().catch(console.error);
