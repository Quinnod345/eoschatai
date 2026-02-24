#!/usr/bin/env node

const { execSync } = require('node:child_process');
const path = require('node:path');

console.log('🚀 Auto-migration system starting...\n');

try {
  // First, try to run drizzle-kit push with --force flag
  console.log('1️⃣  Running drizzle-kit push...');
  try {
    execSync('npx drizzle-kit push --force', {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..'),
    });
    console.log('✅ Drizzle-kit push completed successfully\n');
  } catch (error) {
    console.log(
      '⚠️  Drizzle-kit push encountered issues, continuing with SQL migrations...\n',
    );
  }

  // Then run any SQL migrations that couldn't be applied via drizzle-kit
  console.log('2️⃣  Running SQL migrations...');
  const migrationRunner = require('./run-migrations.js');
  const runner = new migrationRunner();

  runner
    .run()
    .then(() => {
      console.log('\n✅ All migrations completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Migration failed:', error);
      process.exit(1);
    });
} catch (error) {
  console.error('❌ Auto-migration failed:', error);
  process.exit(1);
}

