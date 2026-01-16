import { db } from '@/lib/db';
import { userDocuments } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';

async function backfillProcessingStatus() {
  console.log('🚀 Starting processing status backfill...\n');

  try {
    // Get all documents without a processing status or with null status
    const documents = await db
      .select({
        id: userDocuments.id,
        fileName: userDocuments.fileName,
        isContext: userDocuments.isContext,
        processingStatus: userDocuments.processingStatus,
      })
      .from(userDocuments)
      .where(
        sql`${userDocuments.processingStatus} IS NULL OR ${userDocuments.processingStatus} = ''`,
      );

    console.log(`Found ${documents.length} documents to update\n`);

    let totalUpdated = 0;
    let totalErrors = 0;

    for (const doc of documents) {
      try {
        // Set status based on isContext
        // If isContext is true, assume they were successfully processed (since they're older documents)
        // If isContext is false, mark as ready (they don't need processing)
        const status = doc.isContext ? 'ready' : 'ready';

        await db
          .update(userDocuments)
          .set({ processingStatus: status })
          .where(eq(userDocuments.id, doc.id));

        totalUpdated++;

        if (totalUpdated % 100 === 0) {
          console.log(`  Processed ${totalUpdated} documents...`);
        }
      } catch (error) {
        console.error(
          `  ❌ Error updating document ${doc.fileName} (${doc.id}):`,
          error,
        );
        totalErrors++;
      }
    }

    console.log(`\n✨ Processing status backfill complete!`);
    console.log(`  Updated: ${totalUpdated} documents`);
    console.log(`  Errors: ${totalErrors} documents`);

    // Also set version to 1 for all documents without a version
    console.log(`\n🔄 Setting default version numbers...`);

    const result = await db
      .update(userDocuments)
      .set({ version: 1 })
      .where(sql`${userDocuments.version} IS NULL`);

    console.log(`  ✅ Updated documents with default version = 1`);
  } catch (error) {
    console.error('💥 Fatal error during backfill:', error);
    process.exit(1);
  }
}

// Run the backfill
backfillProcessingStatus()
  .then(() => {
    console.log('\n✅ All done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Backfill failed:', error);
    process.exit(1);
  });


