import * as dotenv from 'dotenv';
import path from 'node:path';
import { Index } from '@upstash/vector';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function diagnoseWithRestAPI() {
  console.log('🔍 Comprehensive EOS RAG Diagnostics\n');

  const url = process.env.UPSTASH_USER_RAG_REST_URL;
  const token = process.env.UPSTASH_USER_RAG_REST_TOKEN;

  if (!url || !token) {
    throw new Error('Missing UPSTASH_USER_RAG credentials');
  }

  const client = new Index({ url, token });

  try {
    // 1. Check index info directly via REST API
    console.log('1️⃣ Checking index info via REST API...');
    const infoResponse = await fetch(`${url}/info`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const info = await infoResponse.json();
    console.log('Index info:', JSON.stringify(info, null, 2));
    console.log('');

    // 2. List namespaces via REST API
    console.log('2️⃣ Listing namespaces via REST API...');
    const namespacesResponse = await fetch(`${url}/list-namespaces`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const namespaces = await namespacesResponse.json();
    console.log('Namespaces:', namespaces);
    console.log('');

    // 3. Try to fetch vectors from a specific namespace using REST API
    const testNamespace = 'eos-implementer-vision-day-1';
    console.log(
      `3️⃣ Fetching vectors from namespace "${testNamespace}" via REST API...`,
    );

    // Try with prefix
    const fetchPrefixResponse = await fetch(`${url}/fetch/${testNamespace}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prefix: 'eos-implementer-vision-day-1',
        includeMetadata: true,
        includeVectors: false,
      }),
    });
    const fetchPrefixResult = await fetchPrefixResponse.json();
    console.log('Fetch by prefix result:', fetchPrefixResult);
    console.log('');

    // 4. Try range operation
    console.log('4️⃣ Trying range operation...');
    const rangeResponse = await fetch(`${url}/range/${testNamespace}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cursor: '',
        limit: 10,
        includeMetadata: true,
        includeVectors: false,
      }),
    });
    const rangeResult = await rangeResponse.json();
    console.log('Range operation result:', rangeResult);
    console.log('');

    // 5. Try to fetch without namespace
    console.log('5️⃣ Fetching vectors without namespace (default namespace)...');
    const defaultFetchResponse = await fetch(`${url}/fetch`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prefix: 'eos-implementer-vision-day-1',
        includeMetadata: true,
        includeVectors: false,
      }),
    });
    const defaultFetchResult = await defaultFetchResponse.json();
    console.log('Default namespace fetch result:', defaultFetchResult);
    console.log('');

    // 6. Check specific vector IDs
    console.log('6️⃣ Checking specific vector IDs...');
    const testIds = [
      'eos-implementer-vision-day-1-chunk-0',
      'eos-implementer-vision-day-1-EOS-Vision-Building-Day1-Session-Guide-chunk-0',
      'eos-implementer-vision-day-1-vision-day-1.md-chunk-0',
    ];

    for (const id of testIds) {
      const idFetchResponse = await fetch(`${url}/fetch/${testNamespace}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ids: [id],
          includeMetadata: true,
        }),
      });
      const idFetchResult = await idFetchResponse.json();
      console.log(
        `  Fetch ID "${id}":`,
        idFetchResult.result?.[0] ? 'Found' : 'Not found',
      );
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run diagnostics
diagnoseWithRestAPI()
  .then(() => {
    console.log('\n✅ Diagnostics complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Diagnostics failed:', error);
    process.exit(1);
  });
