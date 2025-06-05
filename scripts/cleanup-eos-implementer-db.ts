import * as dotenv from 'dotenv';
import path from 'node:path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Verify DATABASE_URL is loaded
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not found in environment variables');
  process.exit(1);
}

console.log(
  `Using database URL: ${process.env.DATABASE_URL.substring(0, 30)}...`,
);

import { db } from '@/lib/db';
import { persona, personaProfile } from '@/lib/db/schema';
import { eq, } from 'drizzle-orm';

async function cleanupEOSImplementerData() {
  try {
    console.log(
      '🧹 Cleaning up EOS Implementer personas and profiles from database...',
    );

    // Find all EOS Implementer personas (both system and user-created)
    const eosPersonas = await db
      .select()
      .from(persona)
      .where(eq(persona.name, 'EOS Implementer'));

    console.log(
      `Found ${eosPersonas.length} EOS Implementer personas to clean up`,
    );

    for (const eosPersona of eosPersonas) {
      console.log(
        `\n🗑️  Cleaning up persona: ${eosPersona.name} (ID: ${eosPersona.id})`,
      );

      // First, delete all profiles for this persona
      const profiles = await db
        .select()
        .from(personaProfile)
        .where(eq(personaProfile.personaId, eosPersona.id));

      console.log(`   Found ${profiles.length} profiles to delete`);

      for (const profile of profiles) {
        await db
          .delete(personaProfile)
          .where(eq(personaProfile.id, profile.id));
        console.log(`   ✅ Deleted profile: ${profile.name}`);
      }

      // Then delete the persona itself
      await db.delete(persona).where(eq(persona.id, eosPersona.id));
      console.log(`   ✅ Deleted persona: ${eosPersona.name}`);
    }

    console.log('\n🎉 Database cleanup completed successfully!');
    console.log(
      'EOS Implementer functionality will now be handled via hardcoded system prompts.',
    );
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    throw error;
  }
}

// Run the cleanup if this file is executed directly
if (require.main === module) {
  cleanupEOSImplementerData()
    .then(() => {
      console.log('Cleanup completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Cleanup failed:', error);
      process.exit(1);
    });
}

export { cleanupEOSImplementerData };
