import 'server-only';

import { findRelevantOrgContent } from './org-rag';

export interface OrgRagResult {
  context: string;
  documentIds: string[];
  documentNames: string[];
  chunkCount: number;
}

export async function getOrgRagContextWithMetadata(
  orgId: string,
  query = '',
): Promise<OrgRagResult> {
  if (!orgId || !query) {
    return { context: '', documentIds: [], documentNames: [], chunkCount: 0 };
  }

  try {
    const relevantDocs = await findRelevantOrgContent(orgId, query, 12, 0.68);

    if (!relevantDocs || relevantDocs.length === 0) {
      return { context: '', documentIds: [], documentNames: [], chunkCount: 0 };
    }

    const documentMap = new Map<string, string>();
    for (const doc of relevantDocs) {
      const documentId = doc.metadata?.documentId as string | undefined;
      const fileName = doc.metadata?.fileName as string | undefined;
      if (documentId && fileName) {
        documentMap.set(documentId, fileName);
      }
    }

    const documentsByCategory: Record<
      string,
      Record<string, typeof relevantDocs>
    > = {};
    for (const doc of relevantDocs) {
      const category = (doc.metadata?.category as string) || 'Org Document';
      const fileName = (doc.metadata?.fileName as string) || 'Unknown';
      if (!documentsByCategory[category]) {
        documentsByCategory[category] = {};
      }
      if (!documentsByCategory[category][fileName]) {
        documentsByCategory[category][fileName] = [];
      }
      documentsByCategory[category][fileName].push(doc);
    }

    let context = '## ORGANIZATION KNOWLEDGE CONTEXT\n\n';
    context +=
      "The following shared organization information was retrieved from your team's knowledge base:\n\n";

    for (const [category, files] of Object.entries(documentsByCategory)) {
      context += `### ${category}\n\n`;
      for (const [fileName, docs] of Object.entries(files)) {
        context += `**From: ${fileName}**\n\n`;
        docs.forEach((doc, index) => {
          context += `[${index + 1}] ${doc.content}\n\n`;
        });
        context += '\n---\n';
      }
    }

    context +=
      '\nUse this as shared team context when it is relevant to the user request.';

    return {
      context,
      documentIds: Array.from(documentMap.keys()),
      documentNames: Array.from(documentMap.values()),
      chunkCount: relevantDocs.length,
    };
  } catch (error) {
    console.error('Org RAG: Error building org context:', error);
    return { context: '', documentIds: [], documentNames: [], chunkCount: 0 };
  }
}
