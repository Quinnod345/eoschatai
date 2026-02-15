#!/usr/bin/env tsx

import path from 'node:path';
import dotenv from 'dotenv';
import { Pool } from 'pg';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function listAllTables() {
  console.log('Listing all tables in the database...');

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

    // First list all schemas
    const schemasResult = await connection.query(`
      SELECT schema_name 
      FROM information_schema.schemata 
      ORDER BY schema_name
    `);

    console.log('\nDatabase schemas:');
    schemasResult.rows.forEach((row) => {
      console.log(`- ${row.schema_name}`);
    });

    // List tables in all schemas
    const tablesResult = await connection.query(`
      SELECT table_schema, table_name 
      FROM information_schema.tables 
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
      ORDER BY table_schema, table_name
    `);

    if (!tablesResult.rows || tablesResult.rows.length === 0) {
      console.log('\nNo user tables found in any schema.');
      return;
    }

    console.log('\nFound tables by schema:');
    let currentSchema = '';

    tablesResult.rows.forEach((row) => {
      if (currentSchema !== row.table_schema) {
        currentSchema = row.table_schema;
        console.log(`\nSchema: ${currentSchema}`);
      }
      console.log(`  - ${row.table_name}`);
    });

    // Look for any table similar to UserDocuments
    const userDocsResult = await connection.query(`
      SELECT table_schema, table_name 
      FROM information_schema.tables 
      WHERE table_name ILIKE '%document%'
      ORDER BY table_schema, table_name
    `);

    if (userDocsResult.rows && userDocsResult.rows.length > 0) {
      console.log('\nDocument-related tables:');
      userDocsResult.rows.forEach((row) => {
        console.log(`- ${row.table_schema}.${row.table_name}`);
      });
    }

    // Check table columns for a specific table if found
    const userDocumentsTable = userDocsResult.rows.find(
      (row) => row.table_name.toLowerCase() === 'userdocuments',
    );

    if (userDocumentsTable) {
      console.log(
        `\nChecking columns for ${userDocumentsTable.table_schema}.${userDocumentsTable.table_name}...`,
      );

      const columnsResult = await connection.query(
        `
        SELECT column_name, data_type, character_maximum_length
        FROM information_schema.columns
        WHERE table_schema = $1
        AND table_name = $2
        ORDER BY ordinal_position
      `,
        [userDocumentsTable.table_schema, userDocumentsTable.table_name],
      );

      columnsResult.rows.forEach((col) => {
        console.log(
          `  - ${col.column_name}: ${col.data_type}${col.character_maximum_length ? `(${col.character_maximum_length})` : ''}`,
        );
      });
    }

    // Release the client connection
    connection.release();
  } catch (error) {
    console.error('Error listing tables:', error);
    throw error;
  } finally {
    // End the pool
    await client.end();
  }
}

// Run the main function
listAllTables()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
