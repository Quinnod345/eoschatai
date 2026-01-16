/**
 * Backup Messages Before Migration
 * 
 * Creates a backup of all message parts before running the v5 migration.
 * The backup is stored in a new table: Message_v2_backup
 * 
 * USAGE:
 * pnpm tsx scripts/backup-messages-before-migration.ts
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

async function backupMessages() {
  console.log('='.repeat(60));
  console.log('Message Backup Script');
  console.log('='.repeat(60));
  console.log('');

  try {
    // Check if backup table already exists
    const tableExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'Message_v2_backup'
      );
    `);

    if (tableExists[0]?.exists) {
      console.log('⚠️  Backup table Message_v2_backup already exists!');
      console.log('');
      console.log('Options:');
      console.log('  1. Drop existing backup: DROP TABLE "Message_v2_backup";');
      console.log('  2. Use existing backup and skip this step');
      console.log('');
      
      // Count rows in backup
      const backupCount = await db.execute(sql`SELECT COUNT(*) as count FROM "Message_v2_backup"`);
      console.log(`Existing backup contains ${backupCount[0]?.count || 0} messages`);
      
      await client.end();
      return;
    }

    console.log('Creating backup table...');
    
    // Create backup table with same structure
    await db.execute(sql`
      CREATE TABLE "Message_v2_backup" AS 
      SELECT * FROM "Message_v2"
    `);

    // Add primary key
    await db.execute(sql`
      ALTER TABLE "Message_v2_backup" ADD PRIMARY KEY (id)
    `);

    // Count rows
    const countResult = await db.execute(sql`SELECT COUNT(*) as count FROM "Message_v2_backup"`);
    const backupCount = countResult[0]?.count || 0;

    console.log('');
    console.log('✅ Backup created successfully!');
    console.log(`   Table: Message_v2_backup`);
    console.log(`   Rows backed up: ${backupCount}`);
    console.log('');
    console.log('To restore from backup if needed:');
    console.log('  UPDATE "Message_v2" m SET parts = b.parts FROM "Message_v2_backup" b WHERE m.id = b.id;');
    console.log('');
    console.log('To drop backup after successful migration:');
    console.log('  DROP TABLE "Message_v2_backup";');

  } catch (error) {
    console.error('Backup failed:', error);
    throw error;
  } finally {
    await client.end();
  }
}

backupMessages().catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});
