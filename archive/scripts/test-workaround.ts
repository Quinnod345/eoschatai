#!/usr/bin/env tsx

import { config } from 'dotenv';
import { findRelevantUserContentWorkaround } from '../lib/ai/user-rag-workaround';

// Load environment variables
config({ path: '.env.local' });

async function testWorkaround() {
  const userId = '4963f143-cfdd-4f4b-aaf4-b50a735eca54';
  const testQueries = [
    'cyberquest',
    'financial planning',
    'scorecard',
    'cover letter',
    'quarterly review',
    'business process',
  ];

  console.log('=== Testing User RAG Workaround ===');
  console.log(`User ID: ${userId}`);
  console.log('');

  for (const query of testQueries) {
    console.log(`\n🔍 Testing query: "${query}"`);
    console.log('='.repeat(50));

    try {
      const results = await findRelevantUserContentWorkaround(
        userId,
        query,
        5,
        0.3,
      );

      console.log(`\n📊 Results: ${results.length}`);

      if (results.length > 0) {
        console.log('\n📄 Top Results:');
        results.forEach((result, i) => {
          console.log(
            `\n${i + 1}. Relevance: ${(result.relevance * 100).toFixed(1)}%`,
          );
          console.log(`   File: ${result.metadata?.fileName || 'Unknown'}`);
          console.log(`   Category: ${result.metadata?.category || 'Unknown'}`);
          console.log(
            `   Content: ${result.content?.substring(0, 150) || 'No content'}...`,
          );
        });
      } else {
        console.log('   No results found');
      }
    } catch (error) {
      console.error(`Error testing query "${query}":`, error);
    }
  }
}

// Run the test
testWorkaround().catch(console.error);
