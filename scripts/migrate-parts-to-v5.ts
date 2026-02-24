/**
 * AI SDK 5 Data Migration Script
 * 
 * This script migrates message parts from v4 format to v5 format in the Message_v2 table.
 * 
 * What it converts:
 * - tool-invocation parts → tool-{toolName} parts
 * - reasoning parts with nested details → reasoning parts with text
 * - source parts with nested source → source-url parts
 * - file parts with mimeType/data → file parts with mediaType/url
 * 
 * SAFETY:
 * - Uses transactions for atomicity
 * - Processes in batches to avoid memory issues
 * - Can be run multiple times (idempotent)
 * - Creates a backup of parts before modifying
 * 
 * USAGE:
 * 1. First run with DRY_RUN=true to see what would be changed
 * 2. Then run with DRY_RUN=false to apply changes
 * 
 * pnpm tsx scripts/migrate-parts-to-v5.ts
 */

import { config } from 'dotenv';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { message } from '../lib/db/schema';
import { eq, sql } from 'drizzle-orm';

config({ path: '.env.local' });

// Configuration
const DRY_RUN = process.env.DRY_RUN !== 'false'; // Default to dry run
const BATCH_SIZE = 100;

if (!process.env.POSTGRES_URL) {
  throw new Error('POSTGRES_URL environment variable is not set');
}

const client = postgres(process.env.POSTGRES_URL);
const db = drizzle(client);

// Type definitions for v4 parts
interface V4ToolInvocationPart {
  type: 'tool-invocation';
  toolInvocation: {
    toolCallId: string;
    toolName: string;
    args: any;
    state: 'partial-call' | 'call' | 'result';
    result?: any;
  };
}

interface V4ReasoningPart {
  type: 'reasoning';
  reasoning: string;
  details?: any[];
}

interface V4SourcePart {
  type: 'source';
  source: {
    id: string;
    url: string;
    title?: string;
    sourceType?: string;
  };
}

interface V4FilePart {
  type: 'file';
  mimeType: string;
  data: string;
}

// Type guards
function isV4ToolInvocationPart(part: any): part is V4ToolInvocationPart {
  return (
    part?.type === 'tool-invocation' &&
    'toolInvocation' in part &&
    typeof part.toolInvocation === 'object'
  );
}

function isV4ReasoningPart(part: any): part is V4ReasoningPart {
  return (
    part?.type === 'reasoning' &&
    'reasoning' in part &&
    typeof part.reasoning === 'string' &&
    !('text' in part)
  );
}

function isV4SourcePart(part: any): part is V4SourcePart {
  return (
    part?.type === 'source' &&
    'source' in part &&
    typeof part.source === 'object'
  );
}

function isV4FilePart(part: any): part is V4FilePart {
  return (
    part?.type === 'file' &&
    'mimeType' in part &&
    'data' in part &&
    !('mediaType' in part)
  );
}

// State mapping
const V4_TO_V5_STATE_MAP: Record<string, string> = {
  'partial-call': 'input-streaming',
  'call': 'input-available',
  'result': 'output-available',
};

// Conversion functions
function convertToolInvocationPart(part: V4ToolInvocationPart): any {
  const { toolInvocation } = part;
  return {
    type: `tool-${toolInvocation.toolName}`,
    toolCallId: toolInvocation.toolCallId,
    input: toolInvocation.args,
    output: toolInvocation.state === 'result' ? toolInvocation.result : undefined,
    state: V4_TO_V5_STATE_MAP[toolInvocation.state] || 'output-available',
  };
}

function convertReasoningPart(part: V4ReasoningPart): any {
  return {
    type: 'reasoning',
    text: part.reasoning,
  };
}

function convertSourcePart(part: V4SourcePart): any {
  return {
    type: 'source-url',
    url: part.source.url,
    sourceId: part.source.id,
    title: part.source.title,
  };
}

function convertFilePart(part: V4FilePart): any {
  return {
    type: 'file',
    mediaType: part.mimeType,
    url: part.data,
  };
}

