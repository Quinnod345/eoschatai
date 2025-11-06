/**
 * Fix knowledge namespace for existing course personas
 * Sets knowledgeNamespace to match persona ID (where vectors are actually stored)
 */

import { config } from 'dotenv';
import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { persona } from '../lib/db/schema';
import { eq } from 'drizzle-orm';

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') });

async function fixNamespaces() {
  const connectionString = process.env.POSTGRES_URL;

  if (!connectionString) {
    console.error('❌ POSTGRES_URL not found in environment variables');
    process.exit(1);
  }

  const connection = postgres(connectionString);
  const db = drizzle(connection);

  try {
    console.log('\n🔧 Fixing course persona namespaces...\n');

    // Update the Test course persona specifically
    const personaId = '672a0960-49a9-4006-a42e-85466e590312';

    const result = await db
      .update(persona)
      .set({
        knowledgeNamespace: personaId,
        updatedAt: new Date(),
      })
      .where(eq(persona.id, personaId))
      .returning();

    if (result.length > 0) {
      console.log(`✅ Updated persona: ${result[0].name}`);
      console.log(`   ID: ${result[0].id}`);
      console.log(`   New namespace: ${result[0].knowledgeNamespace}`);
    } else {
      console.log('⚠️  Persona not found');
    }

    console.log('\n✨ Namespace fix complete!\n');

    await connection.end();
  } catch (error) {
    console.error('❌ Error:', error);
    await connection.end();
    process.exit(1);
  }
}

fixNamespaces();
