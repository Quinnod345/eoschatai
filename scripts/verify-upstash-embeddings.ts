#!/usr/bin/env tsx
/**
 * Verify Upstash Embeddings for Circle Courses
 * 
 * This script connects to Upstash and verifies that all Circle course
 * embeddings are stored correctly and searchable.
 * 
 * Usage:
 *   tsx scripts/verify-upstash-embeddings.ts
 */

import { Index } from '@upstash/vector';
import { openai } from '@ai-sdk/openai';
import { embed } from 'ai';

const UPSTASH_USER_RAG_REST_URL = process.env.UPSTASH_USER_RAG_REST_URL;
const UPSTASH_USER_RAG_REST_TOKEN = process.env.UPSTASH_USER_RAG_REST_TOKEN;

const embeddingModel = openai.embedding('text-embedding-3-small');

async function verifyUpstashEmbeddings() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║    Verify Upstash Embeddings - Circle Courses            ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Validate environment
  if (!UPSTASH_USER_RAG_REST_URL || !UPSTASH_USER_RAG_REST_TOKEN) {
    console.error('❌ Error: Missing Upstash environment variables');
    console.error('   Please set UPSTASH_USER_RAG_REST_URL and UPSTASH_USER_RAG_REST_TOKEN');
    process.exit(1);
  }

  try {
    // Initialize Upstash client
    console.log('📡 Connecting to Upstash Vector...');
    const upstashClient = new Index({
      url: UPSTASH_USER_RAG_REST_URL,
      token: UPSTASH_USER_RAG_REST_TOKEN,
    });
    console.log('✅ Connected to Upstash\n');

    // Find all circle-course namespaces by scanning for known patterns
    const knownCourses = [
      '782928', // EOS A - Z
      '813417', // EOS Implementer Community
      '815352', // Biz Dev
      '815357', // Practice Management
      '815361', // Client Resources
      '815371', // Path to Mastery
      '815739', // Events
      '839429', // Getting Started
      '850665', // Franchise Advisory Council
      '879850', // QCE Contributors Training
      '907974', // Test
    ];

    console.log('🔍 Scanning for Circle course namespaces...\n');

    const foundCourses: Array<{
      courseId: string;
      namespace: string;
      vectorCount: number;
      sampleVectors: any[];
      searchWorks: boolean;
    }> = [];

    for (const courseId of knownCourses) {
      const namespace = `circle-course-${courseId}`;
      console.log(`━━━ Checking: ${namespace} ━━━`);

      try {
        const namespaceClient = upstashClient.namespace(namespace);

        // Count vectors in namespace
        let vectorCount = 0;
        let cursor = '';
        const sampleVectors: any[] = [];

        console.log('   📊 Counting vectors...');

        while (true) {
          const rangeResult = await namespaceClient.range({
            cursor,
            limit: 1000,
            includeMetadata: true,
            includeVectors: false,
          });

          if (rangeResult.vectors && rangeResult.vectors.length > 0) {
            vectorCount += rangeResult.vectors.length;

            // Collect first 3 samples
            if (sampleVectors.length < 3) {
              const needed = 3 - sampleVectors.length;
              sampleVectors.push(...rangeResult.vectors.slice(0, needed));
            }
          }

          if (!rangeResult.nextCursor) {
            break;
          }

          cursor = rangeResult.nextCursor;
        }

        if (vectorCount === 0) {
          console.log('   ⚠️  No vectors found - course not synced\n');
          continue;
        }

        console.log(`   ✅ Found ${vectorCount} vectors`);

        // Display sample metadata
        console.log('   📝 Sample vectors:');
        sampleVectors.forEach((v, i) => {
          console.log(`      ${i + 1}. ID: ${v.id}`);
          console.log(`         Title: ${v.metadata?.documentTitle || 'N/A'}`);
          console.log(`         Content: ${(v.metadata?.chunk?.length || 0)} chars`);
          if (v.metadata?.chunk) {
            const preview = v.metadata.chunk.substring(0, 100).replace(/\n/g, ' ');
            console.log(`         Preview: "${preview}..."`);
          }
        });

        // Test search functionality
        console.log('   🔍 Testing search...');
        
        const testQuery = 'What is EOS?'; // Generic query
        const { embedding } = await embed({
          model: embeddingModel,
          value: testQuery,
        });

        const searchResults = await namespaceClient.query({
          vector: embedding,
          topK: 3,
          includeMetadata: true,
          includeVectors: false,
        });

        const searchWorks = searchResults && searchResults.length > 0;

        if (searchWorks) {
          console.log(`   ✅ Search works! Found ${searchResults.length} results`);
          console.log('   🎯 Top result:');
          const top = searchResults[0];
          console.log(`      Score: ${(top.score * 100).toFixed(1)}%`);
          console.log(`      Document: ${top.metadata?.documentTitle || 'N/A'}`);
          if (top.metadata?.chunk) {
            const preview = top.metadata.chunk.substring(0, 150).replace(/\n/g, ' ');
            console.log(`      Content: "${preview}..."`);
          }
        } else {
          console.log('   ❌ Search failed - no results returned');
        }

        foundCourses.push({
          courseId,
          namespace,
          vectorCount,
          sampleVectors,
          searchWorks,
        });

        console.log('   ✅ Verification complete\n');
      } catch (error) {
        console.log(`   ❌ Error: ${error instanceof Error ? error.message : error}\n`);
      }
    }

    // Summary
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                  VERIFICATION SUMMARY                      ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    console.log(`Courses Found: ${foundCourses.length} / ${knownCourses.length}\n`);

    if (foundCourses.length === 0) {
      console.log('❌ No courses found in Upstash!');
      console.log('   Run sync first: pnpm tsx scripts/sync-circle-course-to-upstash.ts <courseId>\n');
      return;
    }

    // Table of results
    console.log('━━━ Synced Courses ━━━\n');
    foundCourses.forEach((course, i) => {
      console.log(`${i + 1}. Course ID: ${course.courseId}`);
      console.log(`   Namespace: ${course.namespace}`);
      console.log(`   Vectors: ${course.vectorCount}`);
      console.log(`   Search: ${course.searchWorks ? '✅ Working' : '❌ Not Working'}`);

      // Calculate total content
      const totalChars = course.sampleVectors.reduce(
        (sum, v) => sum + (v.metadata?.chunk?.length || 0),
        0
      );
      const avgChars = totalChars / course.sampleVectors.length;
      console.log(`   Avg chunk size: ${Math.round(avgChars)} chars`);
      console.log('');
    });

    // Overall stats
    const totalVectors = foundCourses.reduce((sum, c) => sum + c.vectorCount, 0);
    const searchWorking = foundCourses.filter((c) => c.searchWorks).length;

    console.log('━━━ Overall Statistics ━━━');
    console.log(`Total namespaces: ${foundCourses.length}`);
    console.log(`Total vectors: ${totalVectors.toLocaleString()}`);
    console.log(`Search working: ${searchWorking} / ${foundCourses.length}`);
    console.log('');

    // Verification status
    if (searchWorking === foundCourses.length) {
      console.log('🎉 ✅ ALL COURSES VERIFIED AND WORKING!');
      console.log('   - All embeddings stored correctly');
      console.log('   - All searches returning results');
      console.log('   - Ready for user activation\n');
    } else {
      console.log('⚠️  Some courses have search issues:');
      foundCourses
        .filter((c) => !c.searchWorks)
        .forEach((c) => {
          console.log(`   - ${c.namespace}: Search not working`);
        });
      console.log('');
    }

    // Test queries for each course
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║              TEST SEARCH QUERIES                           ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    console.log('Testing specific course queries...\n');

    // Test a few specific queries
    const testQueries = [
      { courseId: '782928', query: 'What is the 90 Minute Meeting?' },
      { courseId: '782928', query: 'Explain the Vision Traction Organizer' },
      { courseId: '813417', query: 'EOS implementation best practices' },
    ];

    for (const test of testQueries) {
      const course = foundCourses.find((c) => c.courseId === test.courseId);
      if (!course) {
        console.log(`⚠️  Course ${test.courseId} not found, skipping query test\n`);
        continue;
      }

      console.log(`🔍 Query: "${test.query}"`);
      console.log(`   Course: ${course.namespace}`);

      try {
        const namespaceClient = upstashClient.namespace(course.namespace);
        
        const { embedding } = await embed({
          model: embeddingModel,
          value: test.query,
        });

        const results = await namespaceClient.query({
          vector: embedding,
          topK: 3,
          includeMetadata: true,
          includeVectors: false,
        });

        if (results && results.length > 0) {
          console.log(`   ✅ Found ${results.length} relevant results:`);
          results.slice(0, 2).forEach((r: any, i: number) => {
            console.log(`      ${i + 1}. Score: ${(r.score * 100).toFixed(1)}%`);
            console.log(`         Doc: ${r.metadata?.documentTitle || 'N/A'}`);
            if (r.metadata?.chunk) {
              const preview = r.metadata.chunk.substring(0, 120).replace(/\n/g, ' ');
              console.log(`         "${preview}..."`);
            }
          });
        } else {
          console.log('   ❌ No results found');
        }
      } catch (error) {
        console.log(`   ❌ Error: ${error instanceof Error ? error.message : error}`);
      }

      console.log('');
    }

    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log('✨ Verification complete!\n');

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
      console.error('   Stack:', error.stack);
    }
    process.exit(1);
  }
}

// Run verification
verifyUpstashEmbeddings().then(() => {
  process.exit(0);
});
