import { config } from 'dotenv';
import postgres from 'postgres';

// Load .env.local
config({ path: '.env.local' });

async function main() {
  const connectionString = process.env.POSTGRES_URL;
  
  if (!connectionString) {
    console.error('POSTGRES_URL not set');
    process.exit(1);
  }

  console.log('Connecting to database...');
  const sql = postgres(connectionString);

  try {
    console.log('Adding stoppedAt column to Message_v2 table...');
    await sql.unsafe(`ALTER TABLE "Message_v2" ADD COLUMN IF NOT EXISTS "stoppedAt" TIMESTAMP;`);
    console.log('Column added successfully!');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
