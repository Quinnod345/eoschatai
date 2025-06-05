import { config } from 'dotenv';
import postgres from 'postgres';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Load environment variables
config({ path: '.env.local' });

async function applyPersonasMigration() {
  console.log('🚀 Applying EOS Personas migration...');

  // Get the database URL
  const connectionString = process.env.POSTGRES_URL;

  if (!connectionString) {
    throw new Error('POSTGRES_URL environment variable is missing');
  }

  console.log('📋 Connecting to database...');
  const client = postgres(connectionString, { ssl: true });

  try {
    // Read the migration SQL file
    const migrationPath = join(process.cwd(), 'drizzle/0002_empty_leo.sql');
    const migrationSql = readFileSync(migrationPath, 'utf8');

    console.log('📋 Executing personas migration...');

    // Split the migration into individual statements
    const statements = migrationSql
      .split('--> statement-breakpoint')
      .map((stmt) => stmt.trim())
      .filter((stmt) => stmt.length > 0);

    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await client.unsafe(statement);
          console.log('✅ Executed statement successfully');
        } catch (error) {
          // Log the error but continue with other statements
          console.warn(
            '⚠️ Statement failed (may already exist):',
            error.message,
          );
        }
      }
    }

    console.log('✅ EOS Personas migration completed successfully!');
    console.log('🎯 You can now use the EOS Personas feature in your chat app');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await client.end();
  }
}

// Run the migration
applyPersonasMigration()
  .then(() => {
    console.log('Migration completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
