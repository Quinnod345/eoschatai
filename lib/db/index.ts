import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { pgSchema } from 'drizzle-orm/pg-core';

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

// Get the database connection string
const connectionString = getDatabaseUrl();

// Create a database connection
const client = postgres(connectionString, { ssl: true });

// Create a drizzle client with schema
export const db = drizzle(client, { schema });
