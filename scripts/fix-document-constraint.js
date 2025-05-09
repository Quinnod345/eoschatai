// Script to fix Document table primary key constraint issues
require('dotenv').config();
const crypto = require('node:crypto');

async function fixDocumentConstraint() {
  console.log('Starting to fix Document table primary key constraint...');

  // Dynamically import the database
  const { db } = await import('../lib/db');

  try {
    // First check the current state of the Document table
    const tableInfoResult = await db.execute({
      sql: `
        SELECT constraint_name 
        FROM information_schema.table_constraints 
        WHERE table_name = 'Document' 
        AND constraint_type = 'PRIMARY KEY'
      `,
    });

    console.log('Current primary key constraints:', tableInfoResult.rows);

    // Step 1: Drop any existing composite primary key
    await db.execute({
      sql: `ALTER TABLE "Document" DROP CONSTRAINT IF EXISTS "Document_id_createdAt_pk"`,
    });
    console.log('Dropped composite primary key if it existed');

    // Step 2: Ensure id is the only primary key
    await db.execute({
      sql: `
        ALTER TABLE "Document" 
        DROP CONSTRAINT IF EXISTS "Document_pkey", 
        ADD CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
      `,
    });
    console.log('Set id as the primary key');

    // Step 3: Check for duplicate IDs that need to be fixed
    const duplicatesResult = await db.execute({
      sql: `
        SELECT id, COUNT(*) 
        FROM "Document" 
        GROUP BY id 
        HAVING COUNT(*) > 1
      `,
    });

    if (duplicatesResult.rows.length > 0) {
      console.log(
        'Found duplicate IDs that need to be fixed:',
        duplicatesResult.rows,
      );

      // For each set of duplicates, keep one and rename the others
      for (const row of duplicatesResult.rows) {
        const duplicateId = row[0];
        console.log(`Fixing duplicates for ID: ${duplicateId}`);

        // Get all documents with this ID
        const duplicatesDetailResult = await db.execute({
          sql: `
            SELECT id, "createdAt" 
            FROM "Document" 
            WHERE id = $1 
            ORDER BY "createdAt" DESC
          `,
          params: [duplicateId],
        });

        // Keep the newest one (first in the array) and update the others
        for (let i = 1; i < duplicatesDetailResult.rows.length; i++) {
          const newId = crypto.randomUUID();
          await db.execute({
            sql: `
              UPDATE "Document" 
              SET id = $1 
              WHERE id = $2 AND "createdAt" = $3
            `,
            params: [newId, duplicateId, duplicatesDetailResult.rows[i][1]],
          });
          console.log(
            `Updated duplicate document ID from ${duplicateId} to ${newId}`,
          );
        }
      }
    } else {
      console.log('No duplicate IDs found');
    }

    console.log('Document table primary key constraint fixed successfully!');
  } catch (error) {
    console.error('Error fixing Document table:', error);
  } finally {
    // Close the database connection
    process.exit(0);
  }
}

fixDocumentConstraint().catch(console.error);
