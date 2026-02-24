#!/usr/bin/env tsx
/**
 * List Circle Course Personas and Their Sync Status
 * 
 * This script displays all Circle.so courses that have been set up in the system,
 * their sync status, and associated personas.
 * 
 * Usage:
 *   tsx scripts/list-circle-courses.ts [--check-upstash]
 * 
 * Options:
 *   --check-upstash    Also check if data exists in Upstash (slower)
 */

import { db } from '@/lib/db';
import { circleCoursePersona, persona } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

interface CourseInfo {
  courseId: string;
  spaceId: string;
  personaId: string;
  personaName: string;
  courseName: string;
  targetAudience: string;
  syncStatus: string;
  namespace: string | null;
  lastSynced: Date | null;
  createdAt: Date;
}

async function checkUpstashNamespace(namespace: string): Promise<{
  exists: boolean;
  vectorCount: number;
}> {
  try {
    const { Index } = await import('@upstash/vector');
    
    const upstashUrl = process.env.UPSTASH_USER_RAG_REST_URL;
    const upstashToken = process.env.UPSTASH_USER_RAG_REST_TOKEN;

    if (!upstashUrl || !upstashToken) {
      return { exists: false, vectorCount: 0 };
    }

    const upstashClient = new Index({
      url: upstashUrl,
      token: upstashToken,
    });

    const namespaceClient = upstashClient.namespace(namespace);

    // Try to fetch a single vector to check if namespace exists
    const result = await namespaceClient.query({
      vector: new Array(1536).fill(0),
      topK: 1,
      includeMetadata: false,
    });

    // Count vectors by doing a range query
    let vectorCount = 0;
    let cursor = '';
    
    while (true) {
      const rangeResult = await namespaceClient.range({
        cursor,
        limit: 1000,
        includeMetadata: false,
        includeVectors: false,
      });

      if (rangeResult.vectors) {
        vectorCount += rangeResult.vectors.length;
      }

      if (!rangeResult.nextCursor) {
        break;
      }

      cursor = rangeResult.nextCursor;
    }

    return {
      exists: vectorCount > 0,
      vectorCount,
    };
  } catch (error) {
    console.error(`Error checking namespace ${namespace}:`, error);
    return { exists: false, vectorCount: 0 };
  }
}

