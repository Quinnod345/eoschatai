import { list } from '@vercel/blob';
import { config } from 'dotenv';
import { existsSync } from 'node:fs';

// Load environment variables
const envFile = existsSync('.env.local') ? '.env.local' : '.env';
config({ path: envFile });

async function main() {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.error('BLOB_READ_WRITE_TOKEN is not set');
      process.exit(1);
    }

    console.log('Testing Vercel Blob connection...');
    const { blobs } = await list();
    console.log(
      `Connected to Vercel Blob. Found ${blobs.length} existing files.`,
    );
  } catch (error) {
    console.error('Error connecting to Vercel Blob:', error);
    process.exit(1);
  }
}

main().catch(console.error);
