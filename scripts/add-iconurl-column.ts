import postgres from 'postgres';

async function addIconUrlColumn() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  const sql = postgres(databaseUrl, { ssl: 'require' });

  try {
    console.log('Adding iconUrl column to Persona table...');

    // Add the iconUrl column if it doesn't exist
    await sql`
      ALTER TABLE "Persona" 
      ADD COLUMN IF NOT EXISTS "iconUrl" TEXT;
    `;

    console.log('✅ Successfully added iconUrl column to Persona table');

    // Verify the column was added
    const result = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'Persona' AND column_name = 'iconUrl';
    `;

    if (result.length > 0) {
      console.log('✅ Verified: iconUrl column exists in Persona table');
    } else {
      console.log('❌ Warning: iconUrl column not found after adding');
    }
  } catch (error) {
    console.error('❌ Error adding iconUrl column:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

addIconUrlColumn();
