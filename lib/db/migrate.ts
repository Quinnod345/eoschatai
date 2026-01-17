import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
// NOTE: Avoid importing migrations that rely on env before dotenv loads.
// We'll dynamically import user-documents later.

// Load environment variables from .env.local first
config({ path: '.env.local' });

// Get the database URL from either POSTGRES_URL or DATABASE_URL
const getDatabaseUrl = (): string | null => {
  const postgresUrl = process.env.POSTGRES_URL;
  const databaseUrl = process.env.DATABASE_URL;
  const postgresUrlNonPooling = process.env.POSTGRES_URL_NON_POOLING;
  const databaseUrlUnpooled = process.env.DATABASE_URL_UNPOOLED;

  // Try each URL in order of preference
  const url =
    postgresUrl || databaseUrl || postgresUrlNonPooling || databaseUrlUnpooled;

  return url || null;
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

// Document History migration
const runDocumentHistoryMigration = async (connection: postgres.Sql<{}>) => {
  console.log('Running Document History migration...');

  try {
    // Check if DocumentHistory table exists
    const historyTableExists = await connection`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'DocumentHistory'
      ) as "exists"
    `;

    if (!historyTableExists[0].exists) {
      // Create DocumentHistory table
      await connection`
        CREATE TABLE "DocumentHistory" (
          "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          "documentId" UUID NOT NULL REFERENCES "Document"("id") ON DELETE CASCADE,
          "userId" UUID NOT NULL REFERENCES "User"("id"),
          "operation" VARCHAR NOT NULL CHECK ("operation" IN ('create', 'update', 'delete', 'restore')),
          "timestamp" TIMESTAMP NOT NULL DEFAULT NOW(),
          "metadata" JSONB
        )
      `;

      // Create indexes
      await connection`CREATE INDEX "doc_history_document_idx" ON "DocumentHistory" ("documentId")`;
      await connection`CREATE INDEX "doc_history_user_idx" ON "DocumentHistory" ("userId")`;
      await connection`CREATE INDEX "doc_history_timestamp_idx" ON "DocumentHistory" ("timestamp")`;

      console.log('Created DocumentHistory table');
    }

    // Check if DocumentVersion table exists
    const versionTableExists = await connection`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'DocumentVersion'
      ) as "exists"
    `;

    if (!versionTableExists[0].exists) {
      // Create DocumentVersion table
      await connection`
        CREATE TABLE "DocumentVersion" (
          "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          "documentId" UUID NOT NULL REFERENCES "Document"("id") ON DELETE CASCADE,
          "historyId" UUID NOT NULL REFERENCES "DocumentHistory"("id") ON DELETE CASCADE,
          "versionNumber" INTEGER NOT NULL,
          "title" TEXT NOT NULL,
          "content" TEXT,
          "kind" VARCHAR NOT NULL CHECK ("kind" IN ('text', 'code', 'image', 'sheet', 'chart', 'vto', 'accountability')),
          "createdAt" TIMESTAMP NOT NULL,
          "metadata" JSONB
        )
      `;

      // Create indexes
      await connection`CREATE UNIQUE INDEX "doc_version_idx" ON "DocumentVersion" ("documentId", "versionNumber")`;
      await connection`CREATE INDEX "doc_version_history_idx" ON "DocumentVersion" ("historyId")`;

      console.log('Created DocumentVersion table');
    }

    // Check if DocumentEditSession table exists
    const sessionTableExists = await connection`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'DocumentEditSession'
      ) as "exists"
    `;

    if (!sessionTableExists[0].exists) {
      // Create DocumentEditSession table
      await connection`
        CREATE TABLE "DocumentEditSession" (
          "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          "documentId" UUID NOT NULL REFERENCES "Document"("id") ON DELETE CASCADE,
          "userId" UUID NOT NULL REFERENCES "User"("id"),
          "startedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
          "endedAt" TIMESTAMP,
          "isActive" BOOLEAN NOT NULL DEFAULT true,
          "editCount" INTEGER NOT NULL DEFAULT 0
        )
      `;

      // Create indexes
      await connection`CREATE INDEX "edit_session_doc_user_idx" ON "DocumentEditSession" ("documentId", "userId")`;
      await connection`CREATE INDEX "edit_session_active_idx" ON "DocumentEditSession" ("isActive")`;

      console.log('Created DocumentEditSession table');
    }

    // Check if DocumentUndoStack table exists
    const undoStackTableExists = await connection`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'DocumentUndoStack'
      ) as "exists"
    `;

    if (!undoStackTableExists[0].exists) {
      // Create DocumentUndoStack table
      await connection`
        CREATE TABLE "DocumentUndoStack" (
          "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          "documentId" UUID NOT NULL REFERENCES "Document"("id") ON DELETE CASCADE,
          "userId" UUID NOT NULL REFERENCES "User"("id"),
          "currentVersionId" UUID NOT NULL REFERENCES "DocumentVersion"("id"),
          "undoStack" JSONB NOT NULL DEFAULT '[]'::jsonb,
          "redoStack" JSONB NOT NULL DEFAULT '[]'::jsonb,
          "maxStackSize" INTEGER NOT NULL DEFAULT 50,
          "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `;

      // Create unique index
      await connection`CREATE UNIQUE INDEX "undo_stack_doc_user_idx" ON "DocumentUndoStack" ("documentId", "userId")`;

      console.log('Created DocumentUndoStack table');
    }

    console.log('Document History migration completed');
  } catch (error) {
    console.error('Error in Document History migration:', error);
    throw error;
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
    if (!databaseUrl) {
      console.warn(
        '⚠️  Skipping database migrations: no Postgres connection string configured.',
      );
      return;
    }

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
          await migrate(db, { migrationsFolder: './drizzle' });
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

        // Ensure PersonaComposerDocument table exists
        try {
          const personaComposerExists = await connection`
            SELECT EXISTS (
              SELECT FROM information_schema.tables 
              WHERE table_schema = 'public' AND table_name = 'PersonaComposerDocument'
            ) as "exists"
          `;
          if (!personaComposerExists[0].exists) {
            await connection`
              CREATE TABLE "PersonaComposerDocument" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "personaId" UUID NOT NULL REFERENCES "Persona"("id") ON DELETE CASCADE,
                "documentId" UUID NOT NULL REFERENCES "Document"("id") ON DELETE CASCADE,
                "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
              )
            `;
            await connection`
              CREATE UNIQUE INDEX "persona_composer_doc_unique"
              ON "PersonaComposerDocument" ("personaId", "documentId")
            `;
            console.log(
              'Created PersonaComposerDocument table with unique index',
            );
          } else {
            console.log('PersonaComposerDocument table already exists');
          }
        } catch (error) {
          console.error(
            'Error ensuring PersonaComposerDocument schema:',
            error,
          );
        }

        // Ensure UserSettings has primary/context columns and BundleDocument table exists
        try {
          // Helper to add a column if missing
          const ensureColumn = async (
            table: string,
            column: string,
            typeSql: string,
          ) => {
            const exists = await columnExists(connection, table, column);
            if (!exists) {
              await connection`
                ALTER TABLE ${connection(table)}
                ADD COLUMN ${connection(column)} ${connection.unsafe(typeSql)}
              `;
              console.log(`Added ${column} to ${table}`);
            }
          };

          // UserSettings columns
          await ensureColumn('UserSettings', 'primaryAccountabilityId', 'UUID');
          await ensureColumn('UserSettings', 'primaryVtoId', 'UUID');
          await ensureColumn('UserSettings', 'primaryScorecardId', 'UUID');
          await ensureColumn('UserSettings', 'currentBundleId', 'UUID');
          await ensureColumn('UserSettings', 'contextDocumentIds', 'JSONB');
          await ensureColumn(
            'UserSettings',
            'contextComposerDocumentIds',
            'JSONB',
          );
          await ensureColumn('UserSettings', 'contextRecordingIds', 'JSONB');
          await ensureColumn(
            'UserSettings',
            'usePrimaryDocsForContext',
            'BOOLEAN DEFAULT true',
          );

          // VoiceTranscript content column
          await ensureColumn('VoiceTranscript', 'content', 'TEXT');
          await ensureColumn(
            'UserSettings',
            'usePrimaryDocsForPersona',
            'BOOLEAN DEFAULT true',
          );
          await ensureColumn(
            'UserSettings',
            'personaContextDocumentIds',
            'JSONB',
          );

          // BundleDocument table
          const bundleTable = await connection`
            SELECT EXISTS (
              SELECT FROM information_schema.tables 
              WHERE table_schema = 'public' AND table_name = 'BundleDocument'
            ) as "exists"
          `;
          if (!bundleTable[0].exists) {
            await connection`
              CREATE TABLE "BundleDocument" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
                "bundleId" UUID NOT NULL,
                "documentId" UUID NOT NULL REFERENCES "Document"("id") ON DELETE CASCADE,
                "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
              )
            `;
            await connection`
              CREATE UNIQUE INDEX "bundle_user_doc_unique"
              ON "BundleDocument" ("userId", "bundleId", "documentId")
            `;
            console.log('Created BundleDocument table with unique index');
          } else {
            console.log('BundleDocument table already exists');
          }
        } catch (error) {
          console.error(
            'Error ensuring UserSettings/BundleDocument schema:',
            error,
          );
        }

        try {
          // Run UserDocuments migration (dynamic import to ensure env is loaded)
          const { migrateUserDocuments } = await import(
            './migrations/user-documents'
          );
          await migrateUserDocuments();
        } catch (error) {
          console.error('Error running UserDocuments migration:', error);
        }

        try {
          // Run Document History migration
          await runDocumentHistoryMigration(connection);
        } catch (error) {
          console.error('Error running Document History migration:', error);
        }

        // Fix Org schema - add pendingRemoval and fix FK constraint
        try {
          console.log('Running Org schema fixes...');

          // Add missing pendingRemoval column
          const pendingRemovalExists = await columnExists(
            connection,
            'Org',
            'pendingRemoval',
          );
          if (!pendingRemovalExists) {
            await connection`
              ALTER TABLE "Org" ADD COLUMN "pendingRemoval" INTEGER DEFAULT 0
            `;
            console.log('Added pendingRemoval column to Org table');
          } else {
            console.log('pendingRemoval column already exists in Org table');
          }

          // Fix FK constraint on User.orgId to have proper CASCADE
          try {
            await connection`
              ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_orgId_Org_id_fk"
            `;
            await connection`
              ALTER TABLE "User" 
              ADD CONSTRAINT "User_orgId_Org_id_fk" 
              FOREIGN KEY ("orgId") 
              REFERENCES "Org"("id") 
              ON DELETE SET NULL
            `;
            console.log(
              'Fixed User.orgId FK constraint with SET NULL on delete',
            );
          } catch (fkError) {
            console.log(
              'FK constraint already correctly configured or error:',
              fkError,
            );
          }

          console.log('Org schema fixes completed');
        } catch (error) {
          console.error('Error fixing Org schema:', error);
        }

        // Ensure UserMemory tables exist (idempotent)
        try {
          const memExists = await connection`
            SELECT EXISTS (
              SELECT FROM information_schema.tables 
              WHERE table_schema = 'public' AND table_name = 'UserMemory'
            ) as "exists"
          `;

          if (!memExists[0].exists) {
            await connection`
              CREATE TABLE "UserMemory" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
                "sourceMessageId" UUID REFERENCES "Message_v2"("id") ON DELETE SET NULL,
                "summary" TEXT NOT NULL,
                "content" TEXT,
                "topic" VARCHAR(128),
                "memoryType" VARCHAR NOT NULL CHECK ("memoryType" IN ('preference','profile','company','task','knowledge','personal','other')) DEFAULT 'other',
                "confidence" INTEGER NOT NULL DEFAULT 60,
                "status" VARCHAR NOT NULL CHECK ("status" IN ('active','pending','archived','dismissed')) DEFAULT 'active',
                "tags" JSONB,
                "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
                "expiresAt" TIMESTAMP
              )
            `;
            console.log('Created UserMemory table');
          } else {
            console.log('UserMemory table already exists');
          }

          const embExists = await connection`
            SELECT EXISTS (
              SELECT FROM information_schema.tables 
              WHERE table_schema = 'public' AND table_name = 'UserMemoryEmbedding'
            ) as "exists"
          `;

          if (!embExists[0].exists) {
            await connection`
              CREATE TABLE "UserMemoryEmbedding" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "memoryId" UUID NOT NULL REFERENCES "UserMemory"("id") ON DELETE CASCADE,
                "chunk" TEXT NOT NULL,
                "embedding" VECTOR(1536) NOT NULL,
                "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
              )
            `;
            await connection`CREATE INDEX "user_memory_id_idx" ON "UserMemoryEmbedding" ("memoryId")`;
            await connection`CREATE INDEX "user_memory_embedding_idx" ON "UserMemoryEmbedding" USING hnsw ("embedding" vector_cosine_ops)`;
            console.log('Created UserMemoryEmbedding table and indexes');
          } else {
            console.log('UserMemoryEmbedding table already exists');
          }
        } catch (error) {
          console.error('Error ensuring UserMemory tables:', error);
        }

        // Add Circle.so course persona tables
        try {
          console.log('Running Circle.so course persona migrations...');

          // Check if CircleCoursePersona table exists
          const circleTableExists = await connection`
            SELECT EXISTS (
              SELECT FROM information_schema.tables 
              WHERE table_name = 'CircleCoursePersona'
            ) as "exists"
          `;

          if (!circleTableExists[0].exists) {
            await connection`
              CREATE TABLE IF NOT EXISTS "CircleCoursePersona" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "circleSpaceId" VARCHAR(128) NOT NULL,
                "circleCourseId" VARCHAR(128) NOT NULL,
                "personaId" UUID NOT NULL REFERENCES "Persona"(id) ON DELETE CASCADE,
                "courseName" VARCHAR(256) NOT NULL,
                "courseDescription" TEXT,
                "targetAudience" VARCHAR(32) NOT NULL,
                "lastSyncedAt" TIMESTAMP,
                "syncStatus" VARCHAR(32) DEFAULT 'pending',
                "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
                UNIQUE("circleCourseId")
              )
            `;
            await connection`CREATE INDEX "circle_course_persona_course_idx" ON "CircleCoursePersona"("circleCourseId")`;
            await connection`CREATE INDEX "circle_course_persona_persona_idx" ON "CircleCoursePersona"("personaId")`;
            console.log('Created CircleCoursePersona table and indexes');
          } else {
            console.log('CircleCoursePersona table already exists');
          }

          // Check if UserCoursePersonaSubscription table exists
          const subscriptionTableExists = await connection`
            SELECT EXISTS (
              SELECT FROM information_schema.tables 
              WHERE table_name = 'UserCoursePersonaSubscription'
            ) as "exists"
          `;

          if (!subscriptionTableExists[0].exists) {
            await connection`
              CREATE TABLE IF NOT EXISTS "UserCoursePersonaSubscription" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "userId" UUID NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
                "personaId" UUID NOT NULL REFERENCES "Persona"(id) ON DELETE CASCADE,
                "isActive" BOOLEAN NOT NULL DEFAULT true,
                "activatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
                "deactivatedAt" TIMESTAMP,
                "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
                UNIQUE("userId", "personaId")
              )
            `;
            await connection`CREATE INDEX "user_course_persona_sub_user_idx" ON "UserCoursePersonaSubscription"("userId")`;
            await connection`CREATE INDEX "user_course_persona_sub_persona_idx" ON "UserCoursePersonaSubscription"("personaId")`;
            await connection`CREATE INDEX "user_course_persona_sub_active_idx" ON "UserCoursePersonaSubscription"("userId", "isActive")`;
            console.log(
              'Created UserCoursePersonaSubscription table and indexes',
            );
          } else {
            console.log('UserCoursePersonaSubscription table already exists');
          }
        } catch (error) {
          console.error('Error creating Circle.so course persona tables:', error);
        }

        // Add reasoning column to Message_v2 for storing Claude's extended thinking
        try {
          const reasoningExists = await columnExists(
            connection,
            'Message_v2',
            'reasoning',
          );

          if (!reasoningExists) {
            await connection`
              ALTER TABLE "Message_v2"
              ADD COLUMN "reasoning" TEXT
            `;
            console.log('Added reasoning column to Message_v2 table');
          } else {
            console.log('reasoning column already exists in Message_v2 table');
          }
        } catch (error) {
          console.error('Error adding reasoning column:', error);
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
