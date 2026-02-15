import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import {
  contextUsageLog,
  userDocuments,
  orgDocument,
  persona,
  personaProfile,
  userMemory,
} from '@/lib/db/schema';
import { eq, inArray, desc, and } from 'drizzle-orm';

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

    // Get context usage log by messageId only.
    // We intentionally do NOT fall back to chatId-based lookup because in
    // multi-message chats, fetching the "most recent" log for the chat could
    // return context from a different assistant message.
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

    if (contextLog.userId !== session.user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
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

    // Add organization knowledge if used
    const orgChunks =
      typeof metadata.orgChunks === 'number' ? metadata.orgChunks : 0;
    if (orgChunks > 0) {
      let orgDocs: Array<{ id: string; fileName: string }> = [];

      if (Array.isArray(metadata.orgDocumentIds) && metadata.orgDocumentIds.length > 0) {
        orgDocs = await db
          .select({
            id: orgDocument.id,
            fileName: orgDocument.fileName,
          })
          .from(orgDocument)
          .where(inArray(orgDocument.id, metadata.orgDocumentIds));
      }

      const fallbackItems = Array.isArray(metadata.orgDocumentNames)
        ? metadata.orgDocumentNames.map((name: string, index: number) => ({
            id: `org-doc-${index}`,
            name,
            category: 'Org Document',
          }))
        : [];

      sources.push({
        type: 'org',
        icon: 'Building2',
        label: 'Organization Knowledge',
        count: orgChunks,
        items:
          orgDocs.length > 0
            ? orgDocs.map((doc) => ({
                id: doc.id,
                name: doc.fileName,
                category: 'Org Document',
              }))
            : fallbackItems,
      });
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
      const trackedMemoryIds = Array.isArray(metadata.memoryIds)
        ? metadata.memoryIds.filter((id: unknown) => typeof id === 'string')
        : [];
      const memorySourceCounts =
        metadata.memorySourceCounts &&
        typeof metadata.memorySourceCounts === 'object'
          ? metadata.memorySourceCounts
          : null;

      let memories: Array<{
        id: string;
        summary: string;
        content: string | null;
        memoryType: string | null;
      }> = [];
      let memoryLabel = 'Your Memories';
      let memoryDescription = 'Retrieved for response context';

      if (trackedMemoryIds.length > 0) {
        const memoryRows = await db
          .select({
            id: userMemory.id,
            summary: userMemory.summary,
            content: userMemory.content,
            memoryType: userMemory.memoryType,
          })
          .from(userMemory)
          .where(
            and(
              eq(userMemory.userId, session.user.id),
              inArray(
                userMemory.id,
                trackedMemoryIds as [string, ...string[]] | string[],
              ),
            ),
          );

        // Preserve original logged order where possible.
        const memoryById = new Map(memoryRows.map((memory) => [memory.id, memory]));
        memories = trackedMemoryIds
          .map((id: string) => memoryById.get(id))
          .filter(Boolean) as typeof memories;
      } else {
        // Legacy fallback path for logs created before memoryIds were tracked.
        const fallbackLimit = Math.min(Math.max(contextLog.memoryChunks, 1), 10);
        memories = await db
          .select({
            id: userMemory.id,
            summary: userMemory.summary,
            content: userMemory.content,
            memoryType: userMemory.memoryType,
          })
          .from(userMemory)
          .where(eq(userMemory.userId, session.user.id))
          .orderBy(desc(userMemory.createdAt))
          .limit(fallbackLimit);

        memoryLabel = 'Recent Memory Context (fallback)';
        memoryDescription =
          'Exact memory IDs were not tracked for this older response.';
      }

      const semanticCount =
        typeof memorySourceCounts?.semantic === 'number'
          ? memorySourceCounts.semantic
          : 0;
      const recentCount =
        typeof memorySourceCounts?.recent === 'number'
          ? memorySourceCounts.recent
          : 0;
      const unembeddedCount =
        typeof memorySourceCounts?.unembedded === 'number'
          ? memorySourceCounts.unembedded
          : 0;

      if (semanticCount || recentCount || unembeddedCount) {
        memoryDescription += ` (semantic: ${semanticCount}, recent: ${recentCount}${
          unembeddedCount ? `, unembedded: ${unembeddedCount}` : ''
        })`;
      }

      sources.push({
        type: 'memory',
        icon: 'Brain',
        label: memoryLabel,
        description: memoryDescription,
        count: contextLog.memoryChunks,
        breakdown: {
          semantic: semanticCount,
          recent: recentCount,
          unembedded: unembeddedCount,
        },
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
          (typeof metadata.orgChunks === 'number' ? metadata.orgChunks : 0) +
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

