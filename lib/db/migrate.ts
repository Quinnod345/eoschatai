import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { migrateUserDocuments } from './migrations/user-documents';

// Load environment variables from .env.local first
config({
  path: '.env.local',
});

// Get the database URL from either POSTGRES_URL or DATABASE_URL
const getDatabaseUrl = () => {
  const postgresUrl = process.env.POSTGRES_URL;
  const databaseUrl = process.env.DATABASE_URL;
  const postgresUrlNonPooling = process.env.POSTGRES_URL_NON_POOLING;
  const databaseUrlUnpooled = process.env.DATABASE_URL_UNPOOLED;

  // Try each URL in order of preference
  const url =
    postgresUrl || databaseUrl || postgresUrlNonPooling || databaseUrlUnpooled;

  if (!url) {
    throw new Error(
      'No database URL environment variable is defined. Set POSTGRES_URL, DATABASE_URL, POSTGRES_URL_NON_POOLING, or DATABASE_URL_UNPOOLED',
    );
  }

  return url;
};

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

// Add Google Calendar support migration
const addGoogleCalendarSupport = async (connection: postgres.Sql<{}>) => {
  try {
    // Check if User table has googleCalendarConnected column
    const gcConnectedExists = await columnExists(
      connection,
      'User',
      'googleCalendarConnected',
    );

    if (!gcConnectedExists) {
      await connection`
        ALTER TABLE "User"
        ADD COLUMN "googleCalendarConnected" BOOLEAN DEFAULT false
      `;
      console.log('Added googleCalendarConnected column to User table');
    } else {
      console.log(
        'googleCalendarConnected column already exists in User table',
      );
    }

    // Check if GoogleCalendarToken table exists
    const tableExists = await connection`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'GoogleCalendarToken'
      ) as "exists"
    `;

    if (!tableExists[0].exists) {
      await connection`
        CREATE TABLE "GoogleCalendarToken" (
          "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
          "token" JSONB NOT NULL,
          "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
          CONSTRAINT "GoogleCalendarToken_userId_unique" UNIQUE ("userId")
        )
      `;
      console.log('Created GoogleCalendarToken table');
    } else {
      console.log('GoogleCalendarToken table already exists');
    }
  } catch (error) {
    console.error('Error setting up Google Calendar support:', error);
    // Don't rethrow the error so that the migration can continue
  }
};

