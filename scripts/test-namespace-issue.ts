import * as dotenv from 'dotenv';
import path from 'node:path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function testNamespaceIssue() {
  const url = process.env.UPSTASH_USER_RAG_REST_URL;
  const token = process.env.UPSTASH_USER_RAG_REST_TOKEN;

  if (!url || !token) {
    throw new Error('Missing UPSTASH_USER_RAG credentials');
  }

  const namespace = 'eos-implementer-vision-day-1';

  console.log('🔍 Testing namespace handling with REST API directly\n');

  // 1. Test query with namespace in URL
  console.log('1️⃣ Testing query with namespace in URL path...');

  // Generate a simple embedding
  const testVector = new Array(1536).fill(0.1);

  const queryResponse = await fetch(`${url}/query/${namespace}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      vector: testVector,
      topK: 5,
      includeMetadata: true,
    }),
  });

  const queryResult = await queryResponse.json();
  console.log('Query response:', JSON.stringify(queryResult, null, 2));

  // 2. Test range with namespace in URL
  console.log('\n2️⃣ Testing range with namespace in URL path...');

  const rangeResponse = await fetch(`${url}/range/${namespace}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      cursor: '',
      limit: 5,
      includeMetadata: true,
      includeVectors: false,
    }),
  });

  const rangeResult = await rangeResponse.json();
  console.log(
    'Range response (first 500 chars):',
    `${JSON.stringify(rangeResult, null, 2).substring(0, 500)}...`,
  );

  if (rangeResult.result?.vectors) {
    console.log(
      `\nFound ${rangeResult.result.vectors.length} vectors via range`,
    );
  }

  // 3. Test with SDK using namespace method
  console.log('\n3️⃣ Testing with SDK namespace method...');
  const { Index } = await import('@upstash/vector');
  const client = new Index({ url, token });

  // Use the namespace method
  const ns = client.namespace(namespace);

  const sdkRangeResult = await ns.range({
    cursor: '',
    limit: 5,
    includeMetadata: true,
    includeVectors: false,
  });

  console.log(
    `SDK namespace method found ${sdkRangeResult.vectors?.length || 0} vectors`,
  );

  // 4. Try query with SDK namespace method
  const sdkQueryResult = await ns.query({
    vector: testVector,
    topK: 5,
    includeMetadata: true,
  });

  console.log(`SDK namespace query found ${sdkQueryResult.length} results`);
}

testNamespaceIssue()
  .then(() => {
    console.log('\n✅ Test complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
