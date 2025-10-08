-- Add isContext field to UserDocuments table
ALTER TABLE "UserDocuments" ADD COLUMN "isContext" boolean DEFAULT true;

-- Add isContext field to Document table (for composers)
ALTER TABLE "Document" ADD COLUMN "isContext" boolean DEFAULT false;

