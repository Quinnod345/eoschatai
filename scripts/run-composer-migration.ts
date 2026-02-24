import { db } from '../lib/db';
import { sql } from 'drizzle-orm';

async function runMigration() {
  console.log('Running composer enhancement migration...\n');
  
  const statements = [
    // Add tags column (this was missing from initial run)
    `ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "tags" jsonb DEFAULT '[]'`,
    
    // Create ComposerRelationship table
    `CREATE TABLE IF NOT EXISTS "ComposerRelationship" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "sourceId" uuid NOT NULL REFERENCES "Document"("id") ON DELETE CASCADE,
      "targetId" uuid NOT NULL REFERENCES "Document"("id") ON DELETE CASCADE,
      "relationshipType" varchar NOT NULL,
      "createdAt" timestamp DEFAULT now() NOT NULL,
      "metadata" jsonb,
      CONSTRAINT "composer_rel_unique" UNIQUE ("sourceId", "targetId", "relationshipType")
    )`,
    
    // Create ComposerMention table
    `CREATE TABLE IF NOT EXISTS "ComposerMention" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "composerId" uuid NOT NULL REFERENCES "Document"("id") ON DELETE CASCADE,
      "mentionedInChatId" uuid REFERENCES "Chat"("id") ON DELETE CASCADE,
      "mentionedInComposerId" uuid REFERENCES "Document"("id") ON DELETE CASCADE,
      "messageId" uuid REFERENCES "Message_v2"("id") ON DELETE SET NULL,
      "mentionedAt" timestamp DEFAULT now() NOT NULL,
      "mentionContext" text,
      "userId" uuid NOT NULL REFERENCES "User"("id") ON DELETE CASCADE
    )`,
    
    // Create indexes
    `CREATE INDEX IF NOT EXISTS "composer_title_idx" ON "Document" ("title")`,
    `CREATE INDEX IF NOT EXISTS "composer_tags_idx" ON "Document" USING gin ("tags")`,
    `CREATE INDEX IF NOT EXISTS "composer_rel_source_idx" ON "ComposerRelationship" ("sourceId")`,
    `CREATE INDEX IF NOT EXISTS "composer_rel_target_idx" ON "ComposerRelationship" ("targetId")`,
    `CREATE INDEX IF NOT EXISTS "composer_rel_type_idx" ON "ComposerRelationship" ("relationshipType")`,
    `CREATE INDEX IF NOT EXISTS "composer_mention_composer_idx" ON "ComposerMention" ("composerId")`,
    `CREATE INDEX IF NOT EXISTS "composer_mention_chat_idx" ON "ComposerMention" ("mentionedInChatId")`,
    `CREATE INDEX IF NOT EXISTS "composer_mention_in_composer_idx" ON "ComposerMention" ("mentionedInComposerId")`,
    `CREATE INDEX IF NOT EXISTS "composer_mention_message_idx" ON "ComposerMention" ("messageId")`,
    `CREATE INDEX IF NOT EXISTS "composer_mention_user_idx" ON "ComposerMention" ("userId")`,
    `CREATE INDEX IF NOT EXISTS "composer_mention_time_idx" ON "ComposerMention" ("mentionedAt")`,
  ];
  
  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;
  
  for (const statement of statements) {
    const shortStatement = `${statement.replace(/\s+/g, ' ').slice(0, 70)}...`;
    try {
      console.log(`Executing: ${shortStatement}`);
      await db.execute(sql.raw(statement));
      console.log('✓ Success\n');
      successCount++;
    } catch (error: any) {
      if (error.message?.includes('already exists') || error.message?.includes('duplicate')) {
        console.log('⚠ Already exists, skipping\n');
        skipCount++;
      } else {
        console.error(`✗ Error: ${error.message}\n`);
        errorCount++;
      }
    }
  }
  
  console.log('='.repeat(50));
  console.log(`Migration complete!`);
  console.log(`  ✓ Successful: ${successCount}`);
  console.log(`  ⚠ Skipped:    ${skipCount}`);
  console.log(`  ✗ Errors:     ${errorCount}`);
  
  process.exit(errorCount > 0 ? 1 : 0);
}

runMigration();
