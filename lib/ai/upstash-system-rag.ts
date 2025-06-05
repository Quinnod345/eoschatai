import { Index } from '@upstash/vector';
import { openai } from '@ai-sdk/openai';
import { embed } from 'ai';

// Initialize Upstash Vector client for system RAG
const getUpstashSystemClient = () => {
  const url = process.env.UPSTASH_USER_RAG_REST_URL;
  const token = process.env.UPSTASH_USER_RAG_REST_TOKEN;

  if (!url || !token) {
    throw new Error('Missing Upstash vector database credentials');
  }

  return new Index({
    url,
    token,
  });
};

/**
 * Find relevant content from the Upstash system knowledge base
 * @param query - The search query
 * @param namespace - The knowledge namespace (e.g., 'eos-implementer-quarterly-session')
 * @param limit - Maximum number of results to return
 * @param threshold - Minimum similarity threshold (0-1)
 * @returns Array of relevant content chunks with metadata
 */
export async function findUpstashSystemContent(
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
      `Upstash System RAG: Searching namespace "${namespace}" for: "${query}"`,
    );

    const client = getUpstashSystemClient();

    // Generate embedding for the query
    const { embedding } = await embed({
      model: openai.embedding('text-embedding-ada-002'),
      value: query,
    });

    // Use the namespace method to get the namespace-specific client
    const namespaceClient = client.namespace(namespace);

    // Search for similar content in the specified namespace
    const results = await namespaceClient.query({
      vector: embedding,
      topK: limit,
      includeMetadata: true,
    });

    console.log(
      `Upstash System RAG: Found ${results.length} results in namespace "${namespace}"`,
    );

    // Debug: Log first result if available
    if (results.length > 0) {
      console.log(
        `Upstash System RAG: First result score: ${results[0].score}, has metadata: ${!!results[0].metadata}`,
      );
    }

    return results
      .filter((result) => result.score >= threshold)
      .map((result) => ({
        content: (result.metadata?.content as string) || '',
        title: (result.metadata?.title as string) || 'Untitled',
        relevance: result.score,
        metadata: result.metadata,
      }));
  } catch (error) {
    console.error('Upstash System RAG: Error finding system content:', error);
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
export async function findHierarchicalUpstashSystemContent(
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
      `Upstash System RAG: Hierarchical search across namespaces: ${namespaces.join(', ')}`,
    );

    // Search all namespaces in parallel
    const searchPromises = namespaces.map((namespace) =>
      findUpstashSystemContent(query, namespace, limit, threshold)
        .then((results) =>
          // Add namespace info to results
          results.map((result) => ({
            ...result,
            namespace,
          })),
        )
        .catch((error) => {
          console.error(
            `Upstash System RAG: Error searching namespace "${namespace}":`,
            error,
          );
          return [];
        }),
    );

    // Wait for all searches to complete
    const searchResults = await Promise.all(searchPromises);

    // Flatten all results into a single array
    const allResults = searchResults.flat();

    // Sort all results by relevance
    allResults.sort((a, b) => b.relevance - a.relevance);

    console.log(
      `Upstash System RAG: Combined ${allResults.length} results from hierarchical search`,
    );

    return allResults;
  } catch (error) {
    console.error('Upstash System RAG: Error in hierarchical search:', error);
    return [];
  }
}

/**
 * Add content to the Upstash system knowledge base
 * @param namespace - The knowledge namespace
 * @param title - Document title
 * @param content - Document content
 * @param metadata - Additional metadata
 */
export async function addUpstashSystemContent(
  namespace: string,
  title: string,
  content: string,
  metadata?: any,
): Promise<void> {
  try {
    console.log(
      `Upstash System RAG: Adding content to namespace "${namespace}": "${title}"`,
    );

    const client = getUpstashSystemClient();

    // Split content into chunks (simple implementation)
    const chunks = splitIntoChunks(content, 1000, 200);

    // Generate embeddings for all chunks in parallel
    const embeddingPromises = chunks.map(async (chunk, i) => {
      const { embedding } = await embed({
        model: openai.embedding('text-embedding-ada-002'),
        value: chunk,
      });

      // Create vector with metadata
      return {
        id: `${namespace}-${title}-chunk-${i}`,
        vector: embedding,
        metadata: {
          namespace,
          title: chunks.length > 1 ? `${title} (Part ${i + 1})` : title,
          content: chunk,
          chunkIndex: i,
          totalChunks: chunks.length,
          uploadedAt: new Date().toISOString(),
          source: 'eos-implementer-documents',
          ...metadata,
        },
      };
    });

    // Wait for all embeddings to be generated
    const vectors = await Promise.all(embeddingPromises);

    // Upload all vectors to the namespace
    const namespaceClient = client.namespace(namespace);
    await namespaceClient.upsert(vectors);

    console.log(
      `Upstash System RAG: Added ${chunks.length} chunks for "${title}" to namespace "${namespace}"`,
    );
  } catch (error) {
    console.error('Upstash System RAG: Error adding system content:', error);
    throw error;
  }
}

/**
 * Clear all content from a specific namespace
 * @param namespace - The namespace to clear
 */
