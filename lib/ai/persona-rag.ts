import { findRelevantUserContent } from './user-rag';
import { db } from '@/lib/db';
import {
  persona,
  personaDocument,
  userDocuments,
  personaComposerDocument,
  personaUserOverlay,
  personaUserOverlayDocument,
} from '@/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { canAccessPersona } from '@/lib/organizations/permissions';

type PersonaOverlayForUser = {
  id: string;
  additionalInstructions: string | null;
  documentIds: string[];
};

const groupChunksByCategoryAndFile = (
  chunks: Array<{ metadata: any; relevance: number; content: string }>,
) => {
  const grouped: Record<string, Record<string, typeof chunks>> = {};
  for (const chunk of chunks) {
    const category = chunk.metadata?.category || 'Other';
    const fileName = chunk.metadata?.fileName || 'Unknown File';
    if (!grouped[category]) {
      grouped[category] = {};
    }
    if (!grouped[category][fileName]) {
      grouped[category][fileName] = [];
    }
    grouped[category][fileName].push(chunk);
  }
  return grouped;
};

export const getPersonaOverlayForUser = async (
  personaId: string,
  userId: string,
): Promise<PersonaOverlayForUser | null> => {
  const [overlay] = await db
    .select({
      id: personaUserOverlay.id,
      additionalInstructions: personaUserOverlay.additionalInstructions,
    })
    .from(personaUserOverlay)
    .where(
      and(
        eq(personaUserOverlay.personaId, personaId),
        eq(personaUserOverlay.userId, userId),
        eq(personaUserOverlay.isActive, true),
      ),
    )
    .limit(1);

  if (!overlay) {
    return null;
  }

  const overlayDocs = await db
    .select({ documentId: personaUserOverlayDocument.documentId })
    .from(personaUserOverlayDocument)
    .where(eq(personaUserOverlayDocument.overlayId, overlay.id));

  return {
    id: overlay.id,
    additionalInstructions: overlay.additionalInstructions,
    documentIds: overlayDocs.map((row) => row.documentId),
  };
};

/**
 * Persona RAG context prompt - gets persona documents via RAG using persona ID as namespace
 * and merges optional per-user overlay content.
 */
