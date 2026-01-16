import { db } from '@/lib/db';
import { userMemory, user, userMemoryEmbedding } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

async function findAllMemories() {
  try {
    console.log('\n🔍 Searching for ALL memories in database...\n');

    const memories = await db
      .select({
        id: userMemory.id,
        userId: userMemory.userId,
        summary: userMemory.summary,
        content: userMemory.content,
        status: userMemory.status,
        memoryType: userMemory.memoryType,
        confidence: userMemory.confidence,
      })
      .from(userMemory)
      .limit(50);

    console.log(`Found ${memories.length} total memories\n`);

    for (const mem of memories) {
      const [userInfo] = await db
        .select({ email: user.email })
        .from(user)
        .where(eq(user.id, mem.userId))
        .limit(1);

      // Check if it has embeddings
      const [embCount] = await db
        .select({ count: userMemoryEmbedding.id })
        .from(userMemoryEmbedding)
        .where(eq(userMemoryEmbedding.memoryId, mem.id))
        .limit(1);

      console.log('---');
      console.log(`Summary: ${mem.summary}`);
      console.log(`Content: ${mem.content?.substring(0, 100) || 'N/A'}`);
      console.log(`User: ${userInfo?.email || mem.userId}`);
      console.log(`Status: ${mem.status}`);
      console.log(`Type: ${mem.memoryType}`);
      console.log(`Confidence: ${mem.confidence}`);
      console.log(`Has Embeddings: ${!!embCount?.count}`);
      console.log('');
    }

    console.log('\n✅ Done\n');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

findAllMemories();


