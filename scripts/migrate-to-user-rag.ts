#!/usr/bin/env tsx

import { config } from 'dotenv';
import path from 'node:path';

// Load environment variables FIRST
config({ path: path.resolve(process.cwd(), '.env.local') });

// Import database modules AFTER environment variables are loaded
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { userDocuments } from '@/lib/db/schema';
import { processUserDocument } from '@/lib/ai/user-rag';

/**
 * Migrate existing user documents to the new user RAG system
 */
async function migrateUserDocumentsToRAG() {
  console.log('🚀 Starting migration of user documents to User RAG system...');

  let client: any = null;

  try {
    // Debug: Check environment variables
    console.log('🔍 Checking environment variables...');
    console.log(
      `DATABASE_URL: ${process.env.DATABASE_URL ? 'Set' : 'Missing'}`,
    );
    console.log(
      `POSTGRES_URL: ${process.env.POSTGRES_URL ? 'Set' : 'Missing'}`,
    );
    console.log(
      `UPSTASH_USER_RAG_REST_URL: ${process.env.UPSTASH_USER_RAG_REST_URL ? 'Set' : 'Missing'}`,
    );
    console.log(
      `UPSTASH_USER_RAG_REST_TOKEN: ${process.env.UPSTASH_USER_RAG_REST_TOKEN ? 'Set' : 'Missing'}`,
    );

    // Debug: Show actual database URL (first 50 chars for security)
    const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    console.log(
      `Database URL preview: ${dbUrl ? `${dbUrl.substring(0, 50)}...` : 'None'}`,
    );
    console.log(
      `Database URL contains neon: ${dbUrl ? dbUrl.includes('neon') : false}`,
    );

    // Check if required environment variables are available
    if (
      !process.env.UPSTASH_USER_RAG_REST_URL ||
      !process.env.UPSTASH_USER_RAG_REST_TOKEN
    ) {
      console.error('❌ Missing UPSTASH_USER_RAG environment variables.');
      console.error(
        'Make sure UPSTASH_USER_RAG_REST_URL and UPSTASH_USER_RAG_REST_TOKEN are set in .env.local',
      );
      process.exit(1);
    }

    // Check database connection
    if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
      console.error('❌ Missing database environment variables.');
      console.error(
        'Make sure DATABASE_URL or POSTGRES_URL is set in .env.local',
      );
      process.exit(1);
    }

    // Create database connection
    console.log('📋 Creating database connection...');
    const getDatabaseUrl = () => {
      const postgresUrl = process.env.POSTGRES_URL;
      const databaseUrl = process.env.DATABASE_URL;

      // Return the first available URL
      const url = postgresUrl || databaseUrl;

      if (!url) {
        throw new Error(
          'Neither POSTGRES_URL nor DATABASE_URL environment variable is defined',
        );
      }

      return url;
    };

    const connectionString = getDatabaseUrl();
    console.log(
      `Using database: ${connectionString.includes('neon') ? 'Neon' : 'Other'}`,
    );

    // Create postgres client and drizzle instance
    client = postgres(connectionString, { ssl: true });
    const db = drizzle(client);

    // Get all user documents from the database
    console.log('📋 Fetching all user documents from database...');
    const documents = await db.select().from(userDocuments);

    console.log(`📊 Found ${documents.length} documents to migrate`);

    if (documents.length === 0) {
      console.log('✅ No documents to migrate. Migration complete!');
      return;
    }

    // Group documents by user for better logging
    const documentsByUser = documents.reduce(
      (acc, doc) => {
        if (!acc[doc.userId]) {
          acc[doc.userId] = [];
        }
        acc[doc.userId].push(doc);
        return acc;
      },
      {} as Record<string, typeof documents>,
    );

    console.log(
      `👥 Documents belong to ${Object.keys(documentsByUser).length} users`,
    );

    let totalProcessed = 0;
    let totalErrors = 0;

    // Process documents for each user
    for (const [userId, userDocs] of Object.entries(documentsByUser)) {
      console.log(
        `\n👤 Processing ${userDocs.length} documents for user ${userId}...`,
      );

      for (const doc of userDocs) {
        try {
          console.log(`  📄 Processing: ${doc.fileName} (${doc.category})`);

          // Process the document and store in user's RAG namespace
          await processUserDocument(
            userId,
            doc.id, // Use existing document ID
            doc.content,
            {
              fileName: doc.fileName,
              category: doc.category,
              fileType: doc.fileType,
            },
          );

          totalProcessed++;
          console.log(`  ✅ Successfully processed: ${doc.fileName}`);

          // Add a small delay to avoid rate limiting
          await new Promise((resolve) => setTimeout(resolve, 100));
        } catch (error) {
          totalErrors++;
          console.error(`  ❌ Error processing ${doc.fileName}:`, error);
        }
      }
    }

    console.log('\n📈 Migration Summary:');
    console.log(`  📄 Total documents: ${documents.length}`);
    console.log(`  ✅ Successfully processed: ${totalProcessed}`);
    console.log(`  ❌ Errors: ${totalErrors}`);

    if (totalErrors === 0) {
      console.log('\n🎉 Migration completed successfully!');
      console.log('\n📝 Next steps:');
      console.log('1. Test the new user RAG system with some queries');
      console.log(
        '2. Update your application to use the new user RAG functions',
      );
      console.log('3. Consider removing the old documentContextPrompt usage');
    } else {
      console.log(
        '\n⚠️  Migration completed with some errors. Please review the error messages above.',
      );
    }

    // Close database connection
    if (client) {
      await client.end();
      console.log('📋 Database connection closed');
    }
  } catch (error) {
    console.error('💥 Migration failed:', error);

    // Close database connection on error
    if (client) {
      try {
        await client.end();
        console.log('📋 Database connection closed (after error)');
      } catch (closeError) {
        console.error('Error closing database connection:', closeError);
      }
    }

    process.exit(1);
  }
}

