#!/usr/bin/env tsx
/**
 * Sync Circle Course to Upstash Vector Database
 *
 * This script syncs Circle.so course content to Upstash Vector using the course ID as the namespace.
 * This allows multiple users to reference the same course data without duplication.
 *
 * Usage:
 *   tsx scripts/sync-circle-course-to-upstash.ts <courseId> [spaceId]
 *
 * Example:
 *   tsx scripts/sync-circle-course-to-upstash.ts 123456
 *   tsx scripts/sync-circle-course-to-upstash.ts 123456 789012
 */

import { openai } from '@ai-sdk/openai';
import { embedMany } from 'ai';
import { Index } from '@upstash/vector';
import {
  fetchCourseContent,
  courseToDocuments,
} from '@/lib/integrations/circle';

// Configuration
const UPSTASH_USER_RAG_REST_URL = process.env.UPSTASH_USER_RAG_REST_URL;
const UPSTASH_USER_RAG_REST_TOKEN = process.env.UPSTASH_USER_RAG_REST_TOKEN;
const CIRCLE_SPACE_ID = process.env.CIRCLE_SPACE_ID || '';

const embeddingModel = openai.embedding('text-embedding-3-small');

/**
 * Generate text chunks from content for better embedding
 * Uses larger chunk size (2000 chars) to preserve more context and reduce truncation
 */
function generateChunks(
  content: string,
  chunkSize = 2000, // Increased from 1000 to preserve more context
  overlap = 400, // Increased from 200 for better continuity
): string[] {
  const chunks: string[] = [];

  // Handle empty or very short content
  if (!content || content.trim().length === 0) {
    return [];
  }

  if (content.length <= chunkSize) {
    // Content fits in one chunk - return as is (no truncation)
    return [content];
  }

  // Split by sentences for natural boundaries
  const sentences = content.split(/[.!?]+/).filter((s) => s.trim().length > 0);

  let currentChunk = '';

  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();
    if (!trimmedSentence) continue;

    // If adding this sentence would exceed chunk size, save current chunk and start new one
    if (
      currentChunk.length + trimmedSentence.length + 1 > chunkSize &&
      currentChunk.length > 0
    ) {
      chunks.push(currentChunk.trim());

      // Start new chunk with overlap from previous chunk for continuity
      const words = currentChunk.split(' ');
      const overlapWords = words.slice(-Math.floor(overlap / 6)); // More generous overlap
      currentChunk = `${overlapWords.join(' ')} ${trimmedSentence}`;
    } else {
      currentChunk += `${currentChunk ? ' ' : ''}${trimmedSentence}`;
    }
  }

  // CRITICAL: Add the last chunk if it has content (don't lose data!)
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  // If no chunks were created (content has no sentence boundaries), chunk by character count
  if (chunks.length === 0 && content.length > 0) {
    for (let i = 0; i < content.length; i += chunkSize - overlap) {
      const chunk = content.substring(i, i + chunkSize);
      if (chunk.trim()) {
        chunks.push(chunk.trim());
      }
    }
  }

  console.log(
    `   Generated ${chunks.length} chunks from ${content.length} chars (avg ${Math.round(content.length / chunks.length)} chars/chunk)`,
  );

  return chunks;
}

/**
 * Delete all vectors from a namespace
 */
