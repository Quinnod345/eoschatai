import { db } from '@/lib/db';
import { systemEmbeddings } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { openai } from '@ai-sdk/openai';
import { embed } from 'ai';

/**
 * Find relevant content from the system knowledge base (EOS Implementer)
 * @param query - The search query
 * @param namespace - The knowledge namespace (e.g., 'eos-implementer', 'eos-implementer-vision-day-1')
 * @param limit - Maximum number of results to return
 * @param threshold - Minimum similarity threshold (0-1)
 * @returns Array of relevant content chunks with metadata
 */
export async function findSystemContent(
  query: string,
  namespace: string,
  limit = 5,
  threshold = 0.55,
  precomputedEmbedding?: number[],
): Promise<
  Array<{
    content: string;
    title: string;
    relevance: number;
    metadata?: any;
  }>
> {
  try {
    console.log(
      `System RAG: Searching namespace "${namespace}" for: "${query}"`,
    );

    // Reuse embedding when provided by caller to avoid duplicate generation.
    const embedding =
      Array.isArray(precomputedEmbedding) && precomputedEmbedding.length > 0
        ? precomputedEmbedding
        : (
            await embed({
              model: openai.embedding('text-embedding-3-small'),
              value: query,
            })
          ).embedding;

    // Search for similar content in the specified namespace
    const results = await db
      .select({
        id: systemEmbeddings.id,
        chunk: systemEmbeddings.chunk,
        title: systemEmbeddings.title,
        metadata: systemEmbeddings.metadata,
        similarity: sql<number>`1 - (${systemEmbeddings.embedding} <=> ${JSON.stringify(embedding)})`,
      })
      .from(systemEmbeddings)
      .where(
        and(
          eq(systemEmbeddings.namespace, namespace),
          sql`1 - (${systemEmbeddings.embedding} <=> ${JSON.stringify(embedding)}) > ${threshold}`,
        ),
      )
      .orderBy(
        sql`1 - (${systemEmbeddings.embedding} <=> ${JSON.stringify(embedding)}) DESC`,
      )
      .limit(limit);

    console.log(
      `System RAG: Found ${results.length} results in namespace "${namespace}"`,
    );

    return results.map((result) => ({
      content: result.chunk,
      title: result.title,
      relevance: result.similarity,
      metadata: result.metadata,
    }));
  } catch (error) {
    console.error('System RAG: Error finding system content:', error);
    return [];
  }
}

/**
 * Find relevant content from multiple namespaces (hierarchical search)
 * @param query - The search query
 * @param namespaces - Array of namespaces to search, in priority order
 * @param limit - Maximum number of results per namespace
 * @param threshold - Minimum similarity threshold
 * @returns Combined results from all namespaces
 */
export async function findHierarchicalSystemContent(
  query: string,
  namespaces: string[],
  limit = 3,
  threshold = 0.55,
  precomputedEmbedding?: number[],
): Promise<
  Array<{
    content: string;
    title: string;
    relevance: number;
    namespace: string;
    metadata?: any;
  }>
> {
  try {
    console.log(
      `System RAG: Hierarchical search across namespaces: ${namespaces.join(', ')}`,
    );

    const allResults: Array<{
      content: string;
      title: string;
      relevance: number;
      namespace: string;
      metadata?: any;
    }> = [];

    // Search each namespace
    for (const namespace of namespaces) {
      const results = await findSystemContent(
        query,
        namespace,
        limit,
        threshold,
        precomputedEmbedding,
      );

      // Add namespace info to results
      const namespacedResults = results.map((result) => ({
        ...result,
        namespace,
      }));

      allResults.push(...namespacedResults);
    }

    // Sort all results by relevance
    allResults.sort((a, b) => b.relevance - a.relevance);

    console.log(
      `System RAG: Combined ${allResults.length} results from hierarchical search`,
    );

    return allResults;
  } catch (error) {
    console.error('System RAG: Error in hierarchical search:', error);
    return [];
  }
}

/**
 * Add content to the system knowledge base
 * @param namespace - The knowledge namespace
 * @param title - Document title
 * @param content - Document content
 * @param metadata - Additional metadata
 */
export async function addSystemContent(
  namespace: string,
  title: string,
  content: string,
  metadata?: any,
): Promise<void> {
  try {
    console.log(
      `System RAG: Adding content to namespace "${namespace}": "${title}"`,
    );

    // Split content into chunks (simple implementation)
    const chunks = splitIntoChunks(content, 1000, 200);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];

      // Generate embedding for the chunk
      const { embedding } = await embed({
        model: openai.embedding('text-embedding-3-small'),
        value: chunk,
      });

      // Store in database
      await db.insert(systemEmbeddings).values({
        namespace,
        title: chunks.length > 1 ? `${title} (Part ${i + 1})` : title,
        chunk,
        embedding,
        metadata: {
          ...metadata,
          chunkIndex: i,
          totalChunks: chunks.length,
        },
      });
    }

    console.log(
      `System RAG: Added ${chunks.length} chunks for "${title}" to namespace "${namespace}"`,
    );
  } catch (error) {
    console.error('System RAG: Error adding system content:', error);
    throw error;
  }
}

/**
 * Split text into overlapping chunks
 */
function splitIntoChunks(
  text: string,
  chunkSize: number,
  overlap: number,
): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const chunk = text.slice(start, end);
    chunks.push(chunk);

    if (end === text.length) break;
    start = end - overlap;
  }

  return chunks;
}

