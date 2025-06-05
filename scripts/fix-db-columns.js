#!/usr/bin/env node

const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
const dotenv = require('dotenv');
const path = require('node:path');

// Load environment variables from .env.local file
dotenv.config({ path: '.env.local' });

async function main() {
  console.log('Starting database column fix...');

  const DATABASE_URL = process.env.DATABASE_URL;

  if (!DATABASE_URL) {
    console.error('DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  console.log('Connecting to database...');

  // Initialize the Postgres client
  const client = postgres(DATABASE_URL);

  try {
    console.log('Checking if columns exist...');

    // Check if the column already exists
    const checkColumn = await client`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'UserSettings' 
      AND column_name = 'dailyMessageCount'
    `;

    if (checkColumn.length === 0) {
      console.log('Adding missing dailyMessageCount column...');

      // Add the column if it doesn't exist
      await client`
        ALTER TABLE "UserSettings" 
        ADD COLUMN "dailyMessageCount" INTEGER DEFAULT 0
      `;

      console.log('dailyMessageCount column added successfully');
    } else {
      console.log('dailyMessageCount column already exists');
    }

    // Check if the lastMessageCountReset column exists
    const checkResetColumn = await client`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'UserSettings' 
      AND column_name = 'lastMessageCountReset'
    `;

    if (checkResetColumn.length === 0) {
      console.log('Adding missing lastMessageCountReset column...');

      // Add the column if it doesn't exist
      await client`
        ALTER TABLE "UserSettings" 
        ADD COLUMN "lastMessageCountReset" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      `;

      console.log('lastMessageCountReset column added successfully');
    } else {
      console.log('lastMessageCountReset column already exists');
    }

    console.log('Database fix completed successfully!');
  } catch (error) {
    console.error('Error fixing database:', error);
    process.exit(1);
  } finally {
    // Close the database connection
    await client.end();
  }
}

main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
