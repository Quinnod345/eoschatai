#!/usr/bin/env tsx

import path from 'node:path';
import dotenv from 'dotenv';
import { Pool } from 'pg';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function createUserDocumentsTable() {
  // Get the database URL
  const databaseUrl = process.env.POSTGRES_URL;

  if (!databaseUrl) {
    throw new Error('POSTGRES_URL environment variable is missing');
  }

  console.log('Connecting to database...');
  const client = new Pool({
    connectionString: databaseUrl,
    ssl: true,
  });

  try {
    // Connect to the database
    const connection = await client.connect();
    console.log('Connected to database');

    // Create the table
    const createTableSQL = `
    CREATE TABLE IF NOT EXISTS "UserDocuments" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "userId" uuid NOT NULL,
      "fileName" varchar(255) NOT NULL,
      "fileUrl" text NOT NULL,
      "fileSize" integer NOT NULL,
      "fileType" varchar(255) NOT NULL,
      "category" varchar(255) NOT NULL,
      "content" text NOT NULL,
      "createdAt" timestamp DEFAULT now() NOT NULL,
      "updatedAt" timestamp DEFAULT now() NOT NULL
    );
    `;

    console.log('Creating UserDocuments table...');
    await connection.query(createTableSQL);
    console.log('UserDocuments table created successfully');

    // Add foreign key constraint, but don't fail if it doesn't work
    try {
      console.log('Attempting to add foreign key constraint...');
      await connection.query(`
        ALTER TABLE "UserDocuments"
        ADD CONSTRAINT "UserDocuments_userId_fkey"
        FOREIGN KEY ("userId")
        REFERENCES "User"("id")
        ON DELETE CASCADE;
      `);
      console.log('Foreign key constraint added successfully');
    } catch (constraintError) {
      console.warn(
        'Could not add foreign key constraint, continuing without it:',
        constraintError.message,
      );
    }

    // Release the client connection
    connection.release();
  } catch (error) {
    console.error('Error creating UserDocuments table:', error);
    throw error;
  } finally {
    // End the pool
    await client.end();
  }
}

// Run the main function
createUserDocumentsTable()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
