import { z } from 'zod/v3';
import {
  processUserDocument,
  findRelevantUserContent,
  deleteUserDocument,
} from './user-rag';
import { generateUUID } from '@/lib/utils';

/**
 * Tool for adding user documents to their personal RAG database
 */
export const addUserDocumentTool = {
  name: 'addUserDocument',
  description:
    'Add a user document to their personal knowledge base using RAG. This replaces the old document context system.',
  schema: z.object({
    title: z.string().describe('The title/name of the document'),
    content: z.string().describe('The content of the document'),
    category: z
      .enum(['Scorecard', 'VTO', 'Rocks', 'A/C', 'Core Process', 'Other'])
      .describe('The category of the document'),
    fileType: z
      .string()
      .optional()
      .describe('The file type (e.g., pdf, docx, txt)'),
  }),
  execute: async (
    {
      title,
      content,
      category,
      fileType,
    }: {
      title: string;
      content: string;
      category:
        | 'Scorecard'
        | 'VTO'
        | 'Rocks'
        | 'A/C'
        | 'Core Process'
        | 'Other';
      fileType?: string;
    },
    userId: string,
  ) => {
    try {
      console.log(
        `User RAG Tool: Adding document "${title}" for user ${userId}`,
      );

      // Generate a unique document ID
      const documentId = generateUUID();

      // Process the document and store in user's RAG namespace
      await processUserDocument(userId, documentId, content, {
        fileName: title,
        category,
        fileType: fileType || 'text',
      });

      return {
        status: 'success',
        message: `I've saved "${title}" to your personal knowledge base and will use it to provide more relevant answers about your ${category} documents.`,
        documentId,
      };
    } catch (error) {
      console.error('User RAG Tool: Error adding document:', error);
      return {
        status: 'error',
        message:
          'I encountered an error while saving your document to the knowledge base.',
      };
    }
  },
};

/**
 * Tool for retrieving relevant user documents from their personal RAG database
 */
export const getUserDocumentsTool = {
  name: 'getUserDocuments',
  description:
    "Retrieve relevant documents from the user's personal knowledge base using semantic search.",
  schema: z.object({
    query: z
      .string()
      .describe('The search query to find relevant user documents'),
    limit: z
      .number()
      .optional()
      .default(5)
      .describe('Maximum number of results to return'),
  }),
  execute: async (
    { query, limit = 5 }: { query: string; limit?: number },
    userId: string,
  ) => {
    try {
      console.log(
        `User RAG Tool: Searching user ${userId} documents for: "${query}"`,
      );

      // Search for relevant content in user's namespace
      const results = await findRelevantUserContent(userId, query, limit);

      if (results.length === 0) {
        return {
          status: 'success',
          message:
            "I couldn't find any relevant information in your uploaded documents for that query.",
          results: [],
        };
      }

      console.log(
        `User RAG Tool: Found ${results.length} relevant results for user ${userId}`,
      );

      return {
        status: 'success',
        message: `I found ${results.length} relevant pieces of information in your documents that will help answer your question.`,
        results: results.map((result) => ({
          content: result.content,
          relevance: result.relevance,
          fileName: result.metadata.fileName,
          category: result.metadata.category,
        })),
      };
    } catch (error) {
      console.error('User RAG Tool: Error retrieving documents:', error);
      return {
        status: 'error',
        message: 'I encountered an error while searching your documents.',
        results: [],
      };
    }
  },
};

/**
 * Tool for removing user documents from their personal RAG database
 */
export const removeUserDocumentTool = {
  name: 'removeUserDocument',
  description:
    "Remove a specific document from the user's personal knowledge base.",
  schema: z.object({
    documentId: z.string().describe('The ID of the document to remove'),
  }),
  execute: async ({ documentId }: { documentId: string }, userId: string) => {
    try {
      console.log(
        `User RAG Tool: Removing document ${documentId} for user ${userId}`,
      );

      // Delete the document from user's namespace
      const result = await deleteUserDocument(userId, documentId);

      if (result.deleted === 0) {
        return {
          status: 'success',
          message:
            'The document was not found in your knowledge base (it may have already been removed).',
        };
      }

      return {
        status: 'success',
        message: `I've successfully removed the document from your knowledge base. Deleted ${result.deleted} chunks.`,
      };
    } catch (error) {
      console.error('User RAG Tool: Error removing document:', error);
      return {
        status: 'error',
        message:
          'I encountered an error while removing the document from your knowledge base.',
      };
    }
  },
};

/**
 * Export all user RAG tools
 */
export const userRagTools = {
  addUserDocument: addUserDocumentTool,
  getUserDocuments: getUserDocumentsTool,
  removeUserDocument: removeUserDocumentTool,
};
