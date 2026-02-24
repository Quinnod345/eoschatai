/**
 * AI SDK 5 Migration Verification Script
 * 
 * This script checks the current state of message parts in the database
 * to verify the migration status.
 * 
 * USAGE:
 * pnpm tsx scripts/verify-v5-migration.ts
 */

import { config } from 'dotenv';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { message } from '../lib/db/schema';
import { sql } from 'drizzle-orm';

config({ path: '.env.local' });

if (!process.env.POSTGRES_URL) {
  throw new Error('POSTGRES_URL environment variable is not set');
}

const client = postgres(process.env.POSTGRES_URL);
const db = drizzle(client);

// Type guards for v4 parts
function hasV4ToolInvocation(parts: any[]): boolean {
  return parts.some(part => 
    part?.type === 'tool-invocation' && 'toolInvocation' in part
  );
}

function hasV4Reasoning(parts: any[]): boolean {
  return parts.some(part => 
    part?.type === 'reasoning' && 'reasoning' in part && !('text' in part)
  );
}

function hasV4Source(parts: any[]): boolean {
  return parts.some(part => 
    part?.type === 'source' && 'source' in part
  );
}

function hasV4File(parts: any[]): boolean {
  return parts.some(part => 
    part?.type === 'file' && 'mimeType' in part && !('mediaType' in part)
  );
}

// Check for v5 parts
function hasV5ToolParts(parts: any[]): boolean {
  return parts.some(part => 
    part?.type?.startsWith('tool-') && part.type !== 'tool-invocation'
  );
}

function hasV5Reasoning(parts: any[]): boolean {
  return parts.some(part => 
    part?.type === 'reasoning' && 'text' in part
  );
}

async function verifyMigration() {
  console.log('='.repeat(60));
  console.log('AI SDK 5 Migration Verification');
  console.log('='.repeat(60));
  console.log('');

  // Get total count
  const totalResult = await db.select({ count: sql<number>`count(*)` }).from(message);
  const totalMessages = Number(totalResult[0].count);
  console.log(`Total messages in Message_v2 table: ${totalMessages}`);
  console.log('');

  // Sample messages for analysis
  const SAMPLE_SIZE = 1000;
  const sampleMessages = await db
    .select()
    .from(message)
    .orderBy(sql`RANDOM()`)
    .limit(SAMPLE_SIZE);

  const stats = {
    total: sampleMessages.length,
    withParts: 0,
    v4ToolInvocation: 0,
    v4Reasoning: 0,
    v4Source: 0,
    v4File: 0,
    v5ToolParts: 0,
    v5Reasoning: 0,
    textOnly: 0,
    empty: 0,
  };

  const v4Examples: { type: string; messageId: string; sample: any }[] = [];

  for (const msg of sampleMessages) {
    const parts = msg.parts as any[];
    
    if (!Array.isArray(parts) || parts.length === 0) {
      stats.empty++;
      continue;
    }
    
    stats.withParts++;

    // Check for v4 formats
    if (hasV4ToolInvocation(parts)) {
      stats.v4ToolInvocation++;
      if (v4Examples.length < 3) {
        const toolPart = parts.find(p => p?.type === 'tool-invocation');
        v4Examples.push({ type: 'tool-invocation', messageId: msg.id, sample: toolPart });
      }
    }
    
    if (hasV4Reasoning(parts)) {
      stats.v4Reasoning++;
      if (v4Examples.length < 6) {
        const reasoningPart = parts.find(p => p?.type === 'reasoning' && 'reasoning' in p);
        v4Examples.push({ type: 'v4-reasoning', messageId: msg.id, sample: reasoningPart });
      }
    }
    
    if (hasV4Source(parts)) {
      stats.v4Source++;
    }
    
    if (hasV4File(parts)) {
      stats.v4File++;
    }

    // Check for v5 formats
    if (hasV5ToolParts(parts)) {
      stats.v5ToolParts++;
    }
    
    if (hasV5Reasoning(parts)) {
      stats.v5Reasoning++;
    }

    // Check for text-only messages
    if (parts.every(p => p?.type === 'text')) {
      stats.textOnly++;
    }
  }

  console.log('📊 Sample Analysis Results');
  console.log('-'.repeat(40));
  console.log(`Sample size: ${stats.total} messages`);
  console.log(`Messages with parts: ${stats.withParts}`);
  console.log(`Empty/no parts: ${stats.empty}`);
  console.log('');
  
  console.log('🔴 V4 Format Parts (need migration):');
  console.log(`  - tool-invocation (nested): ${stats.v4ToolInvocation}`);
  console.log(`  - reasoning (old format): ${stats.v4Reasoning}`);
  console.log(`  - source (nested): ${stats.v4Source}`);
  console.log(`  - file (mimeType/data): ${stats.v4File}`);
  console.log('');
  
  console.log('🟢 V5 Format Parts (already migrated):');
  console.log(`  - tool-* parts: ${stats.v5ToolParts}`);
  console.log(`  - reasoning (text): ${stats.v5Reasoning}`);
  console.log(`  - text-only messages: ${stats.textOnly}`);
  console.log('');

  const v4Total = stats.v4ToolInvocation + stats.v4Reasoning + stats.v4Source + stats.v4File;
  const migrationNeeded = v4Total > 0;

  if (migrationNeeded) {
    console.log('⚠️  MIGRATION NEEDED');
    console.log(`Found ${v4Total} messages with v4 format parts in sample.`);
    console.log(`Estimated total: ~${Math.round((v4Total / stats.total) * totalMessages)} messages`);
    console.log('');
    console.log('Run the migration script:');
    console.log('  1. Dry run: pnpm tsx scripts/migrate-parts-to-v5.ts');
    console.log('  2. Apply:   DRY_RUN=false pnpm tsx scripts/migrate-parts-to-v5.ts');
  } else {
    console.log('✅ NO MIGRATION NEEDED');
    console.log('All sampled messages are already in v5 format or have no tool/reasoning parts.');
  }

  if (v4Examples.length > 0) {
    console.log('');
    console.log('📝 Examples of v4 format parts found:');
    console.log('-'.repeat(40));
    for (const example of v4Examples.slice(0, 3)) {
      console.log(`\nType: ${example.type} (message: ${example.messageId})`);
      console.log(JSON.stringify(example.sample, null, 2).substring(0, 500));
    }
  }

  await client.end();
}

verifyMigration().catch((error) => {
  console.error('Verification failed:', error);
  process.exit(1);
});
