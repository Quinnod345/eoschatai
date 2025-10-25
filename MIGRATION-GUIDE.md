# Database Migration Guide

This guide explains how to work with database migrations in the EOSAI project.

## Overview

The project uses two migration systems:
1. **Drizzle-kit** - For schema changes that can be automatically applied
2. **SQL Migrations** - For complex migrations or when Drizzle-kit has interactive prompts

## Automatic Migration System

The project includes an automatic migration runner that handles both types of migrations.

### Running Migrations Manually

```bash
# Run all pending migrations (recommended)
npm run db:auto-migrate

# Run only SQL migrations
npm run db:run-migrations

# Run only Drizzle migrations
npm run db:push
```

### Automatic Migration on Build

Migrations are automatically run during the build process:
```bash
npm run build
```

This ensures the database is always up-to-date before deployment.

## Adding New Migrations

### 1. Schema Changes (Drizzle)

For schema changes, update the schema in `lib/db/schema.ts`:

```typescript
// Example: Adding a new column
export const org = pgTable('Org', {
  // ... existing columns
  ownerId: uuid('ownerId').references(() => user.id),
});
```

Then generate the migration:
```bash
npm run db:generate
```

### 2. SQL Migrations

For complex migrations or data transformations, create a SQL file in the `drizzle/` directory:

```sql
-- drizzle/xxxx_migration_name.sql
-- Description of what this migration does

ALTER TABLE "Org" ADD COLUMN "ownerId" uuid;

-- Add constraints, indexes, etc.
CREATE INDEX "org_owner_idx" ON "Org"("ownerId");

-- Data migrations
UPDATE "Org" SET "ownerId" = '...' WHERE ...;
```

**Naming Convention:**
- Use format: `XXXX_descriptive_name.sql` (e.g., `0019_add_org_owner.sql`)
- Number sequentially after existing migrations
- Use lowercase with underscores

## How the Migration System Works

### 1. Migration Tracking

The system tracks applied migrations in a `migrations` table:
```sql
CREATE TABLE migrations (
  id SERIAL PRIMARY KEY,
  filename VARCHAR(255) UNIQUE NOT NULL,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 2. Migration Process

1. Connects to the database using environment variables
2. Creates migration tracking table if it doesn't exist
3. Compares files in `drizzle/` with applied migrations
4. Applies pending migrations in alphabetical order
5. Records successful migrations

### 3. Error Handling

- Migrations run in transactions (rollback on error)
- "Already exists" errors are handled gracefully
- Failed migrations are reported but don't stop the process

## Troubleshooting

### Interactive Prompts

If `drizzle-kit push` shows interactive prompts:
1. The auto-migrate script will continue with SQL migrations
2. You can manually handle the prompt or create a SQL migration

### Migration Failures

If a migration fails:
1. Check the error message
2. Fix the SQL if there's a syntax error
3. If partially applied, you may need to manually clean up
4. Re-run `npm run db:auto-migrate`

### Checking Migration Status

To see which migrations have been applied:
```sql
SELECT * FROM migrations ORDER BY applied_at;
```

## Best Practices

1. **Test Locally First**: Always test migrations on a local database
2. **Backup Before Major Changes**: Create database backups before significant migrations
3. **Keep Migrations Small**: Break large changes into smaller, focused migrations
4. **Document Complex Logic**: Add comments explaining complex SQL operations
5. **Version Control**: Always commit migration files to git

## Environment Setup

Ensure your `.env.local` has the database URL:
```env
POSTGRES_URL=postgresql://...
# or
DATABASE_URL=postgresql://...
```

## Example: Adding Organization Owner

Here's a complete example of adding an owner field to organizations:

1. Update schema (`lib/db/schema.ts`):
```typescript
ownerId: uuid('ownerId').references(() => user.id),
```

2. Create SQL migration (`drizzle/0019_add_org_owner.sql`):
```sql
-- Add ownerId to Org table
ALTER TABLE "Org" ADD COLUMN "ownerId" uuid;

-- Add foreign key constraint
ALTER TABLE "Org" ADD CONSTRAINT "Org_ownerId_fkey" 
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX "org_owner_idx" ON "Org"("ownerId");

-- Set existing owners
UPDATE "Org" o
SET "ownerId" = (
  SELECT u.id FROM "User" u 
  WHERE u."orgId" = o.id 
  ORDER BY u.id LIMIT 1
)
WHERE o."ownerId" IS NULL;
```

3. Run migration:
```bash
npm run db:auto-migrate
```

## CI/CD Integration

The migration system is designed to work in CI/CD pipelines:
- Runs automatically during `npm run build`
- Non-interactive (uses `--force` flag for drizzle-kit)
- Returns appropriate exit codes for pipeline success/failure

## Security Notes

- Never commit `.env.local` or database credentials
- Use environment variables for all database connections
- Migrations should be reviewed before merging to main
- Test migrations on staging before production deployment

