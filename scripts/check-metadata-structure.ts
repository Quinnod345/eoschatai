import * as dotenv from 'dotenv';
import path from 'node:path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function checkMetadataStructure() {
  const url = process.env.UPSTASH_USER_RAG_REST_URL;
  const token = process.env.UPSTASH_USER_RAG_REST_TOKEN;

  if (!url || !token) {
    throw new Error('Missing UPSTASH_USER_RAG credentials');
  }

  const testNamespace = 'eos-implementer-vision-day-1';
  const testId =
    'eos-implementer-vision-day-1-EOS-Annual-Session-Guide.pdf-chunk-0';

  console.log(
    `Fetching vector "${testId}" from namespace "${testNamespace}"...`,
  );

  const response = await fetch(`${url}/fetch/${testNamespace}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ids: [testId],
      includeMetadata: true,
      includeVectors: false,
    }),
  });

  const result = await response.json();

  if (result.result?.[0]) {
    console.log('\nVector found!');
    console.log('ID:', result.result[0].id);
    console.log(
      '\nMetadata:',
      JSON.stringify(result.result[0].metadata, null, 2),
    );
  } else {
    console.log('Vector not found');
  }
}

checkMetadataStructure()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
