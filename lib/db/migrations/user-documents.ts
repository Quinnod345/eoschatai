import { sql } from 'drizzle-orm';
import { pgTable, uuid, varchar, text, integer, timestamp } from 'drizzle-orm/pg-core';
import { db } from '@/lib/db';
import path from 'node:path';
import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

export async function migrateUserDocuments() {
  console.log('Running UserDocuments migration...');
  console.log('Using PostgreSQL URL:', process.env.POSTGRES_URL ? 'URL is defined' : 'URL is undefined');

  try {
    // Check if the table already exists
    const tableExists = await db.execute(
      sql`SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'UserDocuments'
      )`
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
      )`
    );

    console.log('Successfully created UserDocuments table');
  } catch (error) {
    console.error('Error migrating UserDocuments table:', error);
    throw error;
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
      process.exit(1);
    });
} 