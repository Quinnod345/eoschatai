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

  return new Index({
    url,
    token,
  });
};

async function diagnoseEOSRAG() {
  console.log('🔍 Diagnosing EOS Implementer RAG System\n');

  const client = getUpstashClient();
  const testNamespaces = [
    'eos-implementer-quarterly-session',
    'eos-implementer-focus-day',
    'eos-implementer-vision-day-1',
    'eos-implementer-vision-day-2',
  ];

  try {
    // 1. Check index info
    console.log('1️⃣ Checking Upstash index info...');
    const info = await client.info();
    console.log(`Total vectors: ${info.vectorCount}`);
    console.log(`Dimension: ${info.dimension}`);
    console.log(`Namespaces:`, info.namespaces);
    console.log('');

    // 2. Check vectors in each namespace
    console.log('2️⃣ Checking vectors in each EOS namespace...\n');

    for (const namespace of testNamespaces) {
      console.log(`Namespace: ${namespace}`);

      try {
        // Try to fetch vectors by prefix to list them
        const fetchResults = await client.fetch({
          prefix: `${namespace}-`,
        });

        console.log(`  Fetch by prefix found ${fetchResults.length} vectors`);

        if (fetchResults.length > 0 && fetchResults[0]) {
          console.log(`  First vector:`);
          console.log(`    ID: ${fetchResults[0].id}`);
          console.log(`    Metadata:`, fetchResults[0].metadata);
        }

        // Also try to fetch specific IDs
        const testId = `${namespace}-EOS-Vision-Building-Day1-Session-Guide-chunk-0`;
        const specificFetch = await client.fetch([testId]);

        if (specificFetch.length > 0 && specificFetch[0]) {
          console.log(`  Found specific vector by ID: ${testId}`);
        }
      } catch (error) {
        console.log(
          `  Error querying namespace: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      console.log('');
    }

    // 3. Test actual RAG search
    console.log('3️⃣ Testing RAG search functionality...\n');

    const testQueries = [
      'where to start',
      'core values',
      'quarterly planning',
      'focus day',
      'vision building day 1',
    ];

    for (const query of testQueries) {
      console.log(`Query: "${query}"`);

      const { embedding } = await embed({
        model: openai.embedding('text-embedding-ada-002'),
        value: query,
      });

      // Test searching in vision-day-1 namespace
      const namespace = 'eos-implementer-vision-day-1';
      const results = await client.query({
        vector: embedding,
        topK: 3,
        includeMetadata: true,
      });

      console.log(`  Results in ${namespace}: ${results.length}`);

      if (results.length > 0) {
        results.forEach((result, i) => {
          console.log(`    ${i + 1}. Score: ${result.score.toFixed(3)}`);
          console.log(`       Title: ${result.metadata?.title || 'No title'}`);
          console.log(
            `       Content preview: ${(result.metadata?.content as string)?.substring(0, 100) || 'No content'}...`,
          );
        });
      }

      console.log('');
    }

    // 4. Check if vectors have namespace in metadata
    console.log('4️⃣ Checking metadata structure...\n');

    // Search without namespace to see all vectors
    const allResults = await client.query({
      vector: new Array(1536).fill(0),
      topK: 50,
      includeMetadata: true,
    });

    console.log(
      `Total vectors found (no namespace filter): ${allResults.length}`,
    );

    // Check how many have namespace in metadata
    const withNamespaceMetadata = allResults.filter(
      (r) => r.metadata?.namespace,
    );
    console.log(
      `Vectors with namespace in metadata: ${withNamespaceMetadata.length}`,
    );

    if (withNamespaceMetadata.length > 0) {
      console.log('\nSample vectors with namespace in metadata:');
      withNamespaceMetadata.slice(0, 3).forEach((result, i) => {
        console.log(`  ${i + 1}. ID: ${result.id}`);
        console.log(
          `     Namespace in metadata: ${result.metadata?.namespace}`,
        );
      });
    }

    // 5. Test the actual upstashSystemRagContextPrompt function
    console.log('\n5️⃣ Testing upstashSystemRagContextPrompt function...\n');

    const { upstashSystemRagContextPrompt } = await import(
      '@/lib/ai/upstash-system-rag'
    );

    const profileId = 'vision-building-day-1';
    const testQuery = 'where to start';

    console.log(
      `Calling upstashSystemRagContextPrompt('${profileId}', '${testQuery}')`,
    );
    const context = await upstashSystemRagContextPrompt(profileId, testQuery);

    console.log(`\nContext returned (${context.length} chars):`);
    if (context.length > 0) {
      console.log(`${context.substring(0, 500)}...`);
    } else {
      console.log('(empty)');
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run diagnostics
diagnoseEOSRAG()
  .then(() => {
    console.log('\n✅ Diagnostics complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Diagnostics failed:', error);
    process.exit(1);
  });