export async function clearUpstashSystemNamespace(
  namespace: string,
): Promise<void> {
  try {
    console.log(`Upstash System RAG: Clearing namespace "${namespace}"`);

    const client = getUpstashSystemClient();
    const namespaceClient = client.namespace(namespace);

    // Use range to list all vectors in the namespace
    const vectorIds: string[] = [];
    let cursor = '';

    while (true) {
      const rangeResult = await namespaceClient.range({
        cursor,
        limit: 1000,
        includeMetadata: false,
        includeVectors: false,
      });

      if (rangeResult.vectors) {
        vectorIds.push(...rangeResult.vectors.map((v) => v.id));
      }

      if (!rangeResult.nextCursor) {
        break;
      }

      cursor = rangeResult.nextCursor;
    }

    if (vectorIds.length === 0) {
      console.log(
        `Upstash System RAG: No vectors found in namespace "${namespace}"`,
      );
      return;
    }

    // Delete all vectors in batches
    const batchSize = 100;
    for (let i = 0; i < vectorIds.length; i += batchSize) {
      const batch = vectorIds.slice(i, i + batchSize);
      await namespaceClient.delete(batch);
    }

    console.log(
      `Upstash System RAG: Cleared ${vectorIds.length} vectors from namespace "${namespace}"`,
    );
  } catch (error) {
    console.error(
      `Upstash System RAG: Error clearing namespace "${namespace}":`,
      error,
    );
    throw error;
  }
}

/**
 * Clear all EOS implementer namespaces
 * @param namespaces - Array of namespaces to clear
 */
export async function clearAllEOSImplementerNamespaces(
  namespaces: string[],
): Promise<void> {
  try {
    console.log(
      `Upstash System RAG: Clearing all EOS implementer namespaces: ${namespaces.join(', ')}`,
    );

    // Clear all namespaces in parallel
    const clearPromises = namespaces.map((namespace) =>
      clearUpstashSystemNamespace(namespace).catch((error) => {
        console.error(
          `Upstash System RAG: Error clearing namespace "${namespace}":`,
          error,
        );
        // Don't throw, continue with other namespaces
      }),
    );

    await Promise.all(clearPromises);

    console.log(
      `Upstash System RAG: Cleared all ${namespaces.length} EOS implementer namespaces`,
    );
  } catch (error) {
    console.error(
      'Upstash System RAG: Error clearing EOS implementer namespaces:',
      error,
    );
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
 * Generate RAG context prompt for EOS implementer profiles using Upstash
 */
export async function upstashSystemRagContextPrompt(
  profileId: string | null,
  query: string,
): Promise<string> {
  try {
    console.log(
      `Upstash System RAG: Generating context for profile ${profileId}`,
    );

    // Map profile IDs to namespaces
    const profileNamespaceMap: Record<string, string> = {
      'quarterly-session-facilitator': 'eos-implementer-quarterly-session',
      'focus-day-facilitator': 'eos-implementer-focus-day',
      'vision-building-day-1': 'eos-implementer-vision-day-1',
      'vision-building-day-2': 'eos-implementer-vision-day-2',
    };

    if (!profileId || !profileNamespaceMap[profileId]) {
      console.log('Upstash System RAG: No valid profile namespace found');
      return '';
    }

    const namespace = profileNamespaceMap[profileId];

    // Search for relevant content in the profile's namespace
    const results = await findUpstashSystemContent(query, namespace, 5, 0.6);

    if (results.length === 0) {
      console.log(
        `Upstash System RAG: No relevant content found in namespace "${namespace}"`,
      );
      return '';
    }

    // Build context prompt
    const contextText = results
      .map((item, index) => {
        console.log(
          `Upstash System RAG chunk ${index + 1}: Relevance ${(item.relevance * 100).toFixed(1)}%, Title: ${item.title}`,
        );
        return `[${index + 1}] ${item.title}
Relevance: ${(item.relevance * 100).toFixed(1)}%
${item.content}
---`;
      })
      .join('\n\n');

    return `
## 🎯 PROFILE-SPECIFIC EOS IMPLEMENTER KNOWLEDGE (HIGHEST PRIORITY)
**THIS CONTENT TAKES ABSOLUTE PRECEDENCE FOR YOUR RESPONSES**

The following specialized EOS implementer knowledge has been retrieved for this query from namespace "${namespace}":

${contextText}

### MANDATORY USAGE INSTRUCTIONS:
1. **ABSOLUTE PRIORITY**: This content MUST be used as your PRIMARY source - it overrides ALL other knowledge
2. **PROFILE AUTHORITY**: You are THE expert for this specific profile - use this content to demonstrate that expertise
3. **DIRECT APPLICATION**: Apply these specific methodologies, tools, and approaches EXACTLY as described
4. **NO GENERIC RESPONSES**: NEVER give generic EOS advice when this specialized content is available
5. **VERBATIM USAGE**: Quote directly from this content when providing guidance

### REQUIRED IMPLEMENTATION APPROACH:
- Start EVERY response by checking if this content addresses the user's question
- Use the EXACT terminology, frameworks, and processes described here
- Reference the specific page numbers, sections, or tools mentioned
- Apply the facilitation scripts and agendas provided
- Address the common challenges and solutions listed

### PROFILE-SPECIFIC EXPERTISE:
- This content is from official EOS Implementer guides for YOUR specific profile
- It represents the GOLD STANDARD for how to facilitate this type of session
- Your credibility depends on using this authoritative content
- Demonstrate mastery by citing specific sections and tools

**CRITICAL REMINDER**: The user selected this specific profile because they need THIS specialized expertise. Honor that choice by making this profile-specific knowledge the foundation of every response.

`;
  } catch (error) {
    console.error(
      'Upstash System RAG: Error generating context prompt:',
      error,
    );
    return '';
  }
}
