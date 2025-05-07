import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

// Get the database connection string from environment variables
const connectionString = process.env.POSTGRES_URL;

if (!connectionString) {
  throw new Error('POSTGRES_URL environment variable is not set');
}

// Create a database connection
const client = postgres(connectionString);

// Create a drizzle client
export const db = drizzle(client);
