import { db } from '@/lib/db';
import { userMemory, user } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

async function checkMemoryLeak() {
  try {
    console.log('\n🔍 Checking for memory leak issue...\n');

    // Get the memories
    const memories = await db
      .select()
      .from(userMemory);

    console.log(`Total memories in database: ${memories.length}\n`);

    // Get the users
    const users = await db
      .select({ id: user.id, email: user.email })
      .from(user)
      .limit(10);

    console.log('Users:');
    for (const u of users) {
      console.log(`  ${u.email} → ${u.id}`);
    }

    console.log('\nMemories:');
    for (const mem of memories) {
      const [userInfo] = await db
        .select({ email: user.email })
        .from(user)
        .where(eq(user.id, mem.userId))
        .limit(1);

      console.log(`  "${mem.summary}" → User: ${userInfo?.email || mem.userId}`);
      console.log(`    User ID: ${mem.userId}`);
    }

    // Check if the chat user matches the memory user
    const chatUserId = '4963f143-cfdd-4f4b-aaf4-b50a735eca54';
    const [chatUser] = await db
      .select({ email: user.email })
      .from(user)
      .where(eq(user.id, chatUserId))
      .limit(1);

    console.log(`\nChat User: ${chatUser?.email} (${chatUserId})`);
    console.log(`Memories for chat user: ${memories.filter(m => m.userId === chatUserId).length}`);

    console.log('\n✅ Done\n');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkMemoryLeak();


