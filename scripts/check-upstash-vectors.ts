import { Index } from '@upstash/vector';

async function checkUpstashVectors() {
  try {
    const userRagUrl = process.env.UPSTASH_USER_RAG_REST_URL;
    const userRagToken = process.env.UPSTASH_USER_RAG_REST_TOKEN;

    if (!userRagUrl || !userRagToken) {
      console.log('❌ Missing UPSTASH_USER_RAG environment variables');
      process.exit(1);
    }

    console.log('\n🔍 Checking Upstash User RAG Vectors...\n');
    console.log(`URL: ${userRagUrl}\n`);

    const client = new Index({
      url: userRagUrl,
      token: userRagToken,
    });

    // Try to get info about the index
    const userId = '4963f143-cfdd-4f4b-aaf4-b50a735eca54';
    const namespaceClient = client.namespace(userId);

    console.log(`Checking namespace for user: ${userId}\n`);

    // Try to list vectors using range
    try {
      const rangeResult = await namespaceClient.range({
        cursor: '',
        limit: 10,
        includeMetadata: true,
        includeVectors: false,
      });

      console.log(`Found ${rangeResult.vectors?.length || 0} vectors in namespace`);
      
      if (rangeResult.vectors && rangeResult.vectors.length > 0) {
        console.log('\nSample vectors:');
        for (const v of rangeResult.vectors.slice(0, 5)) {
          console.log(`  ID: ${v.id}`);
          console.log(`  Metadata:`, v.metadata);
          console.log('');
        }
      } else {
        console.log('\n⚠️  No vectors found in this namespace!');
        console.log('   Documents exist in PostgreSQL but not in Upstash.');
        console.log('   Run: npx tsx scripts/reprocess-user-documents.ts');
      }
    } catch (error) {
      console.error('Error querying namespace:', error);
    }

    console.log('\n✅ Done\n');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkUpstashVectors();


