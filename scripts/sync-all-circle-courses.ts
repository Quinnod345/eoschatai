#!/usr/bin/env tsx
/**
 * Sync All Circle Courses to Upstash
 * 
 * This script syncs all Circle.so courses to Upstash Vector in one go.
 * Each course gets its own namespace for efficient sharing across users.
 * 
 * Usage:
 *   tsx scripts/sync-all-circle-courses.ts [--force]
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const CIRCLE_API_TOKEN = process.env.CIRCLE_API_TOKEN;
const CIRCLE_SPACE_ID = process.env.CIRCLE_SPACE_ID || '2310423';

interface Course {
  id: string;
  name: string;
  spaceCount: number;
}

const COURSES: Course[] = [
  { id: '782928', name: 'EOS A - Z', spaceCount: 14 },
  { id: '813417', name: 'EOS Implementer Community', spaceCount: 5 },
  { id: '815352', name: 'Biz Dev', spaceCount: 6 },
  { id: '815357', name: 'Practice Management', spaceCount: 11 },
  { id: '815361', name: 'Client Resources', spaceCount: 8 },
  { id: '815371', name: 'Path to Mastery', spaceCount: 6 },
  { id: '815739', name: 'Events', spaceCount: 4 },
  { id: '839429', name: 'Getting Started', spaceCount: 6 },
  { id: '850665', name: 'Franchise Advisory Council', spaceCount: 1 },
  { id: '879850', name: 'QCE Contributors Training', spaceCount: 1 },
  { id: '907974', name: 'Test', spaceCount: 1 },
];

async function syncAllCourses(forceResync: boolean = false) {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║          Sync ALL Circle Courses to Upstash               ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log(`Total courses to sync: ${COURSES.length}`);
  console.log(`Force re-sync: ${forceResync ? 'Yes' : 'No'}`);
  console.log(`Space ID: ${CIRCLE_SPACE_ID}\n`);

  const results: Array<{
    course: Course;
    success: boolean;
    error?: string;
    stats?: {
      documents: number;
      chunks: number;
      vectors: number;
      retention: string;
    };
  }> = [];

  for (let i = 0; i < COURSES.length; i++) {
    const course = COURSES[i];
    const progress = `[${i + 1}/${COURSES.length}]`;

    console.log('\n' + '═'.repeat(70));
    console.log(`${progress} ${course.name} (ID: ${course.id})`);
    console.log('═'.repeat(70) + '\n');

    try {
      // Build command
      const forceFlag = forceResync ? '--force' : '';
      const command = `pnpm tsx scripts/sync-circle-course-to-upstash.ts ${course.id} ${CIRCLE_SPACE_ID} ${forceFlag}`.trim();

      console.log(`Command: ${command}\n`);

      // Run sync
      const { stdout, stderr } = await execAsync(command, {
        cwd: process.cwd(),
        env: { ...process.env },
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      });

      // Print all output
      if (stdout) console.log(stdout);
      if (stderr) console.error('STDERR:', stderr);

      // Parse stats from output
      const docsMatch = stdout.match(/Documents processed: (\d+)/);
      const chunksMatch = stdout.match(/Total chunks: (\d+)/);
      const vectorsMatch = stdout.match(/Total vectors stored: (\d+)/);
      const retentionMatch = stdout.match(/Retention rate: ([\d.]+%)/);

      results.push({
        course,
        success: true,
        stats: {
          documents: docsMatch ? parseInt(docsMatch[1]) : 0,
          chunks: chunksMatch ? parseInt(chunksMatch[1]) : 0,
          vectors: vectorsMatch ? parseInt(vectorsMatch[1]) : 0,
          retention: retentionMatch ? retentionMatch[1] : 'N/A',
        },
      });

      console.log(`\n✅ ${progress} ${course.name} - SUCCESS\n`);
    } catch (error) {
      console.error(`\n❌ ${progress} ${course.name} - FAILED`);
      console.error('Error:', error instanceof Error ? error.message : error);
      
      results.push({
        course,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Final summary
  console.log('\n\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                    SYNC SUMMARY                            ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const successful = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  console.log(`Total Courses: ${COURSES.length}`);
  console.log(`✅ Successful: ${successful.length}`);
  console.log(`❌ Failed: ${failed.length}\n`);

  if (successful.length > 0) {
    console.log('━━━ Successful Syncs ━━━');
    successful.forEach((r) => {
      console.log(`✅ ${r.course.name} (${r.course.id})`);
      if (r.stats) {
        console.log(`   Documents: ${r.stats.documents}`);
        console.log(`   Vectors: ${r.stats.vectors}`);
        console.log(`   Retention: ${r.stats.retention}`);
      }
    });
    console.log();
  }

  if (failed.length > 0) {
    console.log('━━━ Failed Syncs ━━━');
    failed.forEach((r) => {
      console.log(`❌ ${r.course.name} (${r.course.id})`);
      console.log(`   Error: ${r.error}`);
    });
    console.log();
  }

  // Total stats
  const totalDocs = successful.reduce((sum, r) => sum + (r.stats?.documents || 0), 0);
  const totalVectors = successful.reduce((sum, r) => sum + (r.stats?.vectors || 0), 0);

  console.log('━━━ Total Statistics ━━━');
  console.log(`Total documents synced: ${totalDocs.toLocaleString()}`);
  console.log(`Total vectors in Upstash: ${totalVectors.toLocaleString()}`);
  console.log();

  if (failed.length > 0) {
    console.log('⚠️  Some courses failed to sync. You can retry them individually:\n');
    failed.forEach((r) => {
      console.log(`pnpm tsx scripts/sync-circle-course-to-upstash.ts ${r.course.id} ${CIRCLE_SPACE_ID} --force`);
    });
    console.log();
  }

  console.log('✨ All successful courses are ready for user activation!\n');
}

// Parse arguments
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Sync All Circle Courses to Upstash
====================================

Syncs all Circle.so courses to Upstash Vector in one operation.
Each course gets its own namespace for efficient data sharing.

Usage:
  tsx scripts/sync-all-circle-courses.ts [--force]

Options:
  --force     Force re-sync all courses (deletes and re-uploads data)

Examples:
  tsx scripts/sync-all-circle-courses.ts
  tsx scripts/sync-all-circle-courses.ts --force

Environment Variables Required:
  UPSTASH_USER_RAG_REST_URL
  UPSTASH_USER_RAG_REST_TOKEN
  CIRCLE_API_TOKEN
  CIRCLE_HEADLESS_AUTH_TOKEN
  CIRCLE_SPACE_ID
  OPENAI_API_KEY
`);
  process.exit(0);
}

const forceResync = args.includes('--force');

// Run the sync
syncAllCourses(forceResync).then(() => {
  console.log('🎉 All done!\n');
  process.exit(0);
}).catch((error) => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
