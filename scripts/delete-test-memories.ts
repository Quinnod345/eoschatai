import { db } from '@/lib/db';
import { userMemory, userMemoryEmbedding } from '@/lib/db/schema';
import { inArray } from 'drizzle-orm';

async function deleteTestMemories() {
  try {
    console.log('\n🗑️  Deleting test memories...\n');

    // Get the test memories
    const memories = await db
      .select({ id: userMemory.id, summary: userMemory.summary })
      .from(userMemory);

    const testMemoryIds = memories
      .filter(
        (m) =>
          m.summary.includes('Sushi') ||
          m.summary.includes('Potatoes') ||
          m.summary.includes('test') ||
          m.summary.includes('Test'),
      )
      .map((m) => m.id);

    if (testMemoryIds.length === 0) {
      console.log('No test memories found');
      process.exit(0);
    }

    console.log(`Found ${testMemoryIds.length} test memories to delete:`);
    for (const mem of memories.filter((m) => testMemoryIds.includes(m.id))) {
      console.log(`  - ${mem.summary}`);
    }

    // Delete embeddings first
    await db
      .delete(userMemoryEmbedding)
      .where(inArray(userMemoryEmbedding.memoryId, testMemoryIds));

    // Delete memories
    await db.delete(userMemory).where(inArray(userMemory.id, testMemoryIds));

    console.log(`\n✅ Deleted ${testMemoryIds.length} test memories\n`);
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

deleteTestMemories();


