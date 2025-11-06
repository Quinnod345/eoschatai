import { findRelevantUserContent } from './user-rag';
import { db } from '@/lib/db';
import {
  persona,
  personaDocument,
  userDocuments,
  personaComposerDocument,
} from '@/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';

/**
 * Persona RAG context prompt - gets persona documents via RAG using persona ID as namespace
 * This function retrieves documents that were associated with the persona during creation
 */
export const personaRagContextPrompt = async (
  personaId: string,
  query: string,
  userId: string,
) => {
  if (!personaId || !query) {
    console.log(
      'Persona RAG context: No personaId or query provided, skipping',
    );
    return '';
  }

  try {
    console.log(
      `Persona RAG context: Fetching relevant documents for persona ${personaId} with query: "${query}"`,
    );

    // Check if this is the hardcoded EOS implementer
    if (personaId === 'eos-implementer') {
      console.log(
        'Persona RAG context: Hardcoded EOS implementer persona does not use persona-specific documents',
      );
      return '';
    }

    // First, verify the persona exists and is accessible
    // System personas (userId: null) are accessible to all users
    const [personaData] = await db
      .select()
      .from(persona)
      .where(eq(persona.id, personaId))
      .limit(1);

    if (!personaData) {
      console.log('Persona RAG context: Persona not found');
      return '';
    }

    // Verify authorization: persona must either be a system persona or belong to the user
    if (personaData.userId !== null && personaData.userId !== userId) {
      console.log(
        'Persona RAG context: Persona is not a system persona and does not belong to user',
      );
      return '';
    }

    // Check if this is a Circle course persona (uses shared Upstash namespace)
    if (personaData.knowledgeNamespace?.startsWith('circle-course-')) {
      console.log(
        `Persona RAG context: Circle course persona detected, using Upstash namespace: ${personaData.knowledgeNamespace}`,
      );
      return await getCircleCourseContext(
        personaData.knowledgeNamespace,
        query,
        personaData.name,
      );
    }

    // Get the document IDs associated with this persona (uploaded user docs)
    const personaDocs = await db
      .select()
      .from(personaDocument)
      .where(eq(personaDocument.personaId, personaId));

    // Get composer document IDs associated with this persona (AI-generated docs)
    const composerDocs = await db
      .select()
      .from(personaComposerDocument)
      .where(eq(personaComposerDocument.personaId, personaId));

    let documentIds = [
      ...personaDocs.map((pd) => pd.documentId),
      ...composerDocs.map((cd) => cd.documentId),
    ];

    // Merge in primary composer documents if the user has enabled it in settings.
    // We intentionally do NOT merge global personaContextDocumentIds to avoid cross-persona leakage.
    try {
      const { userSettings } = await import('@/lib/db/schema');
      const { eq } = await import('drizzle-orm');
      const [settings] = await db
        .select()
        .from(userSettings)
        .where(eq(userSettings.userId, userId))
        .limit(1);
      if (settings) {
        const includePrimaries = settings.usePrimaryDocsForPersona ?? true;
        if (includePrimaries) {
          const primaryIds = [
            settings.primaryAccountabilityId,
            settings.primaryVtoId,
            settings.primaryScorecardId,
          ].filter(Boolean) as string[];
          if (primaryIds.length) {
            documentIds = Array.from(new Set([...documentIds, ...primaryIds]));
          }
        }
      }
    } catch {}
    documentIds = Array.from(new Set(documentIds));
    if (documentIds.length === 0) {
      console.log(
        'Persona RAG context: No documents associated with this persona',
      );
      return '';
    }

    console.log(
      `Persona RAG context: Found ${documentIds.length} documents associated with persona "${personaData.name}"`,
    );

    // Get document metadata for better context
    const documents = await db
      .select()
      .from(userDocuments)
      .where(inArray(userDocuments.id, documentIds));

    // Search for relevant content using the persona ID as namespace
    // This allows personas to have their own vector space for documents
    const relevantDocs = await findRelevantUserContent(
      personaId, // Use persona ID as namespace instead of user ID
      query,
      14, // Get more results for personas
      0.5, // Lower threshold for better recall
    );

    console.log(
      `Persona RAG context: Found ${relevantDocs.length} relevant document chunks for persona`,
    );

    if (!relevantDocs || relevantDocs.length === 0) {
      console.log(
        'Persona RAG context: No relevant documents found in persona namespace',
      );
      return '';
    }

    // Filter results to only include documents associated with this persona
    const personaDocumentIds = new Set(documentIds);
    const filteredDocs = relevantDocs.filter((doc) =>
      personaDocumentIds.has(doc.metadata.documentId),
    );

    console.log(
      `Persona RAG context: Filtered to ${filteredDocs.length} chunks from persona-associated documents`,
    );

    if (filteredDocs.length === 0) {
      return '';
    }

    // Group documents by category and file
    const documentsByCategory: Record<string, Record<string, any[]>> = {};
    for (const doc of filteredDocs) {
      const category = doc.metadata.category || 'Other';
      const fileName = doc.metadata.fileName || 'Unknown File';

      if (!documentsByCategory[category]) {
        documentsByCategory[category] = {};
      }
      if (!documentsByCategory[category][fileName]) {
        documentsByCategory[category][fileName] = [];
      }
      documentsByCategory[category][fileName].push(doc);
    }

    console.log(
      `Persona RAG context: Grouped into ${
        Object.keys(documentsByCategory).length
      } categories for persona "${personaData.name}": ${Object.keys(documentsByCategory).join(', ')}`,
    );

    // Build the context prompt
    let contextText = `
## Persona Documents (${personaData.name})
The following are relevant excerpts from documents specifically associated with the "${personaData.name}" persona:
`;

    // Add each category section
    for (const [category, files] of Object.entries(documentsByCategory)) {
      contextText += `\n### ${category}\n`;
      console.log(
        `Persona RAG context: Adding ${Object.keys(files).length} files for category ${category}`,
      );

      // Add each file in the category
      for (const [fileName, docs] of Object.entries(files)) {
        contextText += `\n**${fileName}** (${docs.length} relevant sections):\n`;

        // Add the most relevant chunks from this file
        docs
          .sort((a, b) => b.relevance - a.relevance) // Sort by relevance
          .slice(0, 3) // Take top 3 chunks per file
          .forEach((doc, index) => {
            contextText += `\n[Relevance: ${(doc.relevance * 100).toFixed(1)}%]\n${doc.content}\n`;
            if (index < docs.length - 1) contextText += '\n---\n';
          });

        contextText += '\n---\n';
      }
    }

    contextText += `
PERSONA DOCUMENT INSTRUCTIONS:
1. These documents were specifically selected for the "${personaData.name}" persona during setup.
2. They contain specialized knowledge and context that should guide your responses when acting as this persona.
3. PRIORITIZE this persona-specific content over general user documents when there's overlap.
4. Use this information to provide expert-level responses aligned with the persona's role and expertise.
5. The persona's custom instructions should be applied in conjunction with these documents.
`;

    console.log(
      `Persona RAG context: Generated context for persona "${personaData.name}" with ${contextText.length} characters`,
    );
    return contextText;
  } catch (error) {
    console.error(
      'Persona RAG context: Error fetching persona documents:',
      error,
    );
    return '';
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
