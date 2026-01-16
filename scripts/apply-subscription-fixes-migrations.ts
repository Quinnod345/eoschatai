#!/usr/bin/env tsx

/**
 * Apply subscription fixes migrations
 *
 * This script applies the new schema changes for subscription bug fixes:
 * 1. Add pendingRemoval field to Org table
 * 2. Add seat count constraints
 * 3. Fix analytics FK cascades
 *
 * Run with: npx tsx scripts/apply-subscription-fixes-migrations.ts
 */

import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';

async function main() {
  console.log('🔧 Applying subscription fixes migrations...\n');

  try {
    // Migration 1: Add pendingRemoval field
    console.log('1️⃣ Adding pendingRemoval field to Org table...');
    await db.execute(sql`
      ALTER TABLE "Org" 
      ADD COLUMN IF NOT EXISTS "pendingRemoval" integer DEFAULT 0;
    `);

    await db.execute(sql`
      UPDATE "Org" 
      SET "pendingRemoval" = 0 
      WHERE "pendingRemoval" IS NULL;
    `);
    console.log('✅ pendingRemoval field added\n');

    // Migration 2: Add seat count constraints
    console.log('2️⃣ Adding seat count constraints...');

    // Drop existing constraints if they exist
    await db.execute(sql`
      ALTER TABLE "Org" 
      DROP CONSTRAINT IF EXISTS "org_seat_count_positive";
    `);

    await db.execute(sql`
      ALTER TABLE "Org"
      DROP CONSTRAINT IF EXISTS "org_pending_removal_valid";
    `);

    // Add new constraints
    await db.execute(sql`
      ALTER TABLE "Org" 
      ADD CONSTRAINT "org_seat_count_positive" 
      CHECK ("seatCount" > 0 AND "seatCount" <= 10000);
    `);

    await db.execute(sql`
      ALTER TABLE "Org"
      ADD CONSTRAINT "org_pending_removal_valid"
      CHECK ("pendingRemoval" >= 0 AND "pendingRemoval" <= "seatCount");
    `);

    // Clean up any invalid data
    await db.execute(sql`
      UPDATE "Org" SET "seatCount" = 1 WHERE "seatCount" <= 0;
    `);

    await db.execute(sql`
      UPDATE "Org" SET "seatCount" = 10000 WHERE "seatCount" > 10000;
    `);

    await db.execute(sql`
      UPDATE "Org" SET "pendingRemoval" = 0 WHERE "pendingRemoval" < 0;
    `);

    await db.execute(sql`
      UPDATE "Org" SET "pendingRemoval" = "seatCount" WHERE "pendingRemoval" > "seatCount";
    `);

    console.log('✅ Seat count constraints added\n');

    // Migration 3: Fix analytics FK cascades
    console.log('3️⃣ Fixing analytics FK cascades...');

    // Drop existing constraints
    await db.execute(sql`
      ALTER TABLE "AnalyticsEvent" 
      DROP CONSTRAINT IF EXISTS "AnalyticsEvent_userId_User_id_fk";
    `);

    await db.execute(sql`
      ALTER TABLE "AnalyticsEvent"
      DROP CONSTRAINT IF EXISTS "AnalyticsEvent_orgId_Org_id_fk";
    `);

    // Re-add with proper ON DELETE behavior
    await db.execute(sql`
      ALTER TABLE "AnalyticsEvent"
      ADD CONSTRAINT "AnalyticsEvent_userId_User_id_fk"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL;
    `);

    await db.execute(sql`
      ALTER TABLE "AnalyticsEvent"
      ADD CONSTRAINT "AnalyticsEvent_orgId_Org_id_fk"
      FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE SET NULL;
    `);

    console.log('✅ Analytics FK cascades fixed\n');

    console.log('🎉 All subscription fixes migrations applied successfully!\n');
    console.log('Next steps:');
    console.log(
      '1. Configure Stripe webhooks (see STRIPE-WEBHOOK-CONFIGURATION.md)',
    );
    console.log(
      '2. Run cleanup script: npx tsx scripts/cleanup-orphaned-orgs.ts --dry-run',
    );
    console.log('3. Test in staging environment');
    console.log('4. Deploy to production\n');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }

  process.exit(0);
}

main();




























































