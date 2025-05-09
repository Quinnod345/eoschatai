import type { Config } from 'drizzle-kit';
import * as dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

// Get the database URL from either POSTGRES_URL or DATABASE_URL
const getDatabaseUrl = () => {
  const postgresUrl = process.env.POSTGRES_URL;
  const databaseUrl = process.env.DATABASE_URL;

  // Return the first available URL
  const url = postgresUrl || databaseUrl;

  if (!url) {
    throw new Error(
      'Neither POSTGRES_URL nor DATABASE_URL environment variable is defined',
    );
  }

  return url;
};

// Using type assertions to bypass type checking
// while keeping the correct configuration that works at runtime
export default {
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    connectionString: getDatabaseUrl(),
    ssl: true,
  },
} as unknown as Config;
