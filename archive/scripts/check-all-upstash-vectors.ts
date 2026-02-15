import { Index } from '@upstash/vector';

async function checkAllUpstashVectors() {
  try {
    const userRagUrl = process.env.UPSTASH_USER_RAG_REST_URL;
    const userRagToken = process.env.UPSTASH_USER_RAG_REST_TOKEN;

    if (!userRagUrl || !userRagToken) {
      console.log('❌ Missing UPSTASH_USER_RAG environment variables');
      process.exit(1);
    }

    console.log('\n🔍 Checking ALL Upstash vectors...\n');

    const client = new Index({
      url: userRagUrl,
      token: userRagToken,
    });

    const userId = '4963f143-cfdd-4f4b-aaf4-b50a735eca54';
    const namespaceClient = client.namespace(userId);

    console.log(`Fetching all vectors for user: ${userId}\n`);

    let allVectors: any[] = [];
    let cursor = '';
    let pageNum = 1;

    do {
      const rangeResult = await namespaceClient.range({
        cursor,
        limit: 100,
        includeMetadata: true,
        includeVectors: false,
      });

      const vectors = rangeResult.vectors || [];
      allVectors.push(...vectors);

      console.log(`Page ${pageNum}: Found ${vectors.length} vectors`);
      
      cursor = rangeResult.nextCursor || '';
      pageNum++;
    } while (cursor);

    console.log(`\n📊 Total vectors: ${allVectors.length}\n`);

    // Group by document
    const byDocument = new Map<string, any[]>();
    for (const v of allVectors) {
      const docId = v.metadata?.documentId || 'unknown';
      if (!byDocument.has(docId)) {
        byDocument.set(docId, []);
      }
      byDocument.get(docId)!.push(v);
    }

    console.log(`📁 Documents:\n`);
    for (const [docId, vectors] of byDocument.entries()) {
      const fileName = vectors[0]?.metadata?.fileName || 'Unknown';
      const category = vectors[0]?.metadata?.category || 'Unknown';
      console.log(`  ${fileName} (${category})`);
      console.log(`    Document ID: ${docId}`);
      console.log(`    Vectors: ${vectors.length}`);
      console.log('');
    }

    console.log('\n✅ Done\n');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkAllUpstashVectors();


