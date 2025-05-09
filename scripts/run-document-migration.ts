#!/usr/bin/env tsx

import path from 'node:path';
import dotenv from 'dotenv';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function migrateUserDocuments(db: any) {
  console.log('Running UserDocuments migration...');

  try {
    // Check if the table already exists
    const tableExists = await db.execute(
      sql`SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'UserDocuments'
      )`,
    );

    if (tableExists.rows?.[0]?.exists) {
      console.log('UserDocuments table already exists, skipping migration');
      return;
    }

    // Create the UserDocuments table
    await db.execute(
      sql`CREATE TABLE IF NOT EXISTS "UserDocuments" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "userId" uuid NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
        "fileName" varchar(255) NOT NULL,
        "fileUrl" text NOT NULL,
        "fileSize" integer NOT NULL,
        "fileType" varchar(255) NOT NULL,
        "category" varchar NOT NULL CHECK ("category" IN ('Scorecard', 'VTO', 'Rocks', 'A/C', 'Core Process')),
        "content" text NOT NULL,
        "createdAt" timestamp DEFAULT now() NOT NULL,
        "updatedAt" timestamp DEFAULT now() NOT NULL
      )`,
    );

    console.log('Successfully created UserDocuments table');
  } catch (error) {
    console.error('Error migrating UserDocuments table:', error);
    throw error;
  }
}

async function main() {
  try {
    // Direct usage of POSTGRES_URL from environment variable
    const connectionString = process.env.POSTGRES_URL;

    if (!connectionString) {
      throw new Error('POSTGRES_URL environment variable is missing');
    }

    // Log the connection URL with credentials masked for security
    const maskedUrl = connectionString.replace(/:[^:@]+@/, ':***@');
    console.log('Connecting to PostgreSQL at:', maskedUrl);

    // Initialize postgres connection with custom options for better reliability
    const connection = postgres(connectionString, {
      max: 1,
      ssl: true, // Enable SSL for Neon.tech connection
      connect_timeout: 10, // Increase connection timeout for cloud DB
    });

    // Initialize drizzle with the postgres connection
    const db = drizzle(connection);

    // Run the UserDocuments migration with the db connection
    await migrateUserDocuments(db);
    console.log('✅ UserDocuments migration completed successfully');

    // Close the connection when done
    await connection.end();
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }

  process.exit(0);
}

main();