export const personaRagContextPrompt = async (
  personaId: string,
  query: string,
  userId: string,
): Promise<{ context: string; chunkCount: number }> => {
  if (!personaId || !query) {
    console.log(
      'Persona RAG context: No personaId or query provided, skipping',
    );
    return { context: '', chunkCount: 0 };
  }

  try {
    console.log(
      `Persona RAG context: Fetching relevant documents for persona ${personaId} with query: "${query}"`,
    );

    if (personaId === 'eos-implementer') {
      console.log(
        'Persona RAG context: Hardcoded EOS implementer persona does not use persona-specific documents',
      );
      return { context: '', chunkCount: 0 };
    }

    const [personaData] = await db
      .select()
      .from(persona)
      .where(eq(persona.id, personaId))
      .limit(1);

    if (!personaData) {
      console.log('Persona RAG context: Persona not found');
      return { context: '', chunkCount: 0 };
    }

    const access = await canAccessPersona(userId, personaData);
    if (!access.canChat) {
      console.log('Persona RAG context: User does not have access to persona');
      return { context: '', chunkCount: 0 };
    }

    if (personaData.knowledgeNamespace?.startsWith('circle-course-')) {
      console.log(
        `Persona RAG context: Circle course persona detected, using Upstash namespace: ${personaData.knowledgeNamespace}`,
      );
      const circleContext = await getCircleCourseContext(
        personaData.knowledgeNamespace,
        query,
        personaData.name,
      );
      return { context: circleContext, chunkCount: circleContext ? 1 : 0 };
    }

    const personaDocs = await db
      .select()
      .from(personaDocument)
      .where(eq(personaDocument.personaId, personaId));
    const composerDocs = await db
      .select()
      .from(personaComposerDocument)
      .where(eq(personaComposerDocument.personaId, personaId));

    let basePersonaDocumentIds = [
      ...personaDocs.map((pd) => pd.documentId),
      ...composerDocs.map((cd) => cd.documentId),
    ];

    try {
      const { userSettings } = await import('@/lib/db/schema');
      const [settings] = await db
        .select()
        .from(userSettings)
        .where(eq(userSettings.userId, userId))
        .limit(1);
      if (settings && (settings.usePrimaryDocsForPersona ?? true)) {
        const primaryIds = [
          settings.primaryAccountabilityId,
          settings.primaryVtoId,
          settings.primaryScorecardId,
        ].filter(Boolean) as string[];
        if (primaryIds.length) {
          basePersonaDocumentIds = Array.from(
            new Set([...basePersonaDocumentIds, ...primaryIds]),
          );
        }
      }
    } catch {}

    const overlay = await getPersonaOverlayForUser(personaId, userId);
    const overlayInstructions =
      personaData.allowUserOverlay && overlay?.additionalInstructions
        ? overlay.additionalInstructions.trim()
        : '';
    const overlayDocumentIds =
      personaData.allowUserKnowledge && overlay
        ? Array.from(new Set(overlay.documentIds))
        : [];
    const personaDocumentIds = Array.from(new Set(basePersonaDocumentIds));

    if (
      personaDocumentIds.length === 0 &&
      overlayDocumentIds.length === 0 &&
      !overlayInstructions
    ) {
      console.log('Persona RAG context: No persona or overlay knowledge found');
      return { context: '', chunkCount: 0 };
    }

    const [personaRelevantDocs, overlayRelevantDocs] = await Promise.all([
      personaDocumentIds.length > 0
        ? findRelevantUserContent(personaId, query, 14, 0.5)
        : Promise.resolve([]),
      overlayDocumentIds.length > 0
        ? findRelevantUserContent(`overlay:${personaId}:${userId}`, query, 10, 0.5)
        : Promise.resolve([]),
    ]);

    const personaIdSet = new Set(personaDocumentIds);
    const overlayIdSet = new Set(overlayDocumentIds);

    const filteredPersonaDocs = personaRelevantDocs.filter((doc) =>
      personaIdSet.has(doc.metadata.documentId),
    );
    const filteredOverlayDocs = overlayRelevantDocs.filter((doc) =>
      overlayIdSet.has(doc.metadata.documentId),
    );

    if (
      filteredPersonaDocs.length === 0 &&
      filteredOverlayDocs.length === 0 &&
      !overlayInstructions
    ) {
      console.log('Persona RAG context: No relevant persona or overlay chunks');
      return { context: '', chunkCount: 0 };
    }

    let contextText = `
## Persona Documents (${personaData.name})
The following are relevant excerpts from this persona's configured knowledge.
`;

    if (overlayInstructions) {
      contextText += `
### User Overlay Instructions
The current user has added the following supplementary instructions:
${overlayInstructions}
`;
    }

    if (filteredPersonaDocs.length > 0) {
      contextText += '\n### Base Persona Knowledge\n';
      const groupedPersonaDocs = groupChunksByCategoryAndFile(filteredPersonaDocs);

      for (const [category, files] of Object.entries(groupedPersonaDocs)) {
        contextText += `\n#### ${category}\n`;
        for (const [fileName, docs] of Object.entries(files)) {
          contextText += `\n**${fileName}** (${docs.length} relevant sections):\n`;
          docs
            .sort((a, b) => b.relevance - a.relevance)
            .slice(0, 3)
            .forEach((doc, index) => {
              contextText += `\n[Relevance: ${(doc.relevance * 100).toFixed(1)}%]\n${doc.content}\n`;
              if (index < docs.length - 1) {
                contextText += '\n---\n';
              }
            });
          contextText += '\n---\n';
        }
      }
    }

    if (filteredOverlayDocs.length > 0) {
      contextText += '\n### User Overlay Knowledge\n';
      const groupedOverlayDocs = groupChunksByCategoryAndFile(filteredOverlayDocs);

      for (const [category, files] of Object.entries(groupedOverlayDocs)) {
        contextText += `\n#### ${category}\n`;
        for (const [fileName, docs] of Object.entries(files)) {
          contextText += `\n**${fileName}** (${docs.length} relevant sections):\n`;
          docs
            .sort((a, b) => b.relevance - a.relevance)
            .slice(0, 3)
            .forEach((doc, index) => {
              contextText += `\n[Relevance: ${(doc.relevance * 100).toFixed(1)}%]\n${doc.content}\n`;
              if (index < docs.length - 1) {
                contextText += '\n---\n';
              }
            });
          contextText += '\n---\n';
        }
      }
    }

    contextText += `
PERSONA DOCUMENT INSTRUCTIONS:
1. Base Persona Knowledge is curated by persona owners/admins.
2. User Overlay Instructions and User Overlay Knowledge are supplementary and should be applied on top of the base persona.
3. Prioritize persona-specific content over generic context when there is overlap.
4. Blend this knowledge naturally into responses without exposing internal retrieval mechanics.
`;

    const totalChunkCount = filteredPersonaDocs.length + filteredOverlayDocs.length;
    console.log(
      `Persona RAG context: Generated ${contextText.length} chars with ${totalChunkCount} chunks (base=${filteredPersonaDocs.length}, overlay=${filteredOverlayDocs.length})`,
    );
    return { context: contextText, chunkCount: totalChunkCount };
  } catch (error) {
    console.error(
      'Persona RAG context: Error fetching persona documents:',
      error,
    );
    return { context: '', chunkCount: 0 };
  }
};

