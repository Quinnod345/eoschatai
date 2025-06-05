import * as dotenv from 'dotenv';
import path from 'node:path';
import { Index } from '@upstash/vector';
import { openai } from '@ai-sdk/openai';
import { embed } from 'ai';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function testDirectFetch() {
  const url = process.env.UPSTASH_USER_RAG_REST_URL;
  const token = process.env.UPSTASH_USER_RAG_REST_TOKEN;

  if (!url || !token) {
    throw new Error('Missing UPSTASH_USER_RAG credentials');
  }

  const client = new Index({ url, token });
  const namespace = 'eos-implementer-vision-day-1';

  console.log('🔍 Testing direct fetch and search\n');

  // 1. Fetch a specific vector we know exists
  const knownId =
    'eos-implementer-vision-day-1-EOS-Vision-Building-Day1-Session-Guide.pdf-chunk-0';

  console.log(`1️⃣ Fetching known vector: ${knownId}`);
  const fetchResult = await client.fetch([knownId]);

  if (fetchResult[0]) {
    console.log('✅ Vector found!');
    console.log(
      'Content:',
      `${(fetchResult[0].metadata?.content as string)?.substring(0, 200) || 'No content'}...`,
    );

    // 2. Generate embedding from the actual content
    const content = fetchResult[0].metadata?.content;
    if (content) {
      console.log(
        '\n2️⃣ Generating embedding from the actual content and searching...',
      );
      const { embedding } = await embed({
        model: openai.embedding('text-embedding-ada-002'),
        value: (content as string).substring(0, 500), // Use first 500 chars
      });

      const searchResults = await client.query({
        vector: embedding,
        topK: 5,
        includeMetadata: true,
      });

      console.log(`Found ${searchResults.length} results`);
      searchResults.forEach((result, i) => {
        console.log(
          `  ${i + 1}. Score: ${result.score.toFixed(3)} - ${result.metadata?.fileName || 'Unknown'}`,
        );
      });
    }
  } else {
    console.log('❌ Vector not found');
  }

  // 3. Try range to get some vectors
  console.log('\n3️⃣ Getting vectors via range operation...');
  const rangeResult = await client.range({
    cursor: '',
    limit: 5,
    includeMetadata: true,
    includeVectors: false,
  });

  console.log(`Range returned ${rangeResult.vectors?.length || 0} vectors`);
  if (rangeResult.vectors && rangeResult.vectors.length > 0) {
    console.log('First vector ID:', rangeResult.vectors[0].id);
    console.log(
      'First vector has content:',
      !!rangeResult.vectors[0].metadata?.content,
    );
  }

  // 4. Test with the actual system RAG function but with lower threshold
  console.log(
    '\n4️⃣ Testing findUpstashSystemContent with very low threshold...',
  );
  const { findUpstashSystemContent } = await import(
    '@/lib/ai/upstash-system-rag'
  );

  const testQuery = 'vision building';
  const results = await findUpstashSystemContent(
    testQuery,
    namespace,
    10,
    0.0001,
  );

  console.log(`Found ${results.length} results with threshold 0.0001`);
  if (results.length > 0) {
    console.log(
      'First result:',
      results[0].title,
      '- Score:',
      results[0].relevance,
    );
  }
}

testDirectFetch()
  .then(() => {
    console.log('\n✅ Test complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