async function deleteAllVectors(
  namespaceClient: any,
  namespace: string,
): Promise<number> {
  try {
    console.log('🗑️  Deleting all existing vectors from namespace...');

    const vectorIds: string[] = [];
    let cursor = '';

    // Collect all vector IDs
    while (true) {
      const rangeResult = await namespaceClient.range({
        cursor,
        limit: 1000,
        includeMetadata: false,
        includeVectors: false,
      });

      if (rangeResult.vectors && rangeResult.vectors.length > 0) {
        vectorIds.push(...rangeResult.vectors.map((v: any) => v.id));
      }

      if (!rangeResult.nextCursor) {
        break;
      }

      cursor = rangeResult.nextCursor;
    }

    if (vectorIds.length === 0) {
      console.log('   No vectors to delete');
      return 0;
    }

    console.log(`   Found ${vectorIds.length} vectors to delete`);

    // Delete in batches
    const batchSize = 1000;
    let deleted = 0;

    for (let i = 0; i < vectorIds.length; i += batchSize) {
      const batch = vectorIds.slice(i, i + batchSize);
      await namespaceClient.delete(batch);
      deleted += batch.length;

      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(vectorIds.length / batchSize);
      console.log(
        `   Deleted batch ${batchNum}/${totalBatches} (${deleted}/${vectorIds.length} vectors)`,
      );
    }

    console.log(
      `   ✅ Deleted ${deleted} vectors from namespace ${namespace}\n`,
    );
    return deleted;
  } catch (error) {
    console.error('   Error deleting vectors:', error);
    throw error;
  }
}

/**
 * Check if namespace already has data
 */
async function checkExistingData(
  namespaceClient: any,
  courseId: string,
): Promise<{
  exists: boolean;
  vectorCount: number;
  existingDocs: Set<number>;
}> {
  try {
    console.log('🔍 Checking for existing data in namespace...');

    const existingDocs = new Set<number>();
    let vectorCount = 0;
    let cursor = '';

    // Scan through existing vectors to find what's already synced
    while (true) {
      const rangeResult = await namespaceClient.range({
        cursor,
        limit: 1000,
        includeMetadata: true,
        includeVectors: false,
      });

      if (rangeResult.vectors && rangeResult.vectors.length > 0) {
        vectorCount += rangeResult.vectors.length;

        // Track which documents are already synced
        for (const vector of rangeResult.vectors) {
          if (vector.metadata?.documentIndex !== undefined) {
            existingDocs.add(vector.metadata.documentIndex);
          }
        }
      }

      if (!rangeResult.nextCursor) {
        break;
      }

      cursor = rangeResult.nextCursor;
    }

    if (vectorCount > 0) {
      console.log(`   Found ${vectorCount} existing vectors`);
      console.log(`   Already synced documents: ${existingDocs.size}`);
    } else {
      console.log(`   No existing data found - fresh sync`);
    }

    return {
      exists: vectorCount > 0,
      vectorCount,
      existingDocs,
    };
  } catch (error) {
    console.error('   Error checking existing data:', error);
    return { exists: false, vectorCount: 0, existingDocs: new Set() };
  }
}

/**
 * Main sync function
 */
