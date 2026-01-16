import { findRelevantContent } from '../embeddings';
import { generateId, tool } from 'ai';
import { z } from 'zod/v3';
import type { UIMessageStreamWriter } from 'ai';

interface RetrieveContextProps {
  dataStream: UIMessageStreamWriter;
}

export const retrieveContextTool = ({ dataStream }: RetrieveContextProps) =>
  tool({
    description:
      'Retrieve relevant EOS knowledge from the knowledge base to help answer a question',
    inputSchema: z.object({
      query: z
        .string()
        .describe('The query or question to search for relevant information'),
    }),
    execute: async ({ query }) => {
      try {
        // Log that we're searching
        dataStream.write({
          type: 'data-tool',
          id: generateId(),
          data: { message: `Searching knowledge base for: ${query}` },
        });

        // Retrieve relevant context
        const relevantContent = await findRelevantContent(query);

        if (relevantContent.length === 0) {
          return {
            found: false,
            message: 'No relevant information found in the knowledge base.',
            context: [],
          };
        }

        return {
          found: true,
          message: `Found ${relevantContent.length} relevant pieces of information.`,
          context: relevantContent.map((item) => ({
            content: item.content,
            relevance: item.relevance,
          })),
        };
      } catch (error) {
        console.error('Error retrieving context:', error);
        return {
          found: false,
          message: 'Error searching the knowledge base.',
          context: [],
        };
      }
    },
  });
