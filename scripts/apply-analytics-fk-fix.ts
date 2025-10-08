#!/usr/bin/env tsx

/**
 * Apply AnalyticsEvent FK constraint fix
 *
 * This script fixes the foreign key constraints for AnalyticsEvent table
 * to allow organizations to be deleted properly.
 *
 * Run with: npx tsx scripts/apply-analytics-fk-fix.ts
 */

import { config } from 'dotenv';
import postgres from 'postgres';

// Load environment variables
config({ path: '.env.local' });

async function main() {
  console.log('🔧 Applying AnalyticsEvent FK constraint fix...\n');

  const databaseUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ Database URL not found in environment');
    console.error(
      'Make sure POSTGRES_URL or DATABASE_URL is set in .env.local',
    );
    process.exit(1);
  }

  const connection = postgres(databaseUrl, { max: 1 });

  try {
    // Check if AnalyticsEvent table exists
    const tableExists = await connection`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'AnalyticsEvent'
      ) as "exists"
    `;

    if (!tableExists[0].exists) {
      console.log('ℹ️  AnalyticsEvent table does not exist, skipping migration');
      await connection.end();
      process.exit(0);
    }

    console.log('1️⃣ Dropping existing FK constraints...');

    // Drop existing userId constraint
    try {
      await connection`
        ALTER TABLE "AnalyticsEvent" 
        DROP CONSTRAINT IF EXISTS "AnalyticsEvent_userId_User_id_fk"
      `;
      console.log('   ✅ Dropped userId constraint');
    } catch (error) {
      console.log('   ℹ️  userId constraint might not exist, continuing...');
    }

    // Drop existing orgId constraint
    try {
      await connection`
        ALTER TABLE "AnalyticsEvent"
        DROP CONSTRAINT IF EXISTS "AnalyticsEvent_orgId_Org_id_fk"
      `;
      console.log('   ✅ Dropped orgId constraint');
    } catch (error) {
      console.log('   ℹ️  orgId constraint might not exist, continuing...');
    }

    console.log('\n2️⃣ Adding new FK constraints with ON DELETE SET NULL...');

    // Add userId constraint with proper ON DELETE behavior
    await connection`
      ALTER TABLE "AnalyticsEvent"
      ADD CONSTRAINT "AnalyticsEvent_userId_User_id_fk"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL
    `;
    console.log('   ✅ Added userId constraint');

    // Add orgId constraint with proper ON DELETE behavior
    await connection`
      ALTER TABLE "AnalyticsEvent"
      ADD CONSTRAINT "AnalyticsEvent_orgId_Org_id_fk"
      FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE SET NULL
    `;
    console.log('   ✅ Added orgId constraint');

    console.log('\n✅ AnalyticsEvent FK constraints fixed successfully!\n');

    // Verify the constraints
    console.log('3️⃣ Verifying constraints...');
    const constraints = await connection`
      SELECT 
        conname as constraint_name,
        confdeltype as delete_action
      FROM pg_constraint
      WHERE conrelid = '"AnalyticsEvent"'::regclass
        AND contype = 'f'
        AND (conname = 'AnalyticsEvent_userId_User_id_fk' 
             OR conname = 'AnalyticsEvent_orgId_Org_id_fk')
    `;

    for (const constraint of constraints) {
      const action = constraint.delete_action === 'n' ? 'SET NULL' : 'OTHER';
      console.log(`   ✓ ${constraint.constraint_name}: ON DELETE ${action}`);
    }

    await connection.end();
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    await connection.end();
    process.exit(1);
  }
}

main()
  .then(() => {
    console.log('\n🎉 Migration completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
