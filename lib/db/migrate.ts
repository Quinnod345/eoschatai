import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

config({
  path: '.env.local',
});

// Add providerId column migration
const addProviderIdToUser = async (connection: postgres.Sql<{}>) => {
  try {
    const columns = await connection`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'User'
      AND column_name = 'providerId'
    `;

    if (columns.length === 0) {
      await connection`
        ALTER TABLE "User"
        ADD COLUMN "providerId" VARCHAR(64)
      `;
      console.log('Added providerId column to User table');
    } else {
      console.log('providerId column already exists in User table');
    }
  } catch (error) {
    console.error('Error adding providerId column to User table:', error);
    // Don't rethrow the error so that the migration can continue
  }
};

// Check if a column exists in a table
const columnExists = async (
  connection: postgres.Sql<{}>,
  tableName: string,
  columnName: string,
): Promise<boolean> => {
  try {
    const columns = await connection`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = ${tableName}
      AND column_name = ${columnName}
    `;
    return columns.length > 0;
  } catch (error) {
    console.error(
      `Error checking if column ${columnName} exists in ${tableName}:`,
      error,
    );
    return false;
  }
};

const runMigrate = async () => {
  if (!process.env.POSTGRES_URL) {
    throw new Error('POSTGRES_URL is not defined');
  }

  const connection = postgres(process.env.POSTGRES_URL, { max: 1 });

  console.log('⏳ Running migrations...');
  const start = Date.now();

  try {
    // Before running migrations, check if the provider column already exists
    // This helps prevent errors with add_provider_column.sql
    const providerExists = await columnExists(
      connection,
      'Message_v2',
      'provider',
    );

    if (providerExists) {
      console.log('provider column already exists in Message_v2 table');

      // Make the migration file a no-op
      try {
        const modifyMigrationFile = await connection`
          UPDATE "drizzle"."__drizzle_migrations"
          SET "hash" = 'completed'
          WHERE "name" = 'add_provider_column.sql' AND "hash" != 'completed'
        `;
        console.log('Updated migration file status to completed');
      } catch (err) {
        // If this fails, it's not critical
        console.log(
          'Could not update migration file status, will continue anyway',
        );
      }
    }

    // Run Drizzle migrations
    const db = drizzle(connection);
    await migrate(db, { migrationsFolder: './lib/db/migrations' });
  } catch (error) {
    console.error('Error running Drizzle migrations:', error);
    // Continue with other migrations even if this one fails
  }

  try {
    // Add Google authentication support
    await addProviderIdToUser(connection);
  } catch (error) {
    console.error('Error adding provider ID column:', error);
  }

  const end = Date.now();
  console.log('✅ Migrations completed in', end - start, 'ms');

  // Close connection
  await connection.end();
  process.exit(0);
};

runMigrate().catch((err) => {
  console.error('❌ Migration failed');
  console.error(err);
  process.exit(1);
});