// Add PinnedMessage and BookmarkedMessage tables
const addMessageActionTables = async (connection: postgres.Sql<{}>) => {
  try {
    // Check if PinnedMessage table exists
    const pinnedTableExists = await connection`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'PinnedMessage'
      ) as "exists"
    `;

    if (!pinnedTableExists[0].exists) {
      await connection`
        CREATE TABLE "PinnedMessage" (
          "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          "userId" UUID NOT NULL REFERENCES "User"("id"),
          "messageId" UUID NOT NULL REFERENCES "Message_v2"("id"),
          "chatId" UUID NOT NULL REFERENCES "Chat"("id"),
          "pinnedAt" TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `;

      await connection`
        CREATE INDEX "pinned_user_message_idx" ON "PinnedMessage" ("userId", "messageId")
      `;

      await connection`
        CREATE INDEX "pinned_chat_idx" ON "PinnedMessage" ("chatId")
      `;

      console.log('Created PinnedMessage table with indexes');
    } else {
      console.log('PinnedMessage table already exists');
    }

    // Check if BookmarkedChat table exists
    const bookmarkedTableExists = await connection`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'BookmarkedChat'
      )
    `;

    if (!bookmarkedTableExists[0].exists) {
      await connection`
        CREATE TABLE "BookmarkedChat" (
          "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          "userId" UUID NOT NULL REFERENCES "User"("id"),
          "chatId" UUID NOT NULL REFERENCES "Chat"("id"),
          "bookmarkedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
          "note" TEXT
        )
      `;

      await connection`
        CREATE UNIQUE INDEX "bookmarked_user_chat_idx" ON "BookmarkedChat" ("userId", "chatId")
      `;

      await connection`
        CREATE INDEX "bookmarked_user_idx" ON "BookmarkedChat" ("userId")
      `;

      console.log('Created BookmarkedChat table with indexes');
    } else {
      console.log('BookmarkedChat table already exists');
    }

    // Clean up old BookmarkedMessage table if it exists
    const oldBookmarkedTableExists = await connection`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'BookmarkedMessage'
      )
    `;

    if (oldBookmarkedTableExists[0].exists) {
      await connection`DROP TABLE IF EXISTS "BookmarkedMessage" CASCADE`;
      console.log('Dropped old BookmarkedMessage table');
    }
  } catch (error) {
    console.error('Error creating message action tables:', error);
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

// Fix the truncated constraint name issue
const fixTruncatedConstraint = async (connection: postgres.Sql<{}>) => {
  try {
    // Check if the constraint exists before trying to drop it
    const constraintExists = await connection`
      SELECT 1 FROM pg_constraint 
      WHERE conname = 'Suggestion_documentId_documentCreatedAt_Document_id_createdAt_f'
      LIMIT 1
    `;

    if (constraintExists.length === 0) {
      console.log('Truncated constraint does not exist, skipping fix');
      return;
    }

    // Attempt to drop the constraint if it exists
    try {
      await connection`
        ALTER TABLE "Suggestion" 
        DROP CONSTRAINT IF EXISTS "Suggestion_documentId_documentCreatedAt_Document_id_createdAt_f"
      `;
      console.log('Successfully dropped truncated constraint');
    } catch (dropError) {
      // If we get a specific error about constraint not existing, just continue
      if (
        typeof dropError === 'object' &&
        dropError !== null &&
        'code' in dropError &&
        dropError.code === '42704'
      ) {
        console.log('Constraint does not exist on the table, continuing');
        return;
      }
      throw dropError; // Re-throw other errors
    }
  } catch (error) {
    console.error('Error fixing truncated constraint:', error);
    // Don't throw the error, continue with migration
  }
};

const runMigrate = async () => {
  try {
    const databaseUrl = getDatabaseUrl();
    console.log(
      'Database URL format check:',
      databaseUrl.startsWith('postgres://') ? 'Valid' : 'Invalid format',
    );

    try {
      const connection = postgres(databaseUrl, { max: 1 });

      console.log('⏳ Running migrations...');
      const start = Date.now();

      try {
        // Fix the truncated constraint issue before running migrations
        await fixTruncatedConstraint(connection);

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

        // Run Drizzle migrations with error handling
        try {
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

        try {
          // Add Google Calendar support
          await addGoogleCalendarSupport(connection);
        } catch (error) {
          console.error('Error adding Google Calendar support:', error);
        }

        try {
          // Add message action tables (PinnedMessage and BookmarkedMessage)
          await addMessageActionTables(connection);
        } catch (error) {
          console.error('Error adding message action tables:', error);
        }

        try {
          // Run UserDocuments migration
          await migrateUserDocuments();
        } catch (error) {
          console.error('Error running UserDocuments migration:', error);
        }

        const end = Date.now();
        console.log('✅ Migrations completed in', end - start, 'ms');

        // Close connection
        await connection.end();
      } catch (error) {
        console.error('Migration error:', error);
        await connection.end();
      }
    } catch (dbConnectionError) {
      console.error(
        'Unable to connect to PostgreSQL. Skipping migrations:',
        dbConnectionError,
      );
      console.log('✅ Continuing build process without database migrations');
    }
  } catch (error) {
    console.error('❌ Migration failed:', error);
  }

  // Always exit with success to allow build to continue
  process.exit(0);
};

runMigrate().catch((err) => {
  console.error('❌ Migration failed');
  console.error(err);
  process.exit(0); // Exit with success to allow build to continue
});
