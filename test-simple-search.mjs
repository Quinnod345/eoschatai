#!/usr/bin/env node

import FirecrawlApp from '@mendable/firecrawl-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function testFirecrawlSearch() {
  const apiKey = process.env.FIRECRAWL_API_KEY;

  if (!apiKey) {
    console.error('❌ No FIRECRAWL_API_KEY found in environment');
    console.log('Please add FIRECRAWL_API_KEY to your .env.local file');
    process.exit(1);
  }

  console.log('✅ API key found');
  console.log('Testing Firecrawl search API...\n');

  try {
    const app = new FirecrawlApp({ apiKey });

    const query = 'How to implement EOS in my business';
    console.log(`Searching for: "${query}"\n`);

    // Simple search with Firecrawl
    const results = await app.search(query, {
      limit: 5,
      scrapeOptions: {
        formats: ['markdown'],
        onlyMainContent: true,
      },
    });

    if (results && results.data && results.data.length > 0) {
      console.log(`✅ Found ${results.data.length} results!\n`);

      results.data.forEach((result, index) => {
        console.log(`Result ${index + 1}:`);
        console.log(`Title: ${result.metadata?.title || 'No title'}`);
        console.log(`URL: ${result.metadata?.sourceURL || result.url}`);
        console.log(
          `Description: ${result.metadata?.description || 'No description'}`,
        );
        if (result.markdown) {
          console.log(
            `Content preview: ${result.markdown.substring(0, 200)}...`,
          );
        }
        console.log('---\n');
      });
    } else {
      console.log('❌ No results found');
    }
  } catch (error) {
    console.error('❌ Error:', error.message || error);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

testFirecrawlSearch();
