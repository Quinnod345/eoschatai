import { db } from '@/lib/db';
import { contextUsageLog } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';

async function checkContextLogs() {
  try {
    const logs = await db
      .select()
      .from(contextUsageLog)
      .orderBy(desc(contextUsageLog.createdAt))
      .limit(10);

    console.log('\n📊 Recent Context Usage Logs:\n');
    
    for (const log of logs) {
      console.log('---');
      console.log(`Message ID: ${log.messageId}`);
      console.log(`User Chunks: ${log.userChunks}`);
      console.log(`Persona Chunks: ${log.personaChunks}`);
      console.log(`System Chunks: ${log.systemChunks}`);
      console.log(`Memory Chunks: ${log.memoryChunks}`);
      console.log(`Metadata:`, JSON.stringify(log.metadata, null, 2));
      console.log(`Created: ${log.createdAt}`);
    }

    console.log('\n✅ Done\n');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkContextLogs();


