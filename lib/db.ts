import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

function getDatabaseUrl(): string {
  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL/POSTGRES_URL not set');
  return url;
}

// Prefer Neon/hosted Postgres with SSL enabled
const client = postgres(getDatabaseUrl(), { ssl: true, max: 1 });
export const db = drizzle(client);