/**
 * Process documents for a persona by storing them in the persona's namespace
 * This is called when documents are associated with a persona
 */
export const processPersonaDocuments = async (
  personaId: string,
  documentIds: string[],
  userId: string,
) => {
  try {
    console.log(
      `Persona RAG: Processing ${documentIds.length} documents for persona ${personaId}`,
    );

    // Check if this is the hardcoded EOS implementer
    if (personaId === 'eos-implementer') {
      console.log(
        'Persona RAG: Skipping document processing for hardcoded EOS implementer',
      );
      return;
    }

    // Check if this is a Circle course persona
    const [personaData] = await db
      .select()
      .from(persona)
      .where(eq(persona.id, personaId))
      .limit(1);

    if (personaData?.knowledgeNamespace?.startsWith('circle-course-')) {
      console.log(
        'Persona RAG: Skipping document processing for Circle course persona (uses pre-synced Upstash data)',
      );
      return;
    }

    // Import the necessary functions
    const { processUserDocument } = await import('./user-rag');

    // Get the documents from the database
    const documents = await db
      .select()
      .from(userDocuments)
      .where(
        and(
          inArray(userDocuments.id, documentIds),
          eq(userDocuments.userId, userId),
        ),
      );

    console.log(
      `Persona RAG: Found ${documents.length} documents to process for persona`,
    );

    // Process each document into the persona's namespace
    for (const doc of documents) {
      if (doc.content) {
        console.log(
          `Persona RAG: Processing document "${doc.fileName}" into persona namespace ${personaId}`,
        );

        await processUserDocument(
          personaId, // Use persona ID as namespace
          doc.id,
          doc.content,
          {
            fileName: doc.fileName,
            category: doc.category,
            fileType: doc.fileType || 'unknown',
          },
        );
      }
    }

    console.log(
      `Persona RAG: Successfully processed ${documents.length} documents for persona ${personaId}`,
    );
  } catch (error) {
    console.error('Persona RAG: Error processing persona documents:', error);
    throw error;
  }
};

export const processPersonaOverlayDocuments = async (
  personaId: string,
  userId: string,
  documentIds: string[],
) => {
  try {
    if (documentIds.length === 0) {
      return;
    }

    const overlayNamespace = `overlay:${personaId}:${userId}`;
    const { processUserDocument } = await import('./user-rag');

    const overlayDocs = await db
      .select()
      .from(userDocuments)
      .where(
        and(
          inArray(userDocuments.id, documentIds),
          eq(userDocuments.userId, userId),
        ),
      );

    for (const doc of overlayDocs) {
      if (!doc.content) continue;
      await processUserDocument(overlayNamespace, doc.id, doc.content, {
        fileName: doc.fileName,
        category: 'Persona Overlay Document',
        fileType: doc.fileType || 'unknown',
      });
    }
  } catch (error) {
    console.error('Persona RAG: Error processing overlay documents:', error);
    throw error;
  }
};

export const deletePersonaOverlayDocuments = async (
  personaId: string,
  userId: string,
) => {
  try {
    const overlayNamespace = `overlay:${personaId}:${userId}`;
    const { deleteUserDocuments } = await import('./user-rag');
    return await deleteUserDocuments(overlayNamespace);
  } catch (error) {
    console.error('Persona RAG: Error deleting overlay documents:', error);
    throw error;
  }
};

/**
 * Delete all documents from a persona's namespace
 * This is called when a persona is deleted
 */
