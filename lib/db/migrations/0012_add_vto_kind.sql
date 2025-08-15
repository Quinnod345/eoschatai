-- Add 'vto' to Document.kind enum if enum exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'Document_kind'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'Document_kind' AND e.enumlabel = 'vto'
    ) THEN
      ALTER TYPE "Document_kind" ADD VALUE IF NOT EXISTS 'vto';
    END IF;
  END IF;
END$$;


