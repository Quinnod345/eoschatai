import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

async function addPersonaIconColumn() {
  try {
    console.log('Adding iconUrl column to Persona table...');

    await db.execute(
      sql`ALTER TABLE "Persona" ADD COLUMN IF NOT EXISTS "iconUrl" TEXT;`,
    );

    console.log('✅ Successfully added iconUrl column to Persona table');
  } catch (error) {
    console.error('Error adding iconUrl column:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

addPersonaIconColumn();
