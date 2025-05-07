const { execSync } = require('node:child_process');
const { createClient } = require('@vercel/postgres');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

async function main() {
  console.log('Running pgvector migration...');

  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  try {
    // Create postgres client
    const client = createClient();
    await client.connect();

    // Read migration SQL
    const migrationSQL = readFileSync(
      join(__dirname, '../lib/db/migrations/pgvector.sql'),
      'utf-8',
    );

    // Run migration query
    await client.query(migrationSQL);

    console.log('Successfully installed pgvector extension');

    // Run drizzle migration to create embeddings table
    console.log('Running drizzle migration...');
    execSync('npx drizzle-kit push:pg', { stdio: 'inherit' });

    console.log('Migration completed successfully');
    await client.end();
  } catch (error) {
    console.error('Error running migration:', error);
    process.exit(1);
  }
}

main();
