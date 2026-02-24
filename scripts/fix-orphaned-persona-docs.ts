import { db } from '@/lib/db';
import { userDocuments, personaDocument } from '@/lib/db/schema';
import { eq, } from 'drizzle-orm';

async function fixOrphanedPersonaDocs() {
  try {
    console.log('\n🔍 Finding orphaned "Persona Document" category documents...\n');

    // Get all documents with category "Persona Document"
    const personaDocs = await db
      .select()
      .from(userDocuments)
      .where(eq(userDocuments.category, 'Persona Document'));

    console.log(`Found ${personaDocs.length} documents with category "Persona Document"\n`);

    for (const doc of personaDocs) {
      // Check if this document is actually linked to a persona
      const [link] = await db
        .select()
        .from(personaDocument)
        .where(eq(personaDocument.documentId, doc.id))
        .limit(1);

      if (!link) {
        console.log(`📄 Orphaned: ${doc.fileName}`);
        console.log(`   Document ID: ${doc.id}`);
        console.log(`   User ID: ${doc.userId}`);
        console.log(`   Not linked to any persona!\n`);

        // Fix: Change category to "Other" so it's accessible in regular chats
        await db
          .update(userDocuments)
          .set({ category: 'Other' })
          .where(eq(userDocuments.id, doc.id));

        console.log(`   ✅ Changed category from "Persona Document" to "Other"\n`);
      } else {
        console.log(`✅ Linked: ${doc.fileName}`);
        console.log(`   Linked to persona: ${link.personaId}\n`);
      }
    }

    console.log('\n✨ Done!\n');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixOrphanedPersonaDocs();


