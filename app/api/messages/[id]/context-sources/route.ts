import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import { contextUsageLog, userDocuments, persona, personaProfile, userMemory } from '@/lib/db/schema';
import { eq, inArray, desc } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: messageId } = await params;

    // Get context usage log for this message
    const [contextLog] = await db
      .select()
      .from(contextUsageLog)
      .where(eq(contextUsageLog.messageId, messageId))
      .limit(1);

    if (!contextLog) {
      return NextResponse.json({
        hasContext: false,
        sources: [],
      });
    }

    const sources: any[] = [];
    const metadata = (contextLog.metadata as any) || {};

    // Add user documents if used
    if (contextLog.userChunks && contextLog.userChunks > 0) {
      // Get document IDs from metadata if available
      let documentIds: string[] = [];
      
      if (metadata.userDocumentIds && Array.isArray(metadata.userDocumentIds)) {
        documentIds = metadata.userDocumentIds;
      }

      // ONLY fetch and show documents if we have specific IDs
      // Don't use fallback logic - if no IDs were tracked, don't show anything
      if (documentIds.length > 0) {
        const userDocs = await db
          .select({
            id: userDocuments.id,
            fileName: userDocuments.fileName,
            category: userDocuments.category,
          })
          .from(userDocuments)
          .where(inArray(userDocuments.id, documentIds));
        
        console.log(`Context Sources: Found ${userDocs.length} specific documents that were actually used`);

        if (userDocs.length > 0) {
          sources.push({
            type: 'documents',
            icon: 'FileText',
            label: 'Your Documents',
            count: contextLog.userChunks,
            items: userDocs.map((doc) => ({
              id: doc.id,
              name: doc.fileName,
              category: doc.category,
            })),
          });
        }
      } else {
        console.log(`Context Sources: userChunks=${contextLog.userChunks} but no document IDs in metadata - skipping document display`);
      }
    }

    // Add persona knowledge if used
    if (contextLog.personaChunks && contextLog.personaChunks > 0) {
      if (metadata?.personaId) {
        const [personaData] = await db
          .select({ name: persona.name })
          .from(persona)
          .where(eq(persona.id, metadata.personaId))
          .limit(1);

        if (personaData) {
          sources.push({
            type: 'persona',
            icon: 'User',
            label: `${personaData.name}`,
            count: contextLog.personaChunks,
            description: 'Persona Knowledge Base',
            items: [],
          });
        }
      } else {
        sources.push({
          type: 'persona',
          icon: 'User',
          label: 'Persona Knowledge',
          count: contextLog.personaChunks,
          items: [],
        });
      }
    }

    // Add system knowledge if used (only for specific persona/profile knowledge, NOT company RAG)
    if (contextLog.systemChunks && contextLog.systemChunks > 0) {
      // Only show system knowledge if it's from a specific persona profile
      if (metadata?.profileId) {
        const [profileData] = await db
          .select({ name: personaProfile.name })
          .from(personaProfile)
          .where(eq(personaProfile.id, metadata.profileId))
          .limit(1);

        if (profileData) {
          sources.push({
            type: 'system',
            icon: 'Database',
            label: profileData.name,
            description: 'Knowledge Base',
            count: contextLog.systemChunks,
            items: [],
          });
        }
      }
      // Note: We explicitly DO NOT show company RAG (EOS documents) as a context source
      // as per user request - only show user-specific personalized context
    }

    // Add memories if used - with actual memory content
    if (contextLog.memoryChunks && contextLog.memoryChunks > 0) {
      // Get the user's active memories
      const memories = await db
        .select({
          id: userMemory.id,
          summary: userMemory.summary,
          content: userMemory.content,
          memoryType: userMemory.memoryType,
        })
        .from(userMemory)
        .where(eq(userMemory.userId, session.user.id))
        .orderBy(desc(userMemory.createdAt))
        .limit(10);

      sources.push({
        type: 'memory',
        icon: 'Brain',
        label: 'Your Memories',
        count: contextLog.memoryChunks,
        items: memories.map((mem) => ({
          id: mem.id,
          name: mem.summary,
          category: mem.memoryType || 'knowledge',
          content: mem.content?.substring(0, 100) || mem.summary,
        })),
      });
    }

    // Add conversation history if used
    if (contextLog.conversationSummaryUsed) {
      sources.push({
        type: 'conversation',
        icon: 'MessageSquare',
        label: 'Conversation History',
        count: 1,
        items: [],
      });
    }

    return NextResponse.json({
      hasContext: sources.length > 0,
      sources,
      stats: {
        totalChunks:
          (contextLog.systemChunks || 0) +
          (contextLog.personaChunks || 0) +
          (contextLog.userChunks || 0) +
          (contextLog.memoryChunks || 0),
        tokens: contextLog.contextTokens || 0,
        model: contextLog.model,
      },
    });
  } catch (error) {
    console.error('Error fetching context sources:', error);
    return NextResponse.json(
      { error: 'Failed to fetch context sources' },
      { status: 500 },
    );
  }
}