export const deletePersonaDocuments = async (personaId: string) => {
  try {
    console.log(`Persona RAG: Deleting all documents for persona ${personaId}`);

    // Check if this is the hardcoded EOS implementer
    if (personaId === 'eos-implementer') {
      console.log(
        'Persona RAG: Cannot delete documents for hardcoded EOS implementer',
      );
      return { deleted: 0 };
    }

    const { deleteUserDocuments } = await import('./user-rag');

    // Delete all documents from the persona's namespace
    const result = await deleteUserDocuments(personaId);

    console.log(
      `Persona RAG: Deleted ${result.deleted} vectors from persona ${personaId} namespace`,
    );

    return result;
  } catch (error) {
    console.error('Persona RAG: Error deleting persona documents:', error);
    throw error;
  }
};

/**
 * Get context from Circle course stored in Upstash
 * Circle courses use a shared namespace (circle-course-{courseId})
 */
async function getCircleCourseContext(
  namespace: string,
  query: string,
  personaName: string,
): Promise<string> {
  try {
    console.log(
      `Persona RAG: Querying Circle course namespace ${namespace} for query: "${query}"`,
    );

    // Import Upstash and embedding functions
    const { Index } = await import('@upstash/vector');
    const { openai } = await import('@ai-sdk/openai');
    const { embed } = await import('ai');

    // Initialize Upstash client
    const upstashUrl = process.env.UPSTASH_USER_RAG_REST_URL;
    const upstashToken = process.env.UPSTASH_USER_RAG_REST_TOKEN;

    if (!upstashUrl || !upstashToken) {
      console.error('Persona RAG: Missing Upstash environment variables');
      return '';
    }

    const upstashClient = new Index({
      url: upstashUrl,
      token: upstashToken,
    });

    // Get namespace client
    const namespaceClient = upstashClient.namespace(namespace);

    // Generate embedding for query
    const embeddingModel = openai.embedding('text-embedding-ada-002');
    const { embedding } = await embed({
      model: embeddingModel,
      value: query,
    });

    console.log(
      `Persona RAG: Generated ${embedding.length}-dimensional embedding for query`,
    );

    // Query Upstash for relevant content
    const results = await namespaceClient.query({
      vector: embedding,
      topK: 10, // Get top 10 most relevant chunks
      includeMetadata: true,
      includeVectors: false,
    });

    console.log(
      `Persona RAG: Found ${results?.length || 0} results from Circle course namespace`,
    );

    if (!results || results.length === 0) {
      console.log('Persona RAG: No relevant course content found');
      return '';
    }

    // Filter by relevance threshold
    const minRelevance = 0.5;
    const relevantResults = results.filter(
      (result: any) => result.score >= minRelevance,
    );

    console.log(
      `Persona RAG: ${relevantResults.length} results above threshold (${minRelevance * 100}%)`,
    );

    if (relevantResults.length === 0) {
      return '';
    }

    // Build context from results
    let contextText = `
## Course Content (${personaName})
The following are relevant excerpts from the course materials:

`;

    // Group by document if possible
    const documentGroups: Record<string, any[]> = {};
    for (const result of relevantResults) {
      const docTitle: string =
        (result.metadata?.documentTitle as string) || 'Course Material';
      if (!documentGroups[docTitle]) {
        documentGroups[docTitle] = [];
      }
      documentGroups[docTitle].push(result);
    }

    // Add each document section
    for (const docTitle of Object.keys(documentGroups)) {
      const docs = documentGroups[docTitle];
      if (!docs) continue;

      contextText += `\n### ${docTitle}\n`;

      // Sort by relevance and take top chunks
      docs
        .sort((a: any, b: any) => b.score - a.score)
        .slice(0, 3) // Top 3 chunks per document
        .forEach((doc: any, index: number) => {
          const content = doc.metadata?.chunk || '';
          const relevance = (doc.score * 100).toFixed(1);
          contextText += `\n[Relevance: ${relevance}%]\n${content}\n`;
          if (index < docs.length - 1) contextText += '\n---\n';
        });

      contextText += '\n';
    }

    contextText += `
COURSE CONTENT INSTRUCTIONS:
1. This content is from the course materials specifically designed for this persona.
2. Use this information to provide accurate, course-aligned responses.
3. Reference specific lessons or concepts when relevant.
4. If the query is outside the course scope, acknowledge this and provide general guidance.
`;

    console.log(
      `Persona RAG: Generated Circle course context with ${contextText.length} characters`,
    );

    return contextText;
  } catch (error) {
    console.error('Persona RAG: Error fetching Circle course context:', error);
    return '';
  }
}
