import * as dotenv from 'dotenv';
import path from 'node:path';
import { Index } from '@upstash/vector';
import { openai } from '@ai-sdk/openai';
import { embed } from 'ai';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Initialize Upstash client
const getUpstashClient = () => {
  const url = process.env.UPSTASH_USER_RAG_REST_URL;
  const token = process.env.UPSTASH_USER_RAG_REST_TOKEN;

  if (!url || !token) {
    throw new Error('Missing UPSTASH_USER_RAG credentials');
  }

  console.log('Using Upstash URL:', `${url.substring(0, 30)}...`);

  return new Index({
    url,
    token,
  });
};

async function testSearch() {
  console.log('🔍 Testing EOS Implementer RAG Search\n');

  const client = getUpstashClient();
  const testQuery = 'where to start';
  const namespace = 'eos-implementer-vision-day-1';

  try {
    // First, let's check if there are ANY vectors in the namespace
    console.log(`\n1️⃣ Checking for vectors in namespace "${namespace}"...`);

    // Try to list vectors in the namespace
    const info = await client.info();
    console.log('Index info:', info);

    // Generate embedding for test query
    console.log(`\n2️⃣ Generating embedding for query: "${testQuery}"`);
    const { embedding } = await embed({
      model: openai.embedding('text-embedding-ada-002'),
      value: testQuery,
    });
    console.log(`Generated embedding with ${embedding.length} dimensions`);

    // Search without namespace first
    console.log('\n3️⃣ Searching WITHOUT namespace...');
    const generalResults = await client.query({
      vector: embedding,
      topK: 5,
      includeMetadata: true,
    });
    console.log(`Found ${generalResults.length} results without namespace`);
    if (generalResults.length > 0) {
      console.log('First result:', {
        id: generalResults[0].id,
        score: generalResults[0].score,
        hasMetadata: !!generalResults[0].metadata,
        namespace: generalResults[0].metadata?.namespace,
      });
    }

    // Search with namespace
    console.log(`\n4️⃣ Searching WITH namespace "${namespace}"...`);
    const namespaceResults = await client.query({
      vector: embedding,
      topK: 5,
      includeMetadata: true,
    });
    console.log(`Found ${namespaceResults.length} results in namespace`);

    if (namespaceResults.length > 0) {
      console.log('\nResults:');
      namespaceResults.forEach((result, i) => {
        console.log(`\n${i + 1}. Score: ${result.score.toFixed(3)}`);
        console.log(`   ID: ${result.id}`);
        console.log(`   Title: ${result.metadata?.title || 'No title'}`);
        console.log(
          `   Content preview: ${(result.metadata?.content as string)?.substring(0, 100) || 'No content'}...`,
        );
      });
    }

    // Try different namespaces
    console.log('\n5️⃣ Checking all EOS Implementer namespaces...');
    const namespaces = [
      'eos-implementer-vision-day-1',
      'eos-implementer-vision-day-2',
      'eos-implementer-quarterly-session',
      'eos-implementer-focus-day',
    ];

    for (const ns of namespaces) {
      const results = await client.query({
        vector: embedding,
        topK: 1,
        includeMetadata: true,
      });
      console.log(`   ${ns}: ${results.length} results`);
    }
  } catch (error) {
    console.error('\n❌ Error during search:', error);
  }
}

// Run the test
testSearch()
  .then(() => {
    console.log('\n✅ Test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
