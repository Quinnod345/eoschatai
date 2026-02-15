ALTER TABLE "UserMemory"
ADD COLUMN IF NOT EXISTS "dedupeKey" text;

WITH ranked AS (
  SELECT
    "id",
    NULLIF(LOWER(BTRIM("summary")), '') AS normalized_summary,
    ROW_NUMBER() OVER (
      PARTITION BY
        "userId",
        "memoryType",
        "status",
        NULLIF(LOWER(BTRIM("summary")), '')
      ORDER BY "createdAt" ASC, "id" ASC
    ) AS duplicate_rank
  FROM "UserMemory"
  WHERE "status" = 'active'
)
UPDATE "UserMemory" AS memory
SET "dedupeKey" = CASE
  WHEN ranked.normalized_summary IS NULL THEN NULL
  WHEN ranked.duplicate_rank = 1 THEN ranked.normalized_summary
  ELSE ranked.normalized_summary || '#legacy-' || ranked.id::text
END
FROM ranked
WHERE memory."id" = ranked."id"
  AND (memory."dedupeKey" IS NULL OR memory."dedupeKey" = '');

CREATE UNIQUE INDEX IF NOT EXISTS "user_memory_active_dedupe_idx"
ON "UserMemory" ("userId", "memoryType", "status", "dedupeKey");
