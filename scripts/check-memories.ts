import { db } from '@/lib/db';
import { userMemory, user } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

async function checkMemories() {
  try {
    // Get your user ID
    const [currentUser] = await db
      .select()
      .from(user)
      .where(eq(user.email, 'quinn@odonnell.one'))
      .limit(1);

    if (!currentUser) {
      console.log('User not found');
      process.exit(1);
    }

    console.log(`\n🧠 Checking memories for user: ${currentUser.email}\n`);

    const memories = await db
      .select()
      .from(userMemory)
      .where(eq(userMemory.userId, currentUser.id));

    console.log(`Found ${memories.length} total memories\n`);

    for (const memory of memories) {
      console.log('---');
      console.log(`ID: ${memory.id}`);
      console.log(`Summary: ${memory.summary}`);
      console.log(`Content: ${memory.content?.substring(0, 200) || 'N/A'}`);
      console.log(`Type: ${memory.memoryType}`);
      console.log(`Topic: ${memory.topic || 'N/A'}`);
      console.log(`Confidence: ${memory.confidence}`);
      console.log(`Status: ${memory.status}`);
      console.log(`Created: ${memory.createdAt}`);
      console.log('');
    }

    console.log('\n✅ Done\n');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkMemories();


