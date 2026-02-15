import { db } from '@/lib/db/index';
import { persona } from '@/lib/db/schema';

async function testPersonasAPI() {
  try {
    console.log('Testing personas API...');

    // Test database connection
    console.log('Testing database connection...');
    const result = await db.select().from(persona).limit(1);
    console.log('✅ Database connection successful');
    console.log('Sample persona result:', result);

    // Check if iconUrl column exists
    console.log('Checking persona table structure...');
    const personas = await db.select().from(persona).limit(1);
    if (personas.length > 0) {
      console.log('Persona columns:', Object.keys(personas[0]));
      if ('iconUrl' in personas[0]) {
        console.log('✅ iconUrl column exists');
      } else {
        console.log('❌ iconUrl column missing');
      }
    } else {
      console.log('No personas found in database');
    }
  } catch (error) {
    console.error('❌ Error testing personas API:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
  }
}

testPersonasAPI();
