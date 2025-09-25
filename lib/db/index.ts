import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Get the database URL from either POSTGRES_URL or DATABASE_URL
const getDatabaseUrl = () => {
  const postgresUrl = process.env.POSTGRES_URL;
  const databaseUrl = process.env.DATABASE_URL;

  // Return the first available URL
  const url = postgresUrl || databaseUrl;

  if (!url) {
    console.warn('[db] Database URL not configured; using stub client.');
    return null;
  }

  return url;
};

const createStubDb = () =>
  new Proxy(
    {},
    {
      get() {
        throw new Error('Database client is not configured.');
      },
    },
  ) as ReturnType<typeof drizzle<typeof schema>>;

const connectionString = getDatabaseUrl();

let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;
if (connectionString) {
  const client = postgres(connectionString, { ssl: true });
  dbInstance = drizzle(client, { schema });
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
