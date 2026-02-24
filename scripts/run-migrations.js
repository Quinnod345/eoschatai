const { Client } = require('pg');
const dotenv = require('dotenv');
const fs = require('node:fs');
const path = require('node:path');

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const databaseUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error(
    'Neither POSTGRES_URL nor DATABASE_URL environment variable is defined',
  );
  process.exit(1);
}

// Migration tracking table
const MIGRATION_TABLE = 'migrations';

class MigrationRunner {
  constructor() {
    this.client = new Client({
      connectionString: databaseUrl,
    });
  }

  async connect() {
    await this.client.connect();
    console.log('🔗 Connected to database');
  }

  async disconnect() {
    await this.client.end();
  }

  async ensureMigrationTable() {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS ${MIGRATION_TABLE} (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await this.client.query(createTableQuery);
    console.log('✅ Migration tracking table ready');
  }

  async getAppliedMigrations() {
    const result = await this.client.query(
      `SELECT filename FROM ${MIGRATION_TABLE} ORDER BY filename`,
    );
    return result.rows.map((row) => row.filename);
  }

  async getMigrationFiles() {
    const drizzleDir = path.join(__dirname, '..', 'drizzle');
    const files = fs.readdirSync(drizzleDir);

    // Filter for SQL files, excluding schema and relations files
    const sqlFiles = files
      .filter((file) => {
        return (
          file.endsWith('.sql') &&
          !file.includes('schema.ts') &&
          !file.includes('relations.ts') &&
          !file.includes('meta')
        );
      })
      .sort();

    return sqlFiles;
  }

  async applyMigration(filename) {
    const filePath = path.join(__dirname, '..', 'drizzle', filename);
    const sql = fs.readFileSync(filePath, 'utf8');

    console.log(`\n📄 Applying migration: ${filename}`);

    try {
      // Start transaction
      await this.client.query('BEGIN');

      // Apply the migration
      await this.client.query(sql);

      // Record the migration
      await this.client.query(
        `INSERT INTO ${MIGRATION_TABLE} (filename) VALUES ($1)`,
        [filename],
      );

      // Commit transaction
      await this.client.query('COMMIT');

      console.log(`✅ Successfully applied: ${filename}`);
      return true;
    } catch (error) {
      // Rollback on error
      await this.client.query('ROLLBACK');
      console.error(`❌ Failed to apply ${filename}:`, error.message);

      // Some migrations might fail if they've been partially applied
      // Check if it's a "already exists" error and mark as applied
      if (error.message.includes('already exists')) {
        console.log(`⚠️  Marking as applied (already exists): ${filename}`);
        await this.client.query(
          `INSERT INTO ${MIGRATION_TABLE} (filename) VALUES ($1) ON CONFLICT DO NOTHING`,
          [filename],
        );
      }

      return false;
    }
  }

  async run() {
    try {
      await this.connect();
      await this.ensureMigrationTable();

      const appliedMigrations = await this.getAppliedMigrations();
      const allMigrations = await this.getMigrationFiles();

      const pendingMigrations = allMigrations.filter(
        (file) => !appliedMigrations.includes(file),
      );

      if (pendingMigrations.length === 0) {
        console.log('\n✨ All migrations are up to date!');
        return;
      }

      console.log(
        `\n🔄 Found ${pendingMigrations.length} pending migration(s)`,
      );

      let successCount = 0;
      let failCount = 0;

      for (const migration of pendingMigrations) {
        const success = await this.applyMigration(migration);
        if (success) {
          successCount++;
        } else {
          failCount++;
        }
      }

      console.log('\n📊 Migration Summary:');
      console.log(`   ✅ Successful: ${successCount}`);
      console.log(`   ❌ Failed: ${failCount}`);
      console.log(`   📁 Total: ${allMigrations.length}`);
    } catch (error) {
      console.error('Migration runner error:', error);
      process.exit(1);
    } finally {
      await this.disconnect();
    }
  }
}

// Run migrations if called directly
if (require.main === module) {
  const runner = new MigrationRunner();
  runner.run().catch(console.error);
}

module.exports = MigrationRunner;

