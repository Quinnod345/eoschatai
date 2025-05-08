require('dotenv').config({ path: '.env.local' });
const postgres = require('postgres');

async function fixPgVector() {
  // Connect to the database
  const sql = postgres(process.env.POSTGRES_URL, { max: 1 });

  try {
    console.log('Checking for pgvector extension...');

    // Check if pgvector is available
    const extensions = await sql`
      SELECT * FROM pg_available_extensions WHERE name = 'vector'
    `;

    if (extensions.length === 0) {
      console.error(
        'Error: pgvector extension is not available on this PostgreSQL server.',
      );
      console.error(
        'You need to install the pgvector extension on your PostgreSQL server first.',
      );
      console.error(
        'For more information, visit: https://github.com/pgvector/pgvector',
      );
      return;
    }

    console.log('pgvector extension is available, installing it...');

    // Try to create the extension
    try {
      await sql`CREATE EXTENSION IF NOT EXISTS vector`;
      console.log('Successfully installed pgvector extension!');
    } catch (err) {
      console.error('Error installing pgvector extension:', err.message);
      return;
    }

    // Comment out the HNSW index creation in the migrations to avoid errors
    console.log('Fixing schema to not use HNSW index...');

    // Get the current schema file
    try {
      const schemaFile = await sql`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'Embeddings' AND column_name = 'embedding'
      `;

      if (schemaFile.length === 0) {
        // Add the embedding column to the Embeddings table
        await sql`
          ALTER TABLE "Embeddings" 
          ADD COLUMN "embedding" vector(1536)
        `;
        console.log('Added embedding column to Embeddings table');
      } else {
        console.log('Embedding column already exists');
      }

      // Create a basic cosine similarity index instead of HNSW
      await sql`
        CREATE INDEX IF NOT EXISTS embedding_cosine_idx
        ON "Embeddings" USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100)
      `;
      console.log('Created cosine similarity index on embeddings');

      console.log('Successfully fixed pgvector configuration!');
    } catch (err) {
      console.error('Error updating schema:', err.message);
    }
  } catch (error) {
    console.error('Error fixing pgvector:', error);
  } finally {
    // Close the database connection
    await sql.end();
  }
}

fixPgVector().catch(console.error);
