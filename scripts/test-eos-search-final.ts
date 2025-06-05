import * as dotenv from 'dotenv';
import path from 'node:path';
import { Index } from '@upstash/vector';
import { openai } from '@ai-sdk/openai';
import { embed } from 'ai';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function testEOSSearch() {
  const url = process.env.UPSTASH_USER_RAG_REST_URL;
  const token = process.env.UPSTASH_USER_RAG_REST_TOKEN;

  if (!url || !token) {
    throw new Error('Missing UPSTASH_USER_RAG credentials');
  }

  const client = new Index({ url, token });
  const namespace = 'eos-implementer-vision-day-1';

  console.log('🔍 Testing EOS Search with different thresholds\n');

  const queries = [
    'where to start vision building day 1',
    'core values discovery',
    'accountability chart',
    'annual session guide',
    'EOS implementer facilitation',
  ];

  for (const query of queries) {
    console.log(`\nQuery: "${query}"`);

    // Generate embedding
    const { embedding } = await embed({
      model: openai.embedding('text-embedding-ada-002'),
      value: query,
    });

    // Try different similarity thresholds
    const thresholds = [0.7, 0.6, 0.5, 0.4, 0.3];

    for (const threshold of thresholds) {
      const results = await client.query({
        vector: embedding,
        topK: 3,
        includeMetadata: true,
      });

      // Filter by threshold
      const filteredResults = results.filter((r) => r.score >= threshold);

      if (filteredResults.length > 0) {
        console.log(
          `  ✅ Found ${filteredResults.length} results with threshold ${threshold}:`,
        );
        filteredResults.forEach((result, i) => {
          console.log(
            `     ${i + 1}. Score: ${result.score.toFixed(3)} - ${result.metadata?.title || 'No title'}`,
          );
          console.log(
            `        Content preview: ${(result.metadata?.content as string)?.substring(0, 100)?.replace(/\n/g, ' ') || 'No content'}...`,
          );
        });
        break; // Found results, don't try lower thresholds
      } else {
        console.log(`  ❌ No results with threshold ${threshold}`);
      }
    }
  }

  // Test the actual upstashSystemRagContextPrompt function
  console.log('\n\n🎯 Testing upstashSystemRagContextPrompt function:\n');

  const { upstashSystemRagContextPrompt } = await import(
    '@/lib/ai/upstash-system-rag'
  );

  const profileId = 'vision-building-day-1';
  const testQuery = 'how do I facilitate vision building day 1';

  console.log(
    `Calling upstashSystemRagContextPrompt('${profileId}', '${testQuery}')`,
  );
  const context = await upstashSystemRagContextPrompt(profileId, testQuery);

  if (context.length > 0) {
    console.log(`\n✅ Context returned (${context.length} chars)`);
    console.log('\nFirst 500 chars of context:');
    console.log(`${context.substring(0, 500)}...`);
  } else {
    console.log('\n❌ No context returned');
  }
}

testEOSSearch()
  .then(() => {
    console.log('\n✅ Test complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
