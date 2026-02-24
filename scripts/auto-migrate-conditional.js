#!/usr/bin/env node

const { execSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

// Check for environment flag to skip migrations
if (process.env.SKIP_AUTO_MIGRATE === 'true') {
  console.log('🔄 Skipping auto-migration (SKIP_AUTO_MIGRATE=true)');
  process.exit(0);
}

// Check if this is a production build
const isProduction = process.env.NODE_ENV === 'production';
const isVercelBuild = process.env.VERCEL === '1';

// Only run migrations if explicitly requested via environment variable
const shouldRunMigrations = process.env.RUN_AUTO_MIGRATE === 'true';

if (!shouldRunMigrations && (isProduction || isVercelBuild)) {
  console.log('🔄 Skipping auto-migration in production environment');
  console.log('   Set RUN_AUTO_MIGRATE=true to force migrations');
  process.exit(0);
}

// Check if there are pending migrations
function hasPendingMigrations() {
  try {
    const drizzleDir = path.join(__dirname, '..', 'drizzle');
    if (!fs.existsSync(drizzleDir)) {
      return false;
    }

    const files = fs.readdirSync(drizzleDir);
    const sqlFiles = files.filter((f) => f.endsWith('.sql'));

    // Simple check - if there are any .sql files, assume there might be pending migrations
    return sqlFiles.length > 0;
  } catch (error) {
    console.log('Could not check for pending migrations:', error.message);
    return false;
  }
}

// Only run if we have pending migrations and it's explicitly requested
if (!shouldRunMigrations && !hasPendingMigrations()) {
  console.log('🔄 No pending migrations detected, skipping auto-migration');
  process.exit(0);
}

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
