import {
  deleteUserDocument,
  deleteUserDocuments,
  findRelevantUserContent,
  processUserDocument,
} from './user-rag';

export function getOrgKnowledgeNamespace(orgId: string): string {
  return `org:${orgId}`;
}

export async function processOrgDocument(
  orgId: string,
  documentId: string,
  content: string,
  metadata: {
    fileName: string;
    category?: string;
    fileType?: string;
  },
): Promise<void> {
  return processUserDocument(
    getOrgKnowledgeNamespace(orgId),
    documentId,
    content,
    {
      fileName: metadata.fileName,
      category: metadata.category || 'Org Document',
      fileType: metadata.fileType,
    },
  );
}

export async function findRelevantOrgContent(
  orgId: string,
  query: string,
  limit = 10,
  minRelevance = 0.65,
): Promise<{ content: string; relevance: number; metadata: any }[]> {
  return findRelevantUserContent(
    getOrgKnowledgeNamespace(orgId),
    query,
    limit,
    minRelevance,
  );
}

export async function deleteOrgDocument(
  orgId: string,
  documentId: string,
): Promise<{ deleted: number }> {
  return deleteUserDocument(getOrgKnowledgeNamespace(orgId), documentId);
}

export async function deleteOrgKnowledge(
  orgId: string,
): Promise<{ deleted: number }> {
  return deleteUserDocuments(getOrgKnowledgeNamespace(orgId));
}
