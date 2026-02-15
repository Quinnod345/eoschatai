#!/usr/bin/env tsx

import path from 'node:path';
import dotenv from 'dotenv';
import fs from 'node:fs';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

console.log('Environment Variables Check:');
console.log('--------------------------');

// Check for database URLs
console.log(
  'POSTGRES_URL:',
  process.env.POSTGRES_URL ? 'Defined ✅' : 'Not defined ❌',
);
console.log(
  'DATABASE_URL:',
  process.env.DATABASE_URL ? 'Defined ✅' : 'Not defined ❌',
);

// Check if .env.local exists
const envPath = path.resolve(process.cwd(), '.env.local');
console.log(
  '\n.env.local file:',
  fs.existsSync(envPath) ? 'Exists ✅' : 'Does not exist ❌',
);

// If .env.local exists, list all variables (masking sensitive ones)
if (fs.existsSync(envPath)) {
  console.log('\nVariables in .env.local file:');
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');

  for (const line of lines) {
    if (line.trim() && !line.startsWith('#')) {
      const [key, ...valueParts] = line.split('=');
      const value = valueParts.join('=');

      // Mask sensitive values
      if (key && value) {
        const trimmedKey = key.trim();
        if (
          trimmedKey.includes('URL') ||
          trimmedKey.includes('KEY') ||
          trimmedKey.includes('SECRET') ||
          trimmedKey.includes('PASSWORD') ||
          trimmedKey.includes('TOKEN')
        ) {
          console.log(`${trimmedKey}: [MASKED]`);
        } else {
          console.log(`${trimmedKey}: ${value}`);
        }
      }
    }
  }
}
