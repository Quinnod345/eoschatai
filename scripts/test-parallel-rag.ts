import * as dotenv from 'dotenv';
import path from 'node:path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function testParallelRAG() {
  console.log('🔍 Testing Parallel RAG Operations\n');

  // Test query
  const testQuery = 'how do I facilitate vision building day 1';
  const userId = 'test-user-123';

  // Measure time for parallel operations
  console.log('1️⃣ Testing parallel RAG operations from chat route...\n');

  const parallelStart = Date.now();

  // Simulate the parallel RAG operations from the chat route
  const [companyRAG, userRAG, systemRAG] = await Promise.all([
    // Company RAG
    (async () => {
      const start = Date.now();
      const { findRelevantContent } = await import('@/lib/ai/embeddings');
      const results = await findRelevantContent(testQuery, 5);
      const time = Date.now() - start;
      console.log(
        `  ✅ Company RAG completed in ${time}ms - Found ${results.length} results`,
      );
      return results;
    })(),

    // User RAG
    (async () => {
      const start = Date.now();
      const { userRagContextPrompt } = await import('@/lib/ai/prompts');
      const context = await userRagContextPrompt(userId, testQuery);
      const time = Date.now() - start;
      console.log(
        `  ✅ User RAG completed in ${time}ms - Generated ${context.length} chars`,
      );
      return context;
    })(),

    // System RAG (EOS Implementer)
    (async () => {
      const start = Date.now();
      const { upstashSystemRagContextPrompt } = await import(
        '@/lib/ai/upstash-system-rag'
      );
      const context = await upstashSystemRagContextPrompt(
        'vision-building-day-1',
        testQuery,
      );
      const time = Date.now() - start;
      console.log(
        `  ✅ System RAG completed in ${time}ms - Generated ${context.length} chars`,
      );
      return context;
    })(),
  ]);

  const parallelTime = Date.now() - parallelStart;
  console.log(
    `\n  🎯 All parallel RAG operations completed in ${parallelTime}ms\n`,
  );

  // Test hierarchical search parallelization
  console.log('2️⃣ Testing hierarchical namespace search parallelization...\n');

  const { findHierarchicalUpstashSystemContent } = await import(
    '@/lib/ai/upstash-system-rag'
  );

  const namespaces = [
    'eos-implementer-vision-day-1',
    'eos-implementer-vision-day-2',
    'eos-implementer-quarterly-session',
    'eos-implementer-focus-day',
  ];

  const hierarchicalStart = Date.now();
  const hierarchicalResults = await findHierarchicalUpstashSystemContent(
    testQuery,
    namespaces,
    3,
    0.5,
  );
  const hierarchicalTime = Date.now() - hierarchicalStart;

  console.log(
    `  ✅ Hierarchical search across ${namespaces.length} namespaces completed in ${hierarchicalTime}ms`,
  );
  console.log(`  📊 Found ${hierarchicalResults.length} total results\n`);

  // Test embedding generation parallelization
  console.log('3️⃣ Testing parallel embedding generation...\n');

  const testChunks = [
    'This is the first test chunk for embedding generation',
    'This is the second test chunk for embedding generation',
    'This is the third test chunk for embedding generation',
    'This is the fourth test chunk for embedding generation',
    'This is the fifth test chunk for embedding generation',
  ];

  // Sequential embedding generation (for comparison)
  const sequentialStart = Date.now();
  const { embed } = await import('ai');
  const { openai } = await import('@ai-sdk/openai');

  for (const chunk of testChunks) {
    await embed({
      model: openai.embedding('text-embedding-ada-002'),
      value: chunk,
    });
  }
  const sequentialTime = Date.now() - sequentialStart;
  console.log(`  ⏱️  Sequential embedding generation: ${sequentialTime}ms`);

  // Parallel embedding generation
  const parallelEmbedStart = Date.now();
  await Promise.all(
    testChunks.map((chunk) =>
      embed({
        model: openai.embedding('text-embedding-ada-002'),
        value: chunk,
      }),
    ),
  );
  const parallelEmbedTime = Date.now() - parallelEmbedStart;
  console.log(`  ⚡ Parallel embedding generation: ${parallelEmbedTime}ms`);
  console.log(
    `  📈 Speed improvement: ${((sequentialTime / parallelEmbedTime - 1) * 100).toFixed(1)}%\n`,
  );

  // Summary
  console.log('📊 Summary:');
  console.log('  - All RAG operations run in parallel using Promise.all()');
  console.log('  - Hierarchical searches across namespaces are parallelized');
  console.log('  - Embedding generation for document chunks is parallelized');
  console.log(
    '  - Namespace operations use the proper SDK methods for efficiency',
  );
}

testParallelRAG()
  .then(() => {
    console.log('\n✅ Parallel RAG test complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
