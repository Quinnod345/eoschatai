#!/usr/bin/env node

const { execSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

console.log('Running migration to add missing columns...');

// Get the path to the migration file
const migrationFilePath = path.join(
  __dirname,
  '../lib/db/migrations/add_message_count_column.sql',
);

// Check if the file exists
if (!fs.existsSync(migrationFilePath)) {
  console.error('Migration file not found:', migrationFilePath);
  process.exit(1);
}

try {
  // Use the DATABASE_URL from environment or use the default
  const databaseUrl =
    process.env.DATABASE_URL ||
    'postgres://postgres:postgres@localhost:5432/vercelai';

  // Run the SQL file against the database
  const command = `psql "${databaseUrl}" -f "${migrationFilePath}"`;

  console.log('Executing migration...');
  const output = execSync(command, { encoding: 'utf8' });

  console.log('Migration completed successfully!');
  console.log(output);

  console.log('Migration to add missing columns completed.');
} catch (error) {
  console.error('Migration failed:', error.message);
  console.error('Command output:', error.stdout);
  console.error('Command error:', error.stderr);
  process.exit(1);
}
