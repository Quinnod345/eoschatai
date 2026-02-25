# AGENTS.md

## Cursor Cloud specific instructions

### Overview

EOSAI is a single Next.js 15 application (not a monorepo) — an AI-powered assistant for EOS (Entrepreneurial Operating System) implementation. See `CLAUDE.md` for the full command reference and architecture details.

### Running the dev server

```bash
pnpm dev  # Starts on port 3000 with Turbopack
```

All required environment variables (database, API keys, auth) are injected as secrets. No `.env.local` file is needed in the cloud agent environment — Next.js reads from the process environment directly.

### Database

The app uses a remote Neon/Vercel PostgreSQL database. Connection strings are provided via `POSTGRES_URL` / `DATABASE_URL` secrets. Migrations run automatically via `npx tsx lib/db/migrate.ts` and are idempotent — they skip already-applied changes gracefully. No local PostgreSQL setup is needed when secrets are injected.

### Lint / Test / Build

- **Lint**: `pnpm lint` — uses Biome. The codebase has pre-existing lint errors (~79); this is the current state of the repo.
- **Unit tests**: `pnpm test:unit` — uses Vitest. Some pre-existing test failures exist (~54/432 tests fail).
- **E2E tests**: `pnpm test` — uses Playwright. Requires the dev server to be running.
- **Build**: `pnpm build` — runs migrations then builds the Next.js app.

### Authentication

The app uses Auth.js (next-auth) with Google OAuth and email/password credentials. For local testing, register a new account at `/register` with any email/password. Guest auth redirects to login.

### Key gotchas

- The `pnpm dev` command uses `NODE_OPTIONS="--max-old-space-size=4096"` — the app is memory-intensive.
- The migration script (`lib/db/migrate.ts`) gracefully skips if no database URL is configured, allowing builds to succeed without a database.
- The `simple-git-hooks` pre-commit hook runs `pnpm secrets:scan:staged` to prevent secret leaks.
- `NEXT_PUBLIC_BASE_URL` must be set for some client-side features to work properly.
