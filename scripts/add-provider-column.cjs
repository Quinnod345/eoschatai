const postgres = require('postgres');
const dotenv = require('dotenv');
const fs = require('node:fs');

// Load env vars
dotenv.config({ path: '.env.local' });

const databaseUrl = process.env.POSTGRES_URL;

if (!databaseUrl) {
  console.error('POSTGRES_URL environment variable is not set');
  process.exit(1);
}

const sql = postgres(databaseUrl);

async function run() {
  try {
    console.log('Adding provider column to Message_v2 table...');

    // Add provider column if it doesn't exist
    await sql`
      ALTER TABLE "Message_v2" 
      ADD COLUMN IF NOT EXISTS "provider" varchar;
    `;

    console.log('Provider column added successfully!');
  } catch (error) {
    console.error('Error adding provider column:', error);
  } finally {
    await sql.end();
  }
}

run();
