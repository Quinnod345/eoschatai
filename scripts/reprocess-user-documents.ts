import { db } from '@/lib/db';
import { userDocuments } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { processUserDocument } from '@/lib/ai/user-rag';

async function reprocessUserDocuments() {
  try {
    const userId = '4963f143-cfdd-4f4b-aaf4-b50a735eca54'; // Your user ID

    console.log(`\n🔄 Reprocessing documents for user ${userId}...\n`);

    // Get all documents for this user
    const docs = await db
      .select()
      .from(userDocuments)
      .where(eq(userDocuments.userId, userId));

    console.log(`Found ${docs.length} documents to process\n`);

    let processed = 0;
    let skipped = 0;
    let errors = 0;

    for (const doc of docs) {
      try {
        if (!doc.content || doc.content.trim().length === 0) {
          console.log(`  ⏭️  Skipping ${doc.fileName} (no content)`);
          skipped++;
          continue;
        }

        console.log(`  📄 Processing: ${doc.fileName}`);
        console.log(`     Category: ${doc.category}`);
        console.log(`     Size: ${doc.fileSize} bytes`);

        // Process into Upstash
        await processUserDocument(userId, doc.id, doc.content, {
          fileName: doc.fileName,
          category: doc.category,
          fileType: doc.fileType,
        });

        console.log(`  ✅ Successfully processed: ${doc.fileName}\n`);
        processed++;

        // Small delay to avoid rate limits
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`  ❌ Error processing ${doc.fileName}:`, error);
        errors++;
      }
    }

    console.log('\n📊 Summary:');
    console.log(`  ✅ Processed: ${processed}`);
    console.log(`  ⏭️  Skipped: ${skipped}`);
    console.log(`  ❌ Errors: ${errors}`);
    console.log(`\n✨ Done!\n`);

    process.exit(0);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

reprocessUserDocuments();


