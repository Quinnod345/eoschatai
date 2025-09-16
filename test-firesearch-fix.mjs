#!/usr/bin/env node

/**
 * Test Firesearch Integration After JSON Fix
 * Run with: node test-firesearch-fix.mjs
 */

import fetch from 'node-fetch';

const API_URL = 'http://localhost:3000/api/chat';

async function testFiresearchFix() {
  try {
    console.log('🧪 Testing Firesearch Integration After JSON Fix');
    console.log('===============================================\n');

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: 'your-auth-cookie-here', // Replace with actual auth cookie
      },
      body: JSON.stringify({
        chatId: 'test-' + Date.now(),
        messages: [
          {
            role: 'user',
            content: 'What is a put option in trading?',
          },
        ],
        selectedResearchMode: 'nexus',
        model: 'gpt-4.1-mini',
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let errorOccurred = false;

    console.log('📡 Streaming response...\n');

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));

            switch (data.type) {
              case 'nexus-phase-update':
                console.log(`✅ Phase: ${data.phase} - ${data.message}`);
                break;
              case 'nexus-error':
                console.error(`❌ ERROR: ${data.error}`);
                errorOccurred = true;
                break;
              case 'nexus-research-plan':
                console.log(`📋 Research Plan Created Successfully!`);
                console.log(`   Queries: ${data.plan.totalSearches}`);
                break;
              case 'nexus-search-progress':
                console.log(
                  `🔍 Progress: Search ${data.searchIndex + 1}/${data.totalSearches}`,
                );
                break;
              case 'nexus-search-complete':
                console.log(`✅ Research Complete!`);
                console.log(`   Total Results: ${data.totalResults || 'N/A'}`);
                console.log(`   Citations: ${data.citations?.length || 0}`);
                break;
              case 'nexus-followup-questions':
                console.log(
                  `💡 Follow-up Questions: ${data.questions?.length || 0}`,
                );
                break;
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
    }

    if (errorOccurred) {
      console.log('\n❌ Test FAILED - Errors occurred during research');
    } else {
      console.log('\n✅ Test PASSED - Firesearch is working correctly!');
    }
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\nMake sure:');
    console.log('1. Your dev server is running (npm run dev)');
    console.log('2. You have a valid auth cookie');
    console.log('3. Environment variables are set correctly');
  }
}

// Run test
testFiresearchFix().catch(console.error);



