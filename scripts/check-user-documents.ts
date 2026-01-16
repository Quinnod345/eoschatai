import { db } from '@/lib/db';
import { userDocuments, user } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

async function checkUserDocuments() {
  try {
    // Get all users with documents
    const users = await db.select({ id: user.id, email: user.email }).from(user).limit(5);
    
    console.log('\n📄 User Documents Check:\n');
    
    for (const currentUser of users) {
      const docs = await db
        .select({
          id: userDocuments.id,
          fileName: userDocuments.fileName,
          category: userDocuments.category,
          isContext: userDocuments.isContext,
          processingStatus: userDocuments.processingStatus,
          contentHash: userDocuments.contentHash,
        })
        .from(userDocuments)
        .where(eq(userDocuments.userId, currentUser.id))
        .limit(10);

      if (docs.length > 0) {
        console.log(`\n👤 User: ${currentUser.email}`);
        console.log(`   Total documents: ${docs.length}`);
        
        for (const doc of docs) {
          console.log(`   - ${doc.fileName}`);
          console.log(`     Category: ${doc.category}`);
          console.log(`     isContext: ${doc.isContext}`);
          console.log(`     Status: ${doc.processingStatus || 'unknown'}`);
          console.log(`     Has Hash: ${!!doc.contentHash}`);
        }
      }
    }

    console.log('\n✅ Done\n');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkUserDocuments();


