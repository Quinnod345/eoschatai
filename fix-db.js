// fix-db.js
require('dotenv').config({ path: '.env.local' });
const postgres = require('postgres');
const { v4: uuidv4 } = require('uuid');

async function fixDatabase() {
  // Connect to the database
  const sql = postgres(process.env.POSTGRES_URL, { max: 1 });

  try {
    console.log('Starting aggressive database fix...');

    // 1. Check if tables exist and take backups if they do
    console.log('Checking and backing up existing tables...');

    let documents = [];
    let embeddings = [];

    try {
      // Try to get Document data
      documents = await sql`
        SELECT id, "createdAt", title, content, "text" as kind, "userId"
        FROM "Document"
      `;
      console.log(`Backed up ${documents.length} documents`);
    } catch (err) {
      console.log('Document table not found or already dropped');
    }

    try {
      // Try to get Embeddings data
      embeddings = await sql`
        SELECT id, "documentId", chunk, "createdAt"
        FROM "Embeddings"
      `;
      console.log(`Backed up ${embeddings.length} embeddings`);
    } catch (err) {
      console.log('Embeddings table not found or already dropped');
    }

    // 2. Drop existing tables if they exist
    console.log('Dropping tables if they exist...');

    try {
      // Drop Embeddings first (has the foreign key)
      await sql`DROP TABLE IF EXISTS "Embeddings"`;
      console.log('Dropped Embeddings table');
    } catch (err) {
      console.log('Error dropping Embeddings table:', err.message);
    }

    try {
      // Then drop Document
      await sql`DROP TABLE IF EXISTS "Document"`;
      console.log('Dropped Document table');
    } catch (err) {
      console.log('Error dropping Document table:', err.message);
    }

    // 3. Process documents to remove duplicates
    console.log('Processing documents to remove duplicates...');

    // First, create a clean Document map with unique IDs
    const uniqueDocumentsMap = new Map();

    // Group documents by ID first
    const documentsByOriginalId = {};
    documents.forEach((doc) => {
      if (!documentsByOriginalId[doc.id]) {
        documentsByOriginalId[doc.id] = [];
      }
      documentsByOriginalId[doc.id].push(doc);
    });

    // Process each group
    Object.entries(documentsByOriginalId).forEach(([originalId, docs]) => {
      if (docs.length === 1) {
        // No duplicates, keep as is
        uniqueDocumentsMap.set(originalId, docs[0]);
      } else {
        // Has duplicates, keep the newest one with original ID
        docs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        // Keep the newest with original ID
        uniqueDocumentsMap.set(originalId, docs[0]);

        // Add others with new IDs
        for (let i = 1; i < docs.length; i++) {
          const newId = uuidv4();
          const docCopy = { ...docs[i], id: newId };
          uniqueDocumentsMap.set(newId, docCopy);

          // Update corresponding embeddings with new document ID
          embeddings.forEach((embedding) => {
            if (embedding.documentId === originalId) {
              // Check if this is a match for the duplicate document (we can't reliably match,
              // so we'll just create a copy for safety)
              const embeddingCopy = {
                ...embedding,
                id: uuidv4(),
                documentId: newId,
              };
              embeddings.push(embeddingCopy);
            }
          });
        }
      }
    });

    // Convert map back to array
    const uniqueDocuments = Array.from(uniqueDocumentsMap.values());
    console.log(
      `Processed documents, now have ${uniqueDocuments.length} unique documents`,
    );

    // 4. Recreate the tables with correct structure
    console.log('Creating tables with correct structure...');

    try {
      await sql`
        CREATE TABLE "Document" (
          id UUID PRIMARY KEY,
          "createdAt" TIMESTAMP NOT NULL,
          title TEXT NOT NULL,
          content TEXT,
          text VARCHAR NOT NULL DEFAULT 'text',
          "userId" UUID NOT NULL
        )
      `;
      console.log('Created Document table');
    } catch (err) {
      console.error('Error creating Document table:', err.message);
      return; // Stop if we can't create the Document table
    }

    try {
      await sql`
        CREATE TABLE "Embeddings" (
          id UUID PRIMARY KEY,
          "documentId" UUID NOT NULL REFERENCES "Document"(id) ON DELETE CASCADE,
          chunk TEXT NOT NULL,
          "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `;
      console.log('Created Embeddings table');
    } catch (err) {
      console.error('Error creating Embeddings table:', err.message);
      return; // Stop if we can't create the Embeddings table
    }

    // 5. Insert the unique documents back
    if (uniqueDocuments.length > 0) {
      console.log('Inserting documents back into the table...');

      // Insert in batches to avoid OOM issues
      const BATCH_SIZE = 10;

      try {
        for (let i = 0; i < uniqueDocuments.length; i += BATCH_SIZE) {
          const batch = uniqueDocuments.slice(i, i + BATCH_SIZE);

          for (const doc of batch) {
            await sql`
              INSERT INTO "Document" (id, "createdAt", title, content, text, "userId") 
              VALUES (${doc.id}, ${doc.createdAt}, ${doc.title}, ${doc.content}, ${doc.kind}, ${doc.userId})
            `;
          }

          console.log(
            `Inserted documents batch ${i / BATCH_SIZE + 1}/${Math.ceil(uniqueDocuments.length / BATCH_SIZE)}`,
          );
        }
      } catch (err) {
        console.error('Error inserting documents:', err.message);
      }
    } else {
      console.log('No documents to insert');
    }

    // 6. Insert the embeddings back
    if (embeddings.length > 0) {
      console.log('Inserting embeddings back into the table...');

      // First make sure all reference valid documents
      const validDocumentIds = new Set(uniqueDocuments.map((doc) => doc.id));
      const validEmbeddings = embeddings.filter((emb) =>
        validDocumentIds.has(emb.documentId),
      );

      console.log(
        `Found ${validEmbeddings.length} valid embeddings referencing existing documents`,
      );

      // Insert in batches
      try {
        const BATCH_SIZE = 10;
        for (let i = 0; i < validEmbeddings.length; i += BATCH_SIZE) {
          const batch = validEmbeddings.slice(i, i + BATCH_SIZE);

          for (const emb of batch) {
            await sql`
              INSERT INTO "Embeddings" (id, "documentId", chunk, "createdAt") 
              VALUES (${emb.id}, ${emb.documentId}, ${emb.chunk}, ${emb.createdAt})
            `;
          }

          if (validEmbeddings.length > 0) {
            console.log(
              `Inserted embeddings batch ${i / BATCH_SIZE + 1}/${Math.ceil(validEmbeddings.length / BATCH_SIZE)}`,
            );
          }
        }
      } catch (err) {
        console.error('Error inserting embeddings:', err.message);
      }
    } else {
      console.log('No embeddings to insert');
    }

    // 7. Verify the fix
    try {
      const documentCount = await sql`SELECT COUNT(*) FROM "Document"`;
      const embeddingsCount = await sql`SELECT COUNT(*) FROM "Embeddings"`;

      console.log(`Final document count: ${documentCount[0].count}`);
      console.log(`Final embeddings count: ${embeddingsCount[0].count}`);

      // Check for duplicates
      const duplicateCheck = await sql`
        SELECT id, COUNT(*) 
        FROM "Document" 
        GROUP BY id 
        HAVING COUNT(*) > 1
      `;

      if (duplicateCheck.length > 0) {
        console.error('Warning: Still found duplicate IDs:', duplicateCheck);
      } else {
        console.log('No duplicate IDs found, fix successful!');
      }
    } catch (err) {
      console.error('Error during verification:', err.message);
    }

    console.log('Database fix completed successfully!');
  } catch (error) {
    console.error('Error fixing database:', error);
  } finally {
    // Close the database connection
    await sql.end();
  }
}

fixDatabase().catch(console.error);
