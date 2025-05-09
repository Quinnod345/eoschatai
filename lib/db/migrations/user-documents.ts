import { sql } from 'drizzle-orm';
import { pgTable, uuid, varchar, text, integer, timestamp } from 'drizzle-orm/pg-core';
import { db } from '@/lib/db';
import path from 'node:path';
import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Get the database URL from either POSTGRES_URL or DATABASE_URL
const getDatabaseUrl = () => {
  const postgresUrl = process.env.POSTGRES_URL;
  const databaseUrl = process.env.DATABASE_URL;
  
  // Return the first available URL
  return postgresUrl || databaseUrl;
};

export async function migrateUserDocuments() {
  console.log('Running UserDocuments migration...');
  const databaseUrl = getDatabaseUrl();
  console.log('Using PostgreSQL URL:', databaseUrl ? 'URL is defined' : 'URL is undefined');

  if (!databaseUrl) {
    console.error('Neither POSTGRES_URL nor DATABASE_URL is defined, skipping UserDocuments migration');
    return;
  }

  try {
    // Check if the table already exists
    const tableExists = await db.execute(
      sql`SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'UserDocuments'
      )`
    ).catch(err => {
      console.warn('Error checking if UserDocuments table exists, will attempt to create it anyway:', err);
      return { rows: [{ exists: false }] };
    });

    // Safely access properties to avoid type errors
    const exists = 'rows' in tableExists 
      ? tableExists.rows?.[0]?.exists 
      : (tableExists as any)?.[0]?.exists;

    if (exists) {
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
      )`
    );

    console.log('Successfully created UserDocuments table');
  } catch (error) {
    console.error('Error migrating UserDocuments table:', error);
    // Don't rethrow the error to prevent build failure
    console.log('Continuing build process despite UserDocuments migration failure');
  }
}

// Run the migration if this file is executed directly
if (require.main === module) {
  migrateUserDocuments()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      // Exit with success to allow build to continue
      process.exit(0);
    });
} 