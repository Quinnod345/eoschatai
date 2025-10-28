#!/usr/bin/env tsx

/**
 * Backfill Memory Embeddings Script
 * 
 * This script generates embeddings for existing memories that don't have them.
 * Run this after the memory enhancement migration.
 * 
 * Usage: pnpm tsx scripts/backfill-memory-embeddings.ts
 */

import dotenv from 'dotenv';
import path from 'node:path';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';

// Load environment variables FIRST before any imports
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Import schema and utilities after env is loaded
import { userMemory, userMemoryEmbedding } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';
import { generateEmbeddings, generateChunks } from '@/lib/ai/embeddings';

// Create db connection directly (don't use cached connection from lib/db)
const databaseUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ Error: POSTGRES_URL or DATABASE_URL not found in environment');
  console.error('Make sure .env.local exists with database credentials');
  process.exit(1);
}

const client = postgres(databaseUrl);
const db = drizzle(client);

async function backfillMemoryEmbeddings() {
  console.log('🔄 Starting memory embeddings backfill...\n');

  try {
    // Find all memories without embeddings
    const memoriesWithoutEmbeddings = await db
      .select()
      .from(userMemory)
      .where(
        sql`NOT EXISTS (
          SELECT 1 FROM "UserMemoryEmbedding" 
          WHERE "UserMemoryEmbedding"."memoryId" = "UserMemory"."id"
        )`,
      );

    console.log(
      `📊 Found ${memoriesWithoutEmbeddings.length} memories without embeddings`,
    );

    if (memoriesWithoutEmbeddings.length === 0) {
      console.log('✅ All memories already have embeddings!');
      return;
    }

    let processed = 0;
    let failed = 0;

    for (const memory of memoriesWithoutEmbeddings) {
      try {
        console.log(
          `Processing memory ${memory.id}: "${memory.summary.substring(0, 50)}..."`,
        );

        // Combine summary and content for embedding
        const text = `${memory.summary}\n\n${memory.content || ''}`.trim();
        
        // Generate chunks
        const chunks = generateChunks(text, 512);
        
        // Generate embeddings
        const embeddings = await generateEmbeddings(chunks);
        
        // Insert embeddings
        const values = embeddings.map((e) => ({
          memoryId: memory.id,
          chunk: e.chunk,
          embedding: e.embedding as any,
          createdAt: new Date(),
        }));

        if (values.length > 0) {
          await db.insert(userMemoryEmbedding).values(values as any[]);
          processed++;
          console.log(
            `  ✓ Created ${values.length} embeddings for memory ${memory.id}`,
          );
        }
      } catch (error) {
        console.error(`  ✗ Failed to process memory ${memory.id}:`, error);
        failed++;
      }
    }

    console.log('\n═══════════════════════════════════════');
    console.log('BACKFILL COMPLETE');
    console.log('═══════════════════════════════════════');
    console.log(`✅ Processed: ${processed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📊 Total: ${memoriesWithoutEmbeddings.length}`);
    console.log();
  } catch (error) {
    console.error('❌ Backfill failed:', error);
    process.exit(1);
  } finally {
    // Close database connection
    await client.end();
  }
}

backfillMemoryEmbeddings();