/**
 * Generate RAG context prompt for system personas
 */
export async function systemRagContextPrompt(
  personaId: string,
  profileId: string | null,
  query: string,
  precomputedEmbedding?: number[],
): Promise<{ context: string; chunkCount: number }> {
  try {
    console.log(
      `System RAG: Generating context for persona ${personaId}, profile ${profileId}`,
    );

    // Get persona and profile information
    const { persona, personaProfile } = await import('@/lib/db/schema');

    const [personaData] = await db
      .select()
      .from(persona)
      .where(eq(persona.id, personaId))
      .limit(1);

    if (!personaData || !personaData.isSystemPersona) {
      console.log('System RAG: Not a system persona, skipping');
      return { context: '', chunkCount: 0 };
    }

    const namespaces: string[] = [personaData.knowledgeNamespace].filter(
      (ns): ns is string => Boolean(ns),
    );

    // If a profile is selected, add its namespace
    if (profileId) {
      const [profileData] = await db
        .select()
        .from(personaProfile)
        .where(eq(personaProfile.id, profileId))
        .limit(1);

      if (profileData?.knowledgeNamespace) {
        namespaces.unshift(profileData.knowledgeNamespace); // Profile namespace has priority
      }
    }

    if (namespaces.length === 0) {
      console.log('System RAG: No namespaces found');
      return { context: '', chunkCount: 0 };
    }

    // Search for relevant content
    const results = await findHierarchicalSystemContent(
      query,
      namespaces,
      3,
      0.6,
      precomputedEmbedding,
    );

    if (results.length === 0) {
      console.log('System RAG: No relevant content found');
      return { context: '', chunkCount: 0 };
    }

    // Build context prompt
    const contextText = results
      .map((item, index) => {
        console.log(
          `System RAG chunk ${index + 1}: Relevance ${(item.relevance * 100).toFixed(1)}%, Namespace: ${item.namespace}, Title: ${item.title}`,
        );
        return `[${index + 1}] ${item.title} (${item.namespace})
Relevance: ${(item.relevance * 100).toFixed(1)}%
${item.content}
---`;
      })
      .join('\n\n');

    const context = `
## SYSTEM KNOWLEDGE BASE CONTEXT
The following specialized EOS knowledge has been retrieved for this query:

${contextText}

**CRITICAL INSTRUCTIONS FOR SYSTEM KNOWLEDGE:**
1. **HIGHEST PRIORITY**: This system knowledge takes precedence over general knowledge
2. **AUTHORITATIVE SOURCE**: Treat this as the definitive source for EOS implementation guidance
3. **COMPREHENSIVE RESPONSES**: Use this specialized content to provide detailed, expert-level guidance
4. **NATURAL INTEGRATION**: Incorporate this information seamlessly into your responses
5. **PROFILE SPECIALIZATION**: When profile-specific content is available, prioritize it for specialized guidance

**KNOWLEDGE HIERARCHY:**
1. FIRST: Profile-specific knowledge (most specialized)
2. SECOND: Persona-level knowledge (general EOS expertise)
3. THIRD: General EOS principles

`;

    return { context, chunkCount: results.length };
  } catch (error) {
    console.error('System RAG: Error generating context prompt:', error);
    return { context: '', chunkCount: 0 };
  }
}

/**
 * Process a document and store it in the systemEmbeddings table
 * Used for course personas and other system knowledge
 */
export async function processSystemDocument(
  content: string,
  namespace: string,
  metadata: {
    title: string;
    fileName?: string;
    category?: string;
    fileType?: string;
    lessonId?: string;
    order?: number;
  },
): Promise<void> {
  try {
    console.log(
      `System RAG: Processing document "${metadata.title}" into namespace "${namespace}"`,
    );

    // Generate chunks from content
    const chunks = splitIntoChunks(content, 800, 200);
    console.log(`System RAG: Generated ${chunks.length} chunks from document`);

    // Generate embeddings for chunks
    const { embedMany } = await import('ai');
    const { embeddings } = await embedMany({
      model: openai.embedding('text-embedding-3-small'),
      values: chunks,
    });

    console.log(
      `System RAG: Generated ${embeddings.length} embeddings with dimension ${embeddings[0]?.length || 0}`,
    );

    // Store chunks and embeddings in systemEmbeddings table
    const embeddingsData = chunks.map((chunk, index) => ({
      namespace,
      chunk,
      title: metadata.title,
      metadata: {
        fileName: metadata.fileName || metadata.title,
        category: metadata.category || 'Course Content',
        fileType: metadata.fileType || 'lesson',
        lessonId: metadata.lessonId,
        order: metadata.order,
        createdAt: new Date().toISOString(),
      },
      embedding: embeddings[index],
    }));

    // Insert embeddings in batches
    const batchSize = 50;
    for (let i = 0; i < embeddingsData.length; i += batchSize) {
      const batch = embeddingsData.slice(i, i + batchSize);
      await db.insert(systemEmbeddings).values(batch);
      console.log(
        `System RAG: Stored batch ${i / batchSize + 1} of ${Math.ceil(embeddingsData.length / batchSize)}`,
      );
    }

    console.log(
      `System RAG: ✅ Successfully stored ${embeddingsData.length} chunks for "${metadata.title}" in namespace "${namespace}"`,
    );
  } catch (error) {
    console.error(
      `System RAG: Error processing document for namespace ${namespace}:`,
      error,
    );
    throw error;
  }
}
