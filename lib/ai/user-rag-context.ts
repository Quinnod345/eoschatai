import 'server-only';

import { findRelevantUserContent } from './user-rag';
import { db } from '@/lib/db';
import { userSettings, userDocuments, document } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export interface UserRagResult {
  context: string;
  documentIds: string[];
  documentNames: string[];
  chunkCount: number;
}

/**
 * Enhanced user RAG context that returns both context and document metadata
 */
export async function getUserRagContextWithMetadata(
  userId: string,
  query = '',
  precomputedEmbedding?: number[],
): Promise<UserRagResult> {
  if (!userId) {
    return { context: '', documentIds: [], documentNames: [], chunkCount: 0 };
  }

  try {
    console.log(
      `User RAG: Fetching relevant documents for user ${userId} with query: "${query}"`,
    );

    // Run settings fetch and vector search in parallel to avoid sequential DB round-trips.
    const settingsPromise = (async () => {
      try {
        const [settings] = await db
          .select()
          .from(userSettings)
          .where(eq(userSettings.userId, userId))
          .limit(1);
        if (!settings) return [];

        const [contextUserDocs, contextComposerDocs] = await Promise.all([
          db
            .select({ id: userDocuments.id })
            .from(userDocuments)
            .where(
              and(
                eq(userDocuments.userId, userId),
                eq(userDocuments.isContext, true),
              ),
            ),
          db
            .select({ id: document.id })
            .from(document)
            .where(
              and(eq(document.userId, userId), eq(document.isContext, true)),
            ),
        ]);

        const ids = new Set([
          ...contextUserDocs.map((d) => d.id),
          ...contextComposerDocs.map((d) => d.id),
        ]);

        if (settings.usePrimaryDocsForContext ?? true) {
          for (const pid of [
            settings.primaryAccountabilityId,
            settings.primaryVtoId,
            settings.primaryScorecardId,
          ]) {
            if (pid) ids.add(pid);
          }
        }
        return Array.from(ids);
      } catch (settingsError) {
        console.error('Error fetching user settings:', settingsError);
        return [];
      }
    })();

    const ragPromise = findRelevantUserContent(
      userId,
      query,
      14,
      0.55, // Adjusted for text-embedding-3-small (lower cosine scores than ada-002)
      precomputedEmbedding,
    );

    const [_preferredDocumentIds, relevantDocs] = await Promise.all([
      settingsPromise,
      ragPromise,
    ]);

    if (!relevantDocs || relevantDocs.length === 0) {
      console.log('User RAG context: No relevant user documents found');
      return { context: '', documentIds: [], documentNames: [], chunkCount: 0 };
    }

    // SECURITY FIX: Filter out documents with category "Persona Document"
    // These should ONLY be accessible through persona-specific RAG, not user RAG
    const filteredDocs = relevantDocs.filter(
      (doc) => doc.metadata?.category !== 'Persona Document',
    );

    if (filteredDocs.length < relevantDocs.length) {
      console.log(
        `User RAG: Filtered out ${relevantDocs.length - filteredDocs.length} persona documents from user RAG`,
      );
    }

    if (filteredDocs.length === 0) {
      console.log(
        'User RAG context: No relevant user documents found after filtering',
      );
      return { context: '', documentIds: [], documentNames: [], chunkCount: 0 };
    }

    // Extract unique document IDs and names from the results (using filtered docs)
    const documentMap = new Map<string, string>();

    for (const doc of filteredDocs) {
      if (doc.metadata?.documentId && doc.metadata?.fileName) {
        documentMap.set(doc.metadata.documentId, doc.metadata.fileName);
      }
    }

    const documentIds = Array.from(documentMap.keys());
    const documentNames = Array.from(documentMap.values());

    // Build context text (simplified version of existing logic)
    let contextText = '## USER DOCUMENT CONTEXT\n\n';
    contextText +=
      "The following information has been retrieved from the user's uploaded documents:\n\n";

    // Group by category (using filtered docs)
    const documentsByCategory: Record<string, any[]> = {};
    for (const doc of filteredDocs) {
      const category = doc.metadata?.category || 'Other';
      if (!documentsByCategory[category]) {
        documentsByCategory[category] = [];
      }
      documentsByCategory[category].push(doc);
    }

    // Add documents by category
    for (const [category, docs] of Object.entries(documentsByCategory)) {
      contextText += `### ${category}\n\n`;
      const groupedByFile: Record<string, any[]> = {};

      for (const doc of docs) {
        const fileName = doc.metadata?.fileName || 'Unknown';
        if (!groupedByFile[fileName]) {
          groupedByFile[fileName] = [];
        }
        groupedByFile[fileName].push(doc);
      }

      for (const [fileName, fileDocs] of Object.entries(groupedByFile)) {
        contextText += `**From: ${fileName}**\n\n`;
        for (let i = 0; i < fileDocs.length; i++) {
          contextText += `[${i + 1}] ${fileDocs[i].content}\n\n`;
        }
        contextText += '\n---\n';
      }
    }

    contextText += `
When responding to user queries, ALWAYS reference and use information from these documents when applicable.
Do not mention that you are using "user documents" or "uploaded documents" - just incorporate the information naturally.
`;

    console.log(
      `User RAG: Generated context with ${contextText.length} characters from ${documentIds.length} documents`,
    );

    return {
      context: contextText,
      documentIds,
      documentNames,
      chunkCount: filteredDocs.length,
    };
  } catch (error) {
    console.error('User RAG: Error fetching user documents:', error);
    return { context: '', documentIds: [], documentNames: [], chunkCount: 0 };
  }
}
