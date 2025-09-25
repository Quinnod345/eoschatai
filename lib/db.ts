import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

function getDatabaseUrl(): string | null {
  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!url) {
    console.warn('[db] Database URL not configured; using stub client.');
    return null;
  }
  return url;
}

const createStubDb = () =>
  new Proxy(
    {},
    {
      get() {
        throw new Error('Database client is not configured.');
      },
    },
  ) as ReturnType<typeof drizzle>;

const url = getDatabaseUrl();

let dbInstance: ReturnType<typeof drizzle> | null = null;
if (url) {
  // Prefer Neon/hosted Postgres with SSL enabled
  const client = postgres(url, { ssl: true, max: 1 });
  dbInstance = drizzle(client);
}

export const db = dbInstance ?? createStubDb();

export const __dbMock = null as unknown as {
  state: {
    usageCounters: Record<string, number>;
    entitlements: unknown;
  };
  executed: string[];
  updateImpl: unknown;
  selectImpl: unknown;
  transaction: unknown;
  execute: unknown;
  reset: () => void;
};