async function listCourses(checkUpstash = false) {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║       Circle Course Personas - Status Report                  ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  try {
    // Fetch all course personas
    const courses = await db
      .select({
        courseId: circleCoursePersona.circleCourseId,
        spaceId: circleCoursePersona.circleSpaceId,
        personaId: circleCoursePersona.personaId,
        courseName: circleCoursePersona.courseName,
        courseDescription: circleCoursePersona.courseDescription,
        targetAudience: circleCoursePersona.targetAudience,
        syncStatus: circleCoursePersona.syncStatus,
        lastSyncedAt: circleCoursePersona.lastSyncedAt,
        createdAt: circleCoursePersona.createdAt,
      })
      .from(circleCoursePersona)
      .orderBy(circleCoursePersona.createdAt);

    if (courses.length === 0) {
      console.log('📭 No Circle course personas found in the database.\n');
      console.log('To add a course:');
      console.log('  1. Run: tsx scripts/sync-circle-course-to-upstash.ts <courseId>');
      console.log('  2. Have users visit: /api/circle/activate-course?courseId=<courseId>\n');
      return;
    }

    console.log(`Found ${courses.length} course persona(s):\n`);

    // Fetch persona details for each course
    const courseInfos: CourseInfo[] = [];
    
    for (const course of courses) {
      const [personaData] = await db
        .select()
        .from(persona)
        .where(eq(persona.id, course.personaId))
        .limit(1);

      courseInfos.push({
        courseId: course.courseId,
        spaceId: course.spaceId,
        personaId: course.personaId,
        personaName: personaData?.name || 'Unknown',
        courseName: course.courseName,
        targetAudience: course.targetAudience,
        syncStatus: course.syncStatus || 'unknown',
        namespace: personaData?.knowledgeNamespace || null,
        lastSynced: course.lastSyncedAt,
        createdAt: course.createdAt,
      });
    }

    // Display each course
    for (let i = 0; i < courseInfos.length; i++) {
      const course = courseInfos[i];
      const isLast = i === courseInfos.length - 1;

      console.log(`${'─'.repeat(70)}`);
      console.log(`📚 Course ${i + 1}/${courseInfos.length}: ${course.courseName}`);
      console.log(`${'─'.repeat(70)}`);
      
      // Basic info
      console.log(`   Course ID:       ${course.courseId}`);
      console.log(`   Space ID:        ${course.spaceId}`);
      console.log(`   Persona ID:      ${course.personaId}`);
      console.log(`   Persona Name:    ${course.personaName}`);
      console.log(`   Target Audience: ${course.targetAudience}`);
      
      // Sync status
      const statusIcon = course.syncStatus === 'complete' ? '✅' :
                        course.syncStatus === 'pending' ? '⏳' :
                        course.syncStatus === 'syncing' ? '🔄' :
                        course.syncStatus === 'failed' ? '❌' : '❓';
      console.log(`   Sync Status:     ${statusIcon} ${course.syncStatus}`);
      
      if (course.lastSynced) {
        console.log(`   Last Synced:     ${course.lastSynced.toLocaleString()}`);
      } else {
        console.log(`   Last Synced:     Never`);
      }
      
      console.log(`   Created:         ${course.createdAt.toLocaleString()}`);
      
      // Namespace info
      if (course.namespace) {
        console.log(`   Namespace:       ${course.namespace}`);
        
        const isCircleCourse = course.namespace.startsWith('circle-course-');
        if (isCircleCourse) {
          console.log(`   Storage Type:    ✨ Upstash (shared)`);
          
          // Check Upstash if requested
          if (checkUpstash) {
            console.log(`   Checking Upstash...`);
            const upstashInfo = await checkUpstashNamespace(course.namespace);
            
            if (upstashInfo.exists) {
              console.log(`   Upstash Status:  ✅ ${upstashInfo.vectorCount} vectors stored`);
            } else {
              console.log(`   Upstash Status:  ⚠️  No vectors found - needs sync!`);
              console.log(`   Fix:             tsx scripts/sync-circle-course-to-upstash.ts ${course.courseId}`);
            }
          }
        } else {
          console.log(`   Storage Type:    💾 PostgreSQL (old method)`);
          console.log(`   Note:            Consider migrating to Upstash for better performance`);
        }
      } else {
        console.log(`   Namespace:       ⚠️  Not set`);
        console.log(`   Status:          Configuration issue - namespace should be set`);
      }
      
      if (!isLast) {
        console.log();
      }
    }

    console.log(`${'─'.repeat(70)}`);
    console.log();

    // Summary
    const completeCount = courseInfos.filter(c => c.syncStatus === 'complete').length;
    const pendingCount = courseInfos.filter(c => c.syncStatus === 'pending').length;
    const failedCount = courseInfos.filter(c => c.syncStatus === 'failed').length;
    const upstashCount = courseInfos.filter(c => c.namespace?.startsWith('circle-course-')).length;

    console.log('Summary:');
    console.log(`  Total Courses:      ${courseInfos.length}`);
    console.log(`  ✅ Complete:        ${completeCount}`);
    console.log(`  ⏳ Pending:         ${pendingCount}`);
    console.log(`  ❌ Failed:          ${failedCount}`);
    console.log(`  ✨ Using Upstash:   ${upstashCount}`);
    console.log();

    // Recommendations
    if (pendingCount > 0 || failedCount > 0) {
      console.log('⚠️  Action Required:');
      courseInfos
        .filter(c => c.syncStatus === 'pending' || c.syncStatus === 'failed')
        .forEach(c => {
          console.log(`   • Sync course ${c.courseId}: tsx scripts/sync-circle-course-to-upstash.ts ${c.courseId}`);
        });
      console.log();
    }

    if (upstashCount < courseInfos.length) {
      console.log('💡 Recommendation:');
      console.log('   Consider migrating old PostgreSQL courses to Upstash for better performance.');
      console.log('   Update persona knowledgeNamespace to "circle-course-{courseId}" after syncing.\n');
    }

  } catch (error) {
    console.error('❌ Error listing courses:', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
    }
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const checkUpstash = args.includes('--check-upstash');

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Circle Course Personas - List Script
=====================================

Lists all Circle.so course personas and their sync status.

Usage:
  tsx scripts/list-circle-courses.ts [--check-upstash]

Options:
  --check-upstash    Also verify data exists in Upstash (slower, makes API calls)
  --help, -h         Show this help message

Examples:
  tsx scripts/list-circle-courses.ts
  tsx scripts/list-circle-courses.ts --check-upstash
`);
  process.exit(0);
}

// Run the script
listCourses(checkUpstash).then(() => {
  process.exit(0);
});
