/**
 * Manual re-sync script for Circle.so course personas
 * Usage: npx tsx scripts/resync-course-persona.ts <courseId>
 * Example: npx tsx scripts/resync-course-persona.ts 907974
 */

import { config } from 'dotenv';
import { resolve } from 'node:path';

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') });

async function resyncCoursePersona(courseId: string) {
  try {
    console.log(`\n🔄 Re-syncing course persona for course ID: ${courseId}\n`);

    const spaceId = process.env.CIRCLE_SPACE_ID || '2310423';

    console.log(`Using space ID: ${spaceId}`);

    const response = await fetch(
      'http://localhost:3000/api/circle/sync-course',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          courseId,
          spaceId,
          personaId: 'auto', // Will look up from database
        }),
      },
    );

    const result = await response.json();

    if (!response.ok) {
      console.error('❌ Sync failed:', result);
      process.exit(1);
    }

    console.log('\n✅ Sync successful!');
    console.log('📊 Result:', JSON.stringify(result, null, 2));
    console.log(
      `\n✨ Your course assistant is now ready with ${result.documentsProcessed} documents!\n`,
    );
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Get course ID from command line args
const courseId = process.argv[2];

if (!courseId) {
  console.error('Usage: npx tsx scripts/resync-course-persona.ts <courseId>');
  console.error('Example: npx tsx scripts/resync-course-persona.ts 907974');
  process.exit(1);
}

resyncCoursePersona(courseId);
