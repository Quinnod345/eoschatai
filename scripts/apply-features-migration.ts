import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.error('No database connection string found');
  process.exit(1);
}

const sql = postgres(connectionString, { max: 1 });
const db = drizzle(sql);

async function applyMigration() {
  try {
    console.log('Applying features migration...');
    
    const migrationSql = readFileSync(
      join(__dirname, '../lib/db/migrations/add_features_last_seen.sql'),
      'utf8'
    );
    
    await sql.unsafe(migrationSql);
    
    console.log('Migration applied successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

applyMigration();