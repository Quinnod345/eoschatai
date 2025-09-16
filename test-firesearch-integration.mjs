#!/usr/bin/env node

/**
 * Test Firesearch Integration
 * This script tests the new Firesearch deep research functionality
 */

import fetch from 'node-fetch';

const API_URL = 'http://localhost:3000/api/firesearch';

async function testFiresearch() {
  console.log('🚀 Testing Firesearch Integration...\n');

  try {
    // Test 1: Basic research query
    console.log('Test 1: Basic Deep Research Query');
    console.log('================================');

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: 'your-auth-cookie-here', // Replace with actual auth cookie
      },
      body: JSON.stringify({
        query: 'What are the latest developments in quantum computing?',
        chatId: 'test-chat-' + Date.now(),
        depth: 'comprehensive',
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Handle SSE stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    console.log('\nReceiving events:');
    console.log('-----------------');

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
                console.log(`📍 Phase: ${data.phase} - ${data.message}`);
                break;
              case 'nexus-research-plan':
                console.log(
                  `📋 Research Plan: ${data.plan.totalSearches} searches planned`,
                );
                console.log(`   Main Query: ${data.plan.mainQuery}`);
                if (data.plan.subQuestions) {
                  console.log('   Sub Questions:');
                  data.plan.subQuestions.forEach((q, i) => {
                    console.log(`     ${i + 1}. ${q}`);
                  });
                }
                break;
              case 'nexus-search-progress':
                console.log(
                  `🔍 Search ${data.searchIndex + 1}/${data.totalSearches}: ${data.currentSearch}`,
                );
                break;
              case 'nexus-source-found':
                console.log(`📄 Source Found: ${data.source.title}`);
                break;
              case 'nexus-followup-questions':
                console.log(`💡 Follow-up Questions:`);
                data.questions.forEach((q, i) => {
                  console.log(`   ${i + 1}. ${q}`);
                });
                break;
              case 'nexus-search-complete':
                console.log(`✅ Research Complete!`);
                console.log(`   Sources Found: ${data.sourcesFound}`);
                console.log(`   Citations: ${data.citations.length}`);
                if (data.followUpQuestions) {
                  console.log(
                    `   Follow-up Questions: ${data.followUpQuestions.length}`,
                  );
                }
                break;
              case 'nexus-error':
                console.error(`❌ Error: ${data.error}`);
                break;
              default:
                console.log(
                  `ℹ️  ${data.type}: ${JSON.stringify(data).slice(0, 100)}...`,
                );
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
    }

    console.log('\n✅ Test completed successfully!\n');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('\nMake sure:');
    console.error('1. The app is running on http://localhost:3000');
    console.error('2. You have valid authentication cookies');
    console.error('3. Firesearch API keys are configured in .env');
  }
}

// Test 2: Test session resume functionality
async function testSessionResume() {
  console.log('\nTest 2: Session Resume Functionality');
  console.log('===================================');

  // This would test resuming a previous research session
  console.log('⏸️  Session resume test would go here...');
  console.log('   (Requires a valid session ID from a previous search)\n');
}

// Main execution
async function main() {
  console.log('===========================================');
  console.log('🔬 Firesearch Integration Test Suite');
  console.log('===========================================\n');

  await testFiresearch();
  await testSessionResume();

  console.log('===========================================');
  console.log('🎉 All tests completed!');
  console.log('===========================================');
}

// Run tests
main().catch(console.error);



