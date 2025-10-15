#!/usr/bin/env node

/**
 * Test script for the web search tool
 * Run with: node test-web-search-tool.mjs
 */

import { searchWebSimple } from './lib/web-search-simple.ts';

console.log('🔍 Testing Web Search Tool\n');

async function testSearch() {
  try {
    console.log('Test 1: Searching for "latest AI news"\n');

    const results = await searchWebSimple('latest AI news', 3);

    if (results.length === 0) {
      console.error('❌ No results returned');
      return false;
    }

    console.log(`✅ Found ${results.length} results:\n`);

    results.forEach((result, index) => {
      console.log(`${index + 1}. ${result.title}`);
      console.log(`   URL: ${result.url}`);
      console.log(`   Snippet: ${result.snippet.substring(0, 100)}...`);
      console.log('');
    });

    console.log('✅ Web search tool is working correctly!\n');
    console.log(
      '💡 The AI can now automatically search the web when needed.\n',
    );

    return true;
  } catch (error) {
    console.error('❌ Error testing web search:', error.message);
    console.error(
      '\nMake sure FIRECRAWL_API_KEY is set in your .env.local file\n',
    );
    return false;
  }
}

testSearch();






