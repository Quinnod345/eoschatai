import { config } from 'dotenv';
import path from 'node:path';
import postgres from 'postgres';

// Load env from .env.local (fallback to .env if needed)
config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL/POSTGRES_URL not set');
    process.exit(1);
  }

  const sql = postgres(url, { ssl: 'require', max: 1 });
  try {
    const exists = await sql<{ org_exists: boolean; user_exists: boolean }[]>`
      SELECT
        EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'Org'
        ) AS org_exists,
        EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'User'
        ) AS user_exists
    `;

    console.log('Table existence:', exists[0]);

    if (exists[0]?.org_exists) {
      const cols = await sql<{ column_name: string }[]>`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'Org'
        ORDER BY ordinal_position
      `;
      console.log(
        'Org columns:',
        cols.map((c) => c.column_name),
      );
    }
  } finally {
    await sql.end({ timeout: 1 });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