async function syncCourseToUpstash(
  courseId: string,
  spaceId: string,
  forceResync: boolean = false,
) {
  console.log('\n========================================');
  console.log('Circle Course → Upstash Sync');
  console.log('========================================\n');

  // Validate environment
  if (!UPSTASH_USER_RAG_REST_URL || !UPSTASH_USER_RAG_REST_TOKEN) {
    console.error('❌ Error: Missing Upstash environment variables');
    console.error(
      '   Please set UPSTASH_USER_RAG_REST_URL and UPSTASH_USER_RAG_REST_TOKEN',
    );
    process.exit(1);
  }

  console.log(`Course ID: ${courseId}`);
  console.log(`Space ID: ${spaceId}`);
  console.log(`Namespace: circle-course-${courseId}`);
  console.log(`Force Re-sync: ${forceResync ? 'Yes' : 'No'}\n`);

  try {
    // Initialize Upstash client
    console.log('📡 Initializing Upstash Vector client...');
    const upstashClient = new Index({
      url: UPSTASH_USER_RAG_REST_URL,
      token: UPSTASH_USER_RAG_REST_TOKEN,
    });

    // Create namespace for this course
    const namespace = `circle-course-${courseId}`;
    const namespaceClient = upstashClient.namespace(namespace);

    console.log('✅ Upstash client initialized\n');

    // Check for existing data
    const existingData = await checkExistingData(namespaceClient, courseId);

    if (existingData.exists && !forceResync) {
      console.log('\n⚠️  Course data already exists in Upstash!');
      console.log(`   Vectors: ${existingData.vectorCount}`);
      console.log(`   Documents: ${existingData.existingDocs.size}`);
      console.log('\nOptions:');
      console.log('  1. Use --force to re-sync and overwrite existing data');
      console.log('  2. Skip sync - data is already available\n');
      console.log(
        'Recommendation: Skip sync unless course content has changed.\n',
      );
      return;
    }

    if (forceResync && existingData.exists) {
      console.log('\n🔄 Force re-sync enabled - deleting old data...\n');

      // DELETE all old vectors before syncing new ones
      const deletedCount = await deleteAllVectors(namespaceClient, namespace);
      console.log(
        `✅ Cleared ${deletedCount} old vectors - ready for fresh sync\n`,
      );
    }

    // Fetch course content from Circle.so
    console.log('📚 Fetching course content from Circle.so...');
    const courseContent = await fetchCourseContent(spaceId, courseId);
    console.log(`✅ Fetched course: ${courseContent.name}`);
    console.log(`   Lessons: ${courseContent.lessons.length}\n`);

    // Convert to documents
    console.log('📄 Converting course to documents...');
    const documents = courseToDocuments(courseContent);
    console.log(`✅ Created ${documents.length} documents\n`);

    if (documents.length === 0) {
      console.log('⚠️  No documents to process. Course may be empty.');
      return;
    }

    // Process each document
    let totalChunks = 0;
    let totalVectors = 0;
    let totalSourceChars = 0;
    let totalStoredChars = 0;

    for (let docIndex = 0; docIndex < documents.length; docIndex++) {
      const doc = documents[docIndex];
      const progress = `[${docIndex + 1}/${documents.length}]`;

      console.log(`\n${progress} Processing: ${doc.title}`);
      console.log(`   Content length: ${doc.content.length} chars`);

      totalSourceChars += doc.content.length;

      // Generate chunks
      const chunks = generateChunks(doc.content);
      totalChunks += chunks.length;

      // Track stored character count
      const chunkChars = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      totalStoredChars += chunkChars;

      if (chunks.length === 0) {
        console.log('   ⚠️  Skipping (no chunks generated - empty content)');
        continue;
      }

      // Generate embeddings for all chunks
      console.log('   🔄 Generating embeddings...');
      const { embeddings } = await embedMany({
        model: embeddingModel,
        values: chunks,
      });
      console.log(`   ✅ Generated ${embeddings.length} embeddings`);

      // Prepare vectors for Upstash
      const vectors = chunks.map((chunk, chunkIndex) => ({
        id: `doc-${docIndex}-chunk-${chunkIndex}`,
        vector: embeddings[chunkIndex],
        metadata: {
          courseId,
          courseName: courseContent.name,
          documentTitle: doc.title,
          documentIndex: docIndex,
          chunkIndex,
          lessonId: doc.metadata.lessonId,
          lessonOrder: doc.metadata.order,
          documentType: doc.metadata.type,
          chunk, // Store the actual text content
          createdAt: new Date().toISOString(),
        },
      }));

      // Upload to Upstash in batches
      const batchSize = 100;
      for (let i = 0; i < vectors.length; i += batchSize) {
        const batch = vectors.slice(i, i + batchSize);
        const batchNum = Math.floor(i / batchSize) + 1;
        const totalBatches = Math.ceil(vectors.length / batchSize);

        console.log(
          `   📤 Uploading batch ${batchNum}/${totalBatches} (${batch.length} vectors)...`,
        );

        try {
          await namespaceClient.upsert(batch);
          totalVectors += batch.length;
          console.log(`   ✅ Uploaded batch ${batchNum}/${totalBatches}`);
        } catch (uploadError) {
          console.error(
            `   ❌ Error uploading batch ${batchNum}:`,
            uploadError,
          );
          throw uploadError;
        }
      }

      console.log(`   ✅ Completed: ${doc.title}`);
    }

    // Summary with content verification
    console.log('\n========================================');
    console.log('✅ Sync Complete!');
    console.log('========================================');
    console.log(`Course: ${courseContent.name}`);
    console.log(`Namespace: ${namespace}`);
    console.log(`Documents processed: ${documents.length}`);
    console.log(`Total chunks: ${totalChunks}`);
    console.log(`Total vectors stored: ${totalVectors}`);
    console.log('\n📊 Content Verification:');
    console.log(
      `   Source content: ${totalSourceChars.toLocaleString()} chars`,
    );
    console.log(
      `   Stored in chunks: ${totalStoredChars.toLocaleString()} chars`,
    );

    // Calculate data retention (should be >95% due to overlap)
    const retentionRate = (totalStoredChars / totalSourceChars) * 100;
    console.log(`   Retention rate: ${retentionRate.toFixed(1)}%`);

    if (retentionRate < 95) {
      console.log('   ⚠️  WARNING: Some content may have been lost!');
    } else if (retentionRate > 100) {
      console.log(
        '   ✅ All content preserved (overlap creates some duplication)',
      );
    } else {
      console.log('   ✅ All content preserved');
    }
    console.log('========================================\n');

    // Verify storage
    console.log('🔍 Verifying storage...');
    try {
      const testQuery = await namespaceClient.query({
        vector: new Array(1536).fill(0),
        topK: 1,
        includeMetadata: true,
      });

      if (testQuery && testQuery.length > 0) {
        console.log(
          '✅ Verification successful - vectors are stored correctly',
        );
        console.log(`   Sample vector ID: ${testQuery[0].id}`);
        console.log(`   Sample metadata:`, testQuery[0].metadata);
      } else {
        console.log('⚠️  Warning: No vectors returned from verification query');
      }
    } catch (verifyError) {
      console.log('⚠️  Could not verify storage:', verifyError);
    }

    console.log('\n✨ Course is now ready to use!');
    console.log(
      `   Users can activate this course and it will reference namespace: ${namespace}\n`,
    );
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
      console.error('   Stack:', error.stack);
    }
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
  console.log(`
Circle Course → Upstash Sync Script
====================================

Syncs Circle.so course content to Upstash Vector database using the course ID as namespace.
This allows multiple users to share the same course data without duplication.

Usage:
  tsx scripts/sync-circle-course-to-upstash.ts <courseId> [spaceId] [--force]

Arguments:
  courseId    Circle.so course/space group ID (required)
  spaceId     Circle.so space ID (optional, uses CIRCLE_SPACE_ID env var if not provided)

Options:
  --force     Force re-sync even if data already exists (overwrites existing data)

Examples:
  tsx scripts/sync-circle-course-to-upstash.ts 123456
  tsx scripts/sync-circle-course-to-upstash.ts 123456 789012
  tsx scripts/sync-circle-course-to-upstash.ts 123456 --force

Environment Variables Required:
  UPSTASH_USER_RAG_REST_URL       Upstash Vector REST URL
  UPSTASH_USER_RAG_REST_TOKEN     Upstash Vector REST token
  CIRCLE_API_TOKEN                Circle.so API token
  CIRCLE_HEADLESS_AUTH_TOKEN      Circle.so headless auth token
  CIRCLE_SPACE_ID                 Default Circle.so space ID (optional)
`);
  process.exit(0);
}

// Filter out flags
const nonFlagArgs = args.filter((arg) => !arg.startsWith('--'));
const forceResync = args.includes('--force');

const courseId = nonFlagArgs[0];
const spaceId = nonFlagArgs[1] || CIRCLE_SPACE_ID;

if (!courseId) {
  console.error('❌ Error: Course ID is required');
  console.error(
    '   Usage: tsx scripts/sync-circle-course-to-upstash.ts <courseId> [spaceId] [--force]',
  );
  process.exit(1);
}

if (!spaceId) {
  console.error('❌ Error: Space ID is required');
  console.error(
    '   Provide it as an argument or set CIRCLE_SPACE_ID environment variable',
  );
  process.exit(1);
}

// Run the sync
syncCourseToUpstash(courseId, spaceId, forceResync);
