-- Add 'accountability' to Document.kind enum constraint
-- For PostgreSQL without native enums, this is a varchar with a CHECK in application.
-- We keep DB open but ensure downstream code handles the new value.
-- No-op migration placeholder to bump drizzle snapshot.



