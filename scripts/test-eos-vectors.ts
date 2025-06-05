import * as dotenv from 'dotenv';
import path from 'node:path';
import { Index } from '@upstash/vector';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Initialize Upstash client
const getUpstashClient = () => {
  const url = process.env.UPSTASH_USER_RAG_REST_URL;
  const token = process.env.UPSTASH_USER_RAG_REST_TOKEN;

  if (!url || !token) {
    throw new Error('Missing UPSTASH_USER_RAG credentials');
  }

  return new Index({
    url,
    token,
  });
};

async function testVectors() {
  console.log('🔍 Testing EOS Implementer Vectors\n');

  const client = getUpstashClient();
  const namespace = 'eos-implementer-vision-day-1';

  try {
    // Try to fetch a specific vector by ID pattern
    console.log(`Fetching vectors from namespace "${namespace}"...`);

    // Try to list vectors with a prefix
    const prefix = 'eos-implementer-vision-day-1';

    // Fetch by specific ID pattern
    const testIds = [
      `${namespace}-EOS-Vision-Building-Day1-Session-Guide-chunk-0`,
      `${namespace}-3-Step-Process-Documenter-Implementer-Guide-chunk-0`,
      `${namespace}-Accountability-Chart-Implementer-Guide-chunk-0`,
    ];

    console.log('\nTrying to fetch specific vectors:');
    for (const id of testIds) {
      try {
        const result = await client.fetch([id], { namespace });
        if (result && result.length > 0) {
          console.log(`\n✅ Found vector: ${id}`);
          console.log(`   Has metadata: ${!!result[0]?.metadata}`);
          if (result[0]?.metadata) {
            console.log(`   Title: ${result[0].metadata.title}`);
            console.log(
              `   Content preview: ${(result[0].metadata?.content as string)?.substring(0, 100) || 'No content'}...`,
            );
          }
        } else {
          console.log(`❌ Not found: ${id}`);
        }
      } catch (err) {
        console.log(`❌ Error fetching ${id}:`, err instanceof Error ? err.message : String(err));
      }
    }

    // Try a similarity search with a different query
    console.log('\n\nTrying different search queries:');
    const queries = [
      'vision building day 1',
      'core values',
      'accountability chart',
      'EOS implementer',
      'facilitation guide',
    ];

    for (const query of queries) {
      const { openai } = await import('@ai-sdk/openai');
      const { embed } = await import('ai');

      const { embedding } = await embed({
        model: openai.embedding('text-embedding-ada-002'),
        value: query,
      });

      const results = await client.query({
        vector: embedding,
        topK: 1,
        includeMetadata: true,
      });

      console.log(`\n"${query}": ${results.length} results`);
      if (results.length > 0) {
        console.log(`   Score: ${results[0].score.toFixed(3)}`);
        console.log(`   Title: ${results[0].metadata?.title || 'No title'}`);
      }
    }
  } catch (error) {
    console.error('\n❌ Error:', error);
  }
}

// Run the test
testVectors()
  .then(() => {
    console.log('\n✅ Test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
