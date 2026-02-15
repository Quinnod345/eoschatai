#!/usr/bin/env tsx

import { config } from 'dotenv';
import path from 'node:path';
import postgres from 'postgres';

// Load environment variables
config({ path: path.resolve(process.cwd(), '.env.local') });

async function testDatabaseConnection() {
  console.log('🔍 Testing database connection...');

  // Debug environment variables
  console.log('Environment variables:');
  console.log(`DATABASE_URL: ${process.env.DATABASE_URL ? 'Set' : 'Missing'}`);
  console.log(`POSTGRES_URL: ${process.env.POSTGRES_URL ? 'Set' : 'Missing'}`);

  // Get the database URL
  const getDatabaseUrl = () => {
    const postgresUrl = process.env.POSTGRES_URL;
    const databaseUrl = process.env.DATABASE_URL;

    console.log(
      `POSTGRES_URL preview: ${postgresUrl ? `${postgresUrl.substring(0, 50)}...` : 'None'}`,
    );
    console.log(
      `DATABASE_URL preview: ${databaseUrl ? `${databaseUrl.substring(0, 50)}...` : 'None'}`,
    );

    // Return the first available URL
    const url = postgresUrl || databaseUrl;

    if (!url) {
      throw new Error(
        'Neither POSTGRES_URL nor DATABASE_URL environment variable is defined',
      );
    }

    return url;
  };

  try {
    const connectionString = getDatabaseUrl();
    console.log(
      `Using connection string: ${connectionString.substring(0, 50)}...`,
    );

    // Test connection with SSL
    console.log('Creating postgres client with SSL...');
    const client = postgres(connectionString, {
      ssl: true,
      max: 1, // Limit connections for testing
      debug: true, // Enable debug logging
    });

    console.log('Testing query...');
    const result = await client`SELECT 1 as test`;
    console.log('✅ Database connection successful!', result);

    await client.end();
    console.log('✅ Connection closed successfully');
  } catch (error) {
    console.error('❌ Database connection failed:', error);

    // Try without SSL
    try {
      console.log('Trying connection without SSL...');
      const connectionString = getDatabaseUrl();
      const clientNoSSL = postgres(connectionString, {
        ssl: false,
        max: 1,
      });

      const result = await clientNoSSL`SELECT 1 as test`;
      console.log('✅ Database connection successful (no SSL)!', result);

      await clientNoSSL.end();
    } catch (noSSLError) {
      console.error(
        '❌ Database connection failed even without SSL:',
        noSSLError,
      );
    }
  }
}

testDatabaseConnection().catch(console.error);
