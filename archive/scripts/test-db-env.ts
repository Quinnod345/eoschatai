import * as dotenv from 'dotenv';
import path from 'node:path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

console.log('Environment Variables Check:');
console.log('----------------------------');
console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
console.log(
  'DATABASE_URL value:',
  `${process.env.DATABASE_URL?.substring(0, 50)}...`,
);
console.log('POSTGRES_URL exists:', !!process.env.POSTGRES_URL);
console.log(
  'POSTGRES_URL value:',
  `${process.env.POSTGRES_URL?.substring(0, 50)}...`,
);
console.log('\nOther DB vars:');
console.log('PGHOST:', process.env.PGHOST);
console.log('PGUSER:', process.env.PGUSER);
console.log('PGDATABASE:', process.env.PGDATABASE);
console.log('PGPORT:', process.env.PGPORT);

// Test direct connection
import postgres from 'postgres';

async function testConnection() {
  try {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      console.error('\nERROR: DATABASE_URL is not set!');
      return;
    }

    console.log(
      '\nAttempting connection with URL:',
      `${dbUrl.substring(0, 50)}...`,
    );

    // Create connection with explicit config
    const sql = postgres(dbUrl, {
      ssl: 'require',
      connection: {
        options: `project=${process.env.PGDATABASE || 'neondb'}`,
      },
    });

    // Test query
    const result = await sql`SELECT NOW() as current_time`;
    console.log('\n✅ Connection successful!');
    console.log('Server time:', result[0].current_time);

    await sql.end();
  } catch (error) {
    console.error('\n❌ Connection failed:', error);
  }
}

testConnection();
