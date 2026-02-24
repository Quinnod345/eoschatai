#!/usr/bin/env tsx

import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

async function main() {
  console.log('Running plan and entitlements migrations...');

  try {
    // Check if Org table exists
    const orgTableExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'Org'
      );
    `);

    if (!orgTableExists.rows[0]?.exists) {
      console.log('Creating Org table and related structures...');

      // Read and execute the migration file
      const migrationPath = join(
        __dirname,
        '../drizzle/0017_plan_and_entitlements.sql',
      );
      const migrationSQL = readFileSync(migrationPath, 'utf-8');

      // Split by semicolons and execute each statement
      const statements = migrationSQL
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      for (const statement of statements) {
        console.log(`Executing: ${statement.substring(0, 50)}...`);
        await db.execute(sql.raw(statement));
      }

      console.log('✅ Plan and entitlements migration completed successfully!');
    } else {
      console.log('✅ Org table already exists, skipping migration.');
    }

    // Check if AnalyticsEvent table exists
    const analyticsTableExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'AnalyticsEvent'
      );
    `);

    if (!analyticsTableExists.rows[0]?.exists) {
      console.log('Creating AnalyticsEvent table...');

      const analyticsPath = join(
        __dirname,
        '../drizzle/0018_analytics_events.sql',
      );
      const analyticsSQL = readFileSync(analyticsPath, 'utf-8');

      const statements = analyticsSQL
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      for (const statement of statements) {
        console.log(`Executing: ${statement.substring(0, 50)}...`);
        await db.execute(sql.raw(statement));
      }

      console.log('✅ Analytics event table created successfully!');
    } else {
      console.log('✅ AnalyticsEvent table already exists, skipping.');
    }

    console.log('\n🎉 All migrations completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

main();
