import { db } from '@/lib/db';
import { user, userDocuments } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { computeStringHash } from '@/lib/utils/file-hash';

async function backfillStorage() {
  console.log('🚀 Starting storage backfill...\n');

  try {
    // Get all users
    const users = await db.select({ id: user.id, plan: user.plan }).from(user);

    console.log(`Found ${users.length} users to process\n`);

    let totalUpdated = 0;
    let totalErrors = 0;

    for (const currentUser of users) {
      try {
        console.log(`Processing user ${currentUser.id}...`);

        // Calculate total storage used by this user
        const result = await db
          .select({
            total: sql<number>`COALESCE(SUM(${userDocuments.fileSize}), 0)`,
          })
          .from(userDocuments)
          .where(eq(userDocuments.userId, currentUser.id));

        const storageUsed = Number(result[0]?.total || 0);

        // Set storage quota based on plan
        let storageQuota = 104857600; // 100MB default
        if (currentUser.plan === 'pro') {
          storageQuota = 1073741824; // 1GB
        } else if (currentUser.plan === 'business') {
          storageQuota = 10737418240; // 10GB
        }

        // Update user record
        await db
          .update(user)
          .set({
            storageUsed,
            storageQuota,
          })
          .where(eq(user.id, currentUser.id));

        console.log(
          `  ✅ Updated: ${(storageUsed / (1024 * 1024)).toFixed(2)} MB used, ${(storageQuota / (1024 * 1024)).toFixed(0)} MB quota`,
        );
        totalUpdated++;
      } catch (error) {
        console.error(`  ❌ Error processing user ${currentUser.id}:`, error);
        totalErrors++;
      }
    }

    console.log(`\n✨ Storage backfill complete!`);
    console.log(`  Updated: ${totalUpdated} users`);
    console.log(`  Errors: ${totalErrors} users`);

    // Now backfill content hashes for documents
    console.log(`\n🔄 Backfilling content hashes...`);

    const documents = await db
      .select({
        id: userDocuments.id,
        content: userDocuments.content,
      })
      .from(userDocuments)
      .where(sql`${userDocuments.contentHash} IS NULL`)
      .limit(1000); // Process in batches

    console.log(`Found ${documents.length} documents without content hash\n`);

    let hashUpdated = 0;
    let hashErrors = 0;

    for (const doc of documents) {
      try {
        if (doc.content) {
          const contentHash = await computeStringHash(doc.content);
          await db
            .update(userDocuments)
            .set({ contentHash })
            .where(eq(userDocuments.id, doc.id));
          hashUpdated++;

          if (hashUpdated % 100 === 0) {
            console.log(`  Processed ${hashUpdated} documents...`);
          }
        }
      } catch (error) {
        console.error(`  ❌ Error hashing document ${doc.id}:`, error);
        hashErrors++;
      }
    }

    console.log(`\n✨ Content hash backfill complete!`);
    console.log(`  Updated: ${hashUpdated} documents`);
    console.log(`  Errors: ${hashErrors} documents`);
  } catch (error) {
    console.error('💥 Fatal error during backfill:', error);
    process.exit(1);
  }
}

// Run the backfill
backfillStorage()
  .then(() => {
    console.log('\n✅ All done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Backfill failed:', error);
    process.exit(1);
  });


