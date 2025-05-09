import {
  generateEmbedding,
  findRelevantContent,
  processDocument,
} from './embeddings';
import { generateUUID } from '../utils';
import { document } from '../db/schema';

// Dynamic import to avoid module not found error
const getDb = async () => {
  const { db } = await import('../db');
  return db;
};

/**
 * Tool for adding a new resource to the knowledge base
 * This allows the AI to save information shared by users
 */
export const addResourceTool = {
  name: 'addResource',
  description:
    'Add a new resource to the EOS knowledge base. Use this PROACTIVELY whenever users share information that should be remembered for future reference. Look for EOS concepts, methodologies, or specific company information that would be valuable to store.',
  parameters: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'Title or topic of the resource (be specific and concise)',
      },
      content: {
        type: 'string',
        description:
          'Content of the resource to add to the knowledge base (include all relevant details, formatted cleanly)',
      },
    },
    required: ['title', 'content'],
  },
  handler: async (
    { title, content }: { title: string; content: string },
    userId: string,
  ) => {
    try {
      console.log('RAG: Processing resource for knowledge base', { title });

      // Process the content to ensure it's a string
      let contentText = content;
      if (typeof content === 'object' && content !== null) {
        // Add a type assertion to avoid the 'never' type error
        const contentObj = content as { text?: string };
        if (contentObj.text && typeof contentObj.text === 'string') {
          contentText = contentObj.text;
        } else {
          // Try to convert to string if it's a complex object
          contentText = JSON.stringify(content);
        }
      }

      // First, insert the document into the database
      const newDocumentId = generateUUID();
      const db = await getDb();

      await db.insert(document).values({
        id: newDocumentId,
        createdAt: new Date(),
        title,
        content: contentText,
        kind: 'text',
        userId,
      });

      console.log('RAG: Document inserted into database');

      // Process the document to create embeddings (wrap in try/catch to handle vector dimension issues)
      console.log('RAG: Generating embeddings for document');
      try {
        await processDocument(newDocumentId, contentText);
        console.log('RAG: Embeddings generated and stored successfully');
      } catch (error) {
        console.error(
          'RAG ERROR: Failed to generate embeddings, but document is saved in database:',
          error,
        );
        // Still return success since the document is saved in the database
      }

      return {
        status: 'success',
        message: `I've saved "${title}" to our knowledge base and will remember this information for future conversations.`,
        documentId: newDocumentId,
      };
    } catch (error) {
      console.error('RAG ERROR: Failed to add resource:', error);
      return {
        status: 'error',
        message:
          'I was unable to save this information to our knowledge base. Please try again later.',
      };
    }
  },
};

/**
 * Tool to retrieve information from the knowledge base based on a query
 * This enables RAG functionality by finding relevant content
 */
export const getInformationTool = {
  name: 'getInformation',
  description:
    "Retrieve relevant information from the EOS knowledge base to help answer the user's question. ALWAYS use this tool when answering specific questions about EOS concepts, methodologies, or details that might be in the knowledge base. The retrieved information will be more accurate than your general knowledge.",
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description:
          'The specific topic or question to search for in the knowledge base (be precise to get better results)',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results to return (default: 5)',
      },
    },
    required: ['query'],
  },
  handler: async ({ query, limit = 5 }: { query: string; limit?: number }) => {
    try {
      console.log(`RAG: Searching knowledge base for: "${query}"`);

      // Search for relevant content
      const results = await findRelevantContent(query, limit);

      if (results.length === 0) {
        console.log('RAG: No relevant information found');
        return {
          status: 'success',
          message:
            "I searched our knowledge base but couldn't find any information about that topic.",
          results: [],
        };
      }

      console.log(
        `RAG: Found ${results.length} relevant results. Top result (${(results[0].relevance * 100).toFixed(1)}% relevance): ${results[0].content.substring(0, 50)}...`,
      );

      return {
        status: 'success',
        message: `I found ${results.length} relevant pieces of information in our knowledge base that will help answer your question.`,
        results,
      };
    } catch (error) {
      console.error('RAG ERROR: Failed to retrieve information:', error);
      return {
        status: 'error',
        message: 'I encountered an error while searching our knowledge base.',
        results: [],
      };
    }
  },
};

// Export all RAG tools for use in chat routes
export const ragTools = [addResourceTool, getInformationTool];
