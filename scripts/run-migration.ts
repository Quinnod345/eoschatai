import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { config } from 'dotenv';
import { existsSync } from 'node:fs';

// Load environment variables from .env.local or .env
const envFile = existsSync('.env.local') ? '.env.local' : '.env';
config({ path: envFile });

console.log(`Loading environment from ${envFile}`);

async function main() {
  // Create a PostgreSQL client
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  const client = postgres(connectionString);

  try {
    console.log('Running migration to add profilePicture field...');

    // Read the migration SQL
    const migrationSql = readFileSync(
      join(process.cwd(), 'lib/db/migrations/add_profile_picture.sql'),
      'utf8',
    );

    // Execute the migration
    await client.unsafe(migrationSql);

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Error running migration:', error);
    process.exit(1);
  } finally {
    // Always close the client
    await client.end();
  }
}

main().catch(console.error);
