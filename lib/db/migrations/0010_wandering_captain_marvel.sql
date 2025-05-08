-- First check if the Document table already has a primary key
DO $$ 
BEGIN
  -- If Document table has a composite primary key of (id, createdAt), drop it
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'Document_id_createdAt_pk' 
    AND conrelid = '"Document"'::regclass
  ) THEN
    ALTER TABLE "Document" DROP CONSTRAINT "Document_id_createdAt_pk";
  END IF;
  
  -- If Document table doesn't have a primary key, add it
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE contype = 'p' 
    AND conrelid = '"Document"'::regclass
  ) THEN
    ALTER TABLE "Document" ADD PRIMARY KEY ("id");
  END IF;
END $$;

-- Drop the Embeddings to Document foreign key if it exists
ALTER TABLE "Embeddings" DROP CONSTRAINT IF EXISTS "Embeddings_documentId_Document_id_fk";

-- Add the foreign key constraint, ensuring it references the correct column
ALTER TABLE "Embeddings" ADD CONSTRAINT "Embeddings_documentId_Document_id_fk" 
  FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE cascade ON UPDATE no action;

-- Drop all data in the Embeddings table if there's an error with the foreign key
-- (This is a fallback in case there are orphaned records)
-- DELETE FROM "Embeddings" WHERE "documentId" NOT IN (SELECT "id" FROM "Document");