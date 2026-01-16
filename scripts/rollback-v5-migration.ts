/**
 * Rollback V5 Migration
 * 
 * Restores message parts from the backup table created before migration.
 * 
 * USAGE:
 * pnpm tsx scripts/rollback-v5-migration.ts
 */

import { config } from 'dotenv';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';

config({ path: '.env.local' });

if (!process.env.POSTGRES_URL) {
  throw new Error('POSTGRES_URL environment variable is not set');
}

const client = postgres(process.env.POSTGRES_URL);
const db = drizzle(client);

async function rollbackMigration() {
  console.log('='.repeat(60));
  console.log('V5 Migration Rollback Script');
  console.log('='.repeat(60));
  console.log('');

  try {
    // Check if backup table exists
    const tableExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'Message_v2_backup'
      );
    `);

    if (!tableExists[0]?.exists) {
      console.log('❌ Backup table Message_v2_backup does not exist!');
      console.log('Cannot rollback without a backup.');
      await client.end();
      process.exit(1);
    }

    // Count messages to restore
    const countResult = await db.execute(sql`SELECT COUNT(*) as count FROM "Message_v2_backup"`);
    const backupCount = countResult[0]?.count || 0;

    console.log(`Found backup with ${backupCount} messages`);
    console.log('');
    console.log('⚠️  This will restore ALL message parts from the backup!');
    console.log('');

    // Perform rollback
    console.log('Restoring parts from backup...');
    
    await db.execute(sql`
      UPDATE "Message_v2" m 
      SET parts = b.parts 
      FROM "Message_v2_backup" b 
      WHERE m.id = b.id
    `);

    console.log('');
    console.log('✅ Rollback complete!');
    console.log(`   Restored parts for ${backupCount} messages`);
    console.log('');
    console.log('The backup table is still available if needed.');

  } catch (error) {
    console.error('Rollback failed:', error);
    throw error;
  } finally {
    await client.end();
  }
}

rollbackMigration().catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});
