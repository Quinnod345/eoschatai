
import postgres from 'postgres';
import { config } from 'dotenv';
import { join } from 'node:path';

config({ path: join(__dirname, '..', '.env.local') }); // Load environment variables

async function addFeaturesColumn() {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  
  if (!connectionString) {
    console.error('No database connection string found');
    process.exit(1);
  }

  const sql = postgres(connectionString, { max: 1 });

  try {
    console.log('Adding lastFeaturesVersion column to User table...');
    
    await sql`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastFeaturesVersion" timestamp`;
    
    console.log('✅ Column added successfully!');
  } catch (error: any) {
    if (error.message.includes('already exists')) {
      console.log('✅ Column already exists');
    } else {
      console.error('❌ Failed to add column:', error.message);
      process.exit(1);
    }
  } finally {
    await sql.end();
  }
}

addFeaturesColumn();