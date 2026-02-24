/**
 * Run the stream state tracking migration
 * Usage: npx tsx scripts/run-stream-migration.ts
 */

import postgres from 'postgres';
import * as dotenv from 'dotenv';
import * as fs from 'node:fs';
import * as path from 'node:path';

// Load environment variables
dotenv.config({ path: '.env.local' });

const databaseUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('Database URL not found in environment');
  process.exit(1);
}

async function runMigration() {
  const sql = postgres(databaseUrl!);

  try {
    console.log('Checking Stream table schema...');

    // Check if status column exists
    const columns = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'Stream'
    `;

    const columnNames = columns.map((c: any) => c.column_name);
    console.log('Current Stream columns:', columnNames);

    // Check if migration is needed
    const hasStatus = columnNames.includes('status');
    const hasLastActiveAt = columnNames.includes('lastActiveAt');
    const hasMetadata = columnNames.includes('metadata');

    if (hasStatus && hasLastActiveAt && hasMetadata) {
      console.log('✅ Stream table already has all required columns');
      await sql.end();
      return;
    }

    console.log('Running stream state tracking migration...');

    // Read and execute the migration SQL
    const migrationPath = path.join(
      __dirname,
      '..',
      'drizzle',
      'add-stream-state-tracking.sql',
    );
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');

    // Execute the migration
    await sql.unsafe(migrationSql);

    console.log('✅ Stream state tracking migration completed!');

    // Verify the columns were added
    const updatedColumns = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'Stream'
    `;

    console.log(
      'Updated Stream columns:',
      updatedColumns.map((c: any) => c.column_name),
    );
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

runMigration()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
