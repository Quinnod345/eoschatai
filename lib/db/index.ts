import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { pgSchema } from 'drizzle-orm/pg-core';

// Get the database connection string from environment variables
const connectionString = process.env.POSTGRES_URL;

if (!connectionString) {
  throw new Error('POSTGRES_URL environment variable is not set');
}

// Create a database connection
const client = postgres(connectionString, { ssl: true });

// Create a drizzle client with schema
export const db = drizzle(client, { schema });
