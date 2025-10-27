#!/usr/bin/env node

/**
 * Test script to manually trigger the daily usage counter reset
 * This simulates what the cron job does
 * 
 * Usage:
 *   node scripts/test-daily-reset.mjs
 * 
 * Note: This will actually reset ALL users' daily counters!
 * Only use in development or when you're sure you want to reset.
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

const BASE_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000';
const CRON_SECRET = process.env.CRON_SECRET;

async function testDailyReset() {
  console.log('🔄 Testing daily usage reset...\n');
  console.log('Configuration:');
  console.log('  BASE_URL:', BASE_URL);
  console.log('  CRON_SECRET:', CRON_SECRET ? '✓ Set' : '✗ Not set');
  console.log('');

  try {
    const headers = {
      'Content-Type': 'application/json',
    };

    if (CRON_SECRET) {
      headers['Authorization'] = `Bearer ${CRON_SECRET}`;
    }

    console.log('📡 Calling /api/cron/usage/daily...');
    
    const response = await fetch(`${BASE_URL}/api/cron/usage/daily`, {
      method: 'POST',
      headers,
    });

    const data = await response.json();

    console.log('');
    console.log('Response Status:', response.status);
    console.log('Response Body:', JSON.stringify(data, null, 2));
    console.log('');

    if (response.ok) {
      console.log('✅ Daily reset successful!');
      console.log(`   Completed in ${data.duration_ms}ms at ${data.timestamp}`);
    } else {
      console.error('❌ Daily reset failed!');
      console.error('   Error:', data.error);
      
      if (response.status === 401) {
        console.error('');
        console.error('💡 Tip: Check that CRON_SECRET is set correctly in your .env.local');
      }
    }
  } catch (error) {
    console.error('❌ Failed to test daily reset:');
    console.error('   Error:', error.message);
    console.error('');
    console.error('💡 Make sure your development server is running!');
    console.error('   Run: pnpm dev');
  }
}

testDailyReset().catch(console.error);