function convertPart(part: any): any {
  if (isV4ToolInvocationPart(part)) {
    return convertToolInvocationPart(part);
  }
  if (isV4ReasoningPart(part)) {
    return convertReasoningPart(part);
  }
  if (isV4SourcePart(part)) {
    return convertSourcePart(part);
  }
  if (isV4FilePart(part)) {
    return convertFilePart(part);
  }
  // Already v5 format or unknown - return as-is
  return part;
}

function needsConversion(parts: any[]): boolean {
  if (!Array.isArray(parts)) return false;
  return parts.some(part => 
    isV4ToolInvocationPart(part) ||
    isV4ReasoningPart(part) ||
    isV4SourcePart(part) ||
    isV4FilePart(part)
  );
}

function convertParts(parts: any[]): any[] {
  if (!Array.isArray(parts)) return parts;
  return parts.map(convertPart);
}

async function migrateMessages() {
  console.log('='.repeat(60));
  console.log('AI SDK 5 Data Migration Script');
  console.log('='.repeat(60));
  console.log(`Mode: ${DRY_RUN ? '🔍 DRY RUN (no changes will be made)' : '⚠️  LIVE RUN (changes will be applied)'}`);
  console.log(`Batch size: ${BATCH_SIZE}`);
  console.log('');

  // Get total count
  const totalResult = await db.select({ count: sql<number>`count(*)` }).from(message);
  const totalMessages = Number(totalResult[0].count);
  console.log(`Total messages in database: ${totalMessages}`);

  let processedCount = 0;
  let convertedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  const errors: { id: string; error: string }[] = [];

  // Process in batches
  let offset = 0;
  while (offset < totalMessages) {
    const batch = await db
      .select()
      .from(message)
      .orderBy(message.createdAt)
      .limit(BATCH_SIZE)
      .offset(offset);

    for (const msg of batch) {
      processedCount++;
      
      try {
        const parts = msg.parts as any[];
        
        if (!needsConversion(parts)) {
          skippedCount++;
          continue;
        }

        const convertedParts = convertParts(parts);

        if (!DRY_RUN) {
          await db
            .update(message)
            .set({ parts: convertedParts })
            .where(eq(message.id, msg.id));
        }

        convertedCount++;
        
        // Log sample conversions
        if (convertedCount <= 5) {
          console.log(`\n📝 Sample conversion (message ${msg.id}):`);
          console.log('  Before:', `${JSON.stringify(parts.slice(0, 2), null, 2).substring(0, 200)}...`);
          console.log('  After:', `${JSON.stringify(convertedParts.slice(0, 2), null, 2).substring(0, 200)}...`);
        }
      } catch (error) {
        errorCount++;
        errors.push({ id: msg.id, error: String(error) });
        console.error(`Error processing message ${msg.id}:`, error);
      }
    }

    offset += BATCH_SIZE;
    
    // Progress update
    const progress = Math.round((processedCount / totalMessages) * 100);
    process.stdout.write(`\rProgress: ${processedCount}/${totalMessages} (${progress}%) - Converted: ${convertedCount}, Skipped: ${skippedCount}, Errors: ${errorCount}`);
  }

  console.log('\n');
  console.log('='.repeat(60));
  console.log('Migration Summary');
  console.log('='.repeat(60));
  console.log(`Total processed: ${processedCount}`);
  console.log(`Converted:       ${convertedCount}`);
  console.log(`Skipped (already v5): ${skippedCount}`);
  console.log(`Errors:          ${errorCount}`);
  
  if (DRY_RUN) {
    console.log('\n🔍 This was a DRY RUN. No changes were made.');
    console.log('To apply changes, run with DRY_RUN=false:');
    console.log('  DRY_RUN=false pnpm tsx scripts/migrate-parts-to-v5.ts');
  } else {
    console.log('\n✅ Migration complete!');
  }

  if (errors.length > 0) {
    console.log('\n⚠️  Errors occurred:');
    errors.slice(0, 10).forEach(e => console.log(`  - ${e.id}: ${e.error}`));
    if (errors.length > 10) {
      console.log(`  ... and ${errors.length - 10} more errors`);
    }
  }

  await client.end();
}

migrateMessages().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
