#!/usr/bin/env tsx

import path from 'node:path';
import dotenv from 'dotenv';
import { Pool } from 'pg';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function alterUserDocumentsFileType() {
  console.log('Altering UserDocuments.fileType field...');

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

    // Check if the table exists
    const tableExistsResult = await connection.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public'
      AND table_name = 'UserDocuments'
    `);

    if (!tableExistsResult.rows || tableExistsResult.rows.length === 0) {
      console.log('UserDocuments table does not exist, no need to alter');
      return;
    }

    // Get the current column type
    const columnInfoResult = await connection.query(`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'UserDocuments'
      AND column_name = 'fileType'
    `);

    if (columnInfoResult.rows.length > 0) {
      const column = columnInfoResult.rows[0];
      console.log(
        `Current fileType column: ${column.data_type}(${column.character_maximum_length})`,
      );
    }

    // Alter the fileType column to increase its length
    console.log('Altering fileType column to VARCHAR(255)...');
    await connection.query(`
      ALTER TABLE "UserDocuments" 
      ALTER COLUMN "fileType" TYPE varchar(255)
    `);

    console.log('Successfully altered UserDocuments.fileType to varchar(255)');

    // Verify the change
    const verifyResult = await connection.query(`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'UserDocuments'
      AND column_name = 'fileType'
    `);

    if (verifyResult.rows.length > 0) {
      const column = verifyResult.rows[0];
      console.log(
        `New fileType column: ${column.data_type}(${column.character_maximum_length})`,
      );
    }

    // Release the client connection
    connection.release();
  } catch (error) {
    console.error('Error altering UserDocuments table:', error);
    throw error;
  } finally {
    // End the pool
    await client.end();
  }
}

// Run the main function
alterUserDocumentsFileType()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