/**
 * Test the user RAG system with a sample query
 */
async function testUserRAG(userId: string, query: string) {
  console.log(
    `\n🧪 Testing User RAG for user ${userId} with query: "${query}"`,
  );

  try {
    const { findRelevantUserContent } = await import('@/lib/ai/user-rag');
    // Use a lower relevance threshold for testing
    const results = await findRelevantUserContent(userId, query, 5, 0.3);

    console.log(`📊 Found ${results.length} relevant results:`);
    if (results.length === 0) {
      console.log('  No results found. This might indicate:');
      console.log('  - The documents were not properly migrated');
      console.log("  - The query doesn't match the document content");
      console.log('  - The relevance threshold is too high');
    } else {
      results.forEach((result, index) => {
        console.log(
          `  ${index + 1}. ${result.metadata.fileName} (${(result.relevance * 100).toFixed(1)}% relevance)`,
        );
        console.log(`     Category: ${result.metadata.category}`);
        console.log(
          `     Content preview: ${result.content.substring(0, 100)}...`,
        );
      });
    }
  } catch (error) {
    console.error('❌ Error testing User RAG:', error);
  }
}

/**
 * Get user document statistics
 */
async function getUserStats() {
  console.log('\n📊 Getting user document statistics...');

  let client: any = null;

  try {
    const { getUserDocumentStats } = await import('@/lib/ai/user-rag');

    // Create database connection
    const getDatabaseUrl = () => {
      const postgresUrl = process.env.POSTGRES_URL;
      const databaseUrl = process.env.DATABASE_URL;

      const url = postgresUrl || databaseUrl;

      if (!url) {
        throw new Error(
          'Neither POSTGRES_URL nor DATABASE_URL environment variable is defined',
        );
      }

      return url;
    };

    const connectionString = getDatabaseUrl();
    client = postgres(connectionString, { ssl: true });
    const db = drizzle(client);

    // Get all unique user IDs from the database
    const documents = await db.select().from(userDocuments);
    const userIds = [...new Set(documents.map((doc) => doc.userId))];

    for (const userId of userIds) {
      const stats = await getUserDocumentStats(userId);
      console.log(`👤 User ${userId}:`);
      console.log(`  📄 Documents: ${stats.documentCount}`);
      console.log(`  🧩 Chunks: ${stats.totalChunks}`);
      console.log(`  📂 Categories: ${stats.categories.join(', ')}`);
    }

    // Close database connection
    if (client) {
      await client.end();
    }
  } catch (error) {
    console.error('❌ Error getting user stats:', error);

    // Close database connection on error
    if (client) {
      try {
        await client.end();
      } catch (closeError) {
        console.error('Error closing database connection:', closeError);
      }
    }
  }
}

// Main execution
async function main() {
  const command = process.argv[2] || 'migrate';

  switch (command) {
    case 'migrate':
      await migrateUserDocumentsToRAG();
      break;

    case 'test': {
      const userId = process.argv[3];
      const query = process.argv[4] || 'scorecard';
      if (!userId) {
        console.error('Usage: npm run migrate-user-rag test <userId> [query]');
        process.exit(1);
      }
      await testUserRAG(userId, query);
      break;
    }

    case 'stats':
      await getUserStats();
      break;

    default:
      console.log('Available commands:');
      console.log('  migrate - Migrate user documents to RAG system');
      console.log('  test <userId> [query] - Test user RAG with a query');
      console.log('  stats - Show user document statistics');
      break;
  }
}

// Run the script
main().catch(console.error);
