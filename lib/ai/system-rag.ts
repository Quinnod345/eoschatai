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
  threshold = 0.7,
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

    // Generate embedding for the query
    const { embedding } = await embed({
      model: openai.embedding('text-embedding-ada-002'),
      value: query,
    });

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
  threshold = 0.7,
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
        model: openai.embedding('text-embedding-ada-002'),
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
): Promise<string> {
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
      return '';
    }

    const namespaces = [personaData.knowledgeNamespace].filter(Boolean);

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
      return '';
    }

    // Search for relevant content
    const results = await findHierarchicalSystemContent(
      query,
      namespaces,
      3,
      0.6,
    );

    if (results.length === 0) {
      console.log('System RAG: No relevant content found');
      return '';
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

    return `
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
  } catch (error) {
    console.error('System RAG: Error generating context prompt:', error);
    return '';
  }
}
