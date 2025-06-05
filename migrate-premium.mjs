import pkg from 'pg';
const { Client } = pkg;

const client = new Client({
  connectionString:
    'postgres://neondb_owner:npg_1mnZkhgB3xMS@ep-muddy-band-a4ev5ay6-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require',
});

async function run() {
  try {
    await client.connect();
    console.log('Connected to database');

    // Add isPremium column if it doesn't exist
    const res = await client.query(`
      ALTER TABLE "UserSettings" 
      ADD COLUMN IF NOT EXISTS "isPremium" boolean DEFAULT false;
    `);

    console.log('Migration completed successfully');
  } catch (err) {
    console.error('Error running migration:', err);
  } finally {
    await client.end();
    console.log('Disconnected from database');
  }
}

run();
