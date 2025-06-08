import { auth } from '@/app/(auth)/auth';
import { findRelevantContent } from '@/lib/ai/embeddings';
import { addResourceTool, getInformationTool } from '@/lib/ai/tools';
import { myProvider } from '@/lib/ai/providers';
import { systemPrompt } from '@/lib/ai/prompts';
import { streamText, tool, type DataStreamWriter } from 'ai';
import { NextResponse } from 'next/server';
import { z } from 'zod';

export const maxDuration = 30; // 30 seconds

// Create an adapter that implements DataStreamWriter interface using a WritableStreamDefaultWriter
function createDataStreamWriterAdapter(
  writer: WritableStreamDefaultWriter,
): DataStreamWriter {
  return {
    write: (data) => {
      writer.write(JSON.stringify(data));
      return Promise.resolve();
    },
    writeData: (data) => {
      writer.write(JSON.stringify({ type: 'data', data }));
      return Promise.resolve();
    },
    writeMessageAnnotation: (data) => {
      writer.write(JSON.stringify({ type: 'message_annotation', data }));
      return Promise.resolve();
    },
    writeSource: (data) => {
      writer.write(JSON.stringify({ type: 'source', data }));
      return Promise.resolve();
    },
    merge: () => {},
    onError: (error: unknown) => `Error in data stream: ${String(error)}`,
  };
}

export async function POST(req: Request) {
  // Auth check
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get request body
  const { messages, chatId, modelId = 'chat-model' } = await req.json();

  // Create data stream
  const dataStream = new TransformStream();
  const writer = dataStream.writable.getWriter();
  const dataStreamWriter = createDataStreamWriterAdapter(writer);

  try {
    // Get the last user message to use for context retrieval
    const lastUserMessage =
      [...messages].reverse().find((m) => m.role === 'user')?.content || '';

    console.log('RAG: Processing chat request with query:', lastUserMessage);

    // Retrieve relevant context from knowledge base (using Upstash Vector)
    console.log('RAG: Fetching relevant content from vector store');
    const relevantContent = await findRelevantContent(lastUserMessage, 5);

    // Debug log for RAG content
    console.log(
      `RAG: Retrieved ${relevantContent.length} chunks from vector store`,
    );
    if (relevantContent.length > 0) {
      console.log(
        'RAG: Top result:',
        `${relevantContent[0].content.substring(0, 100)}...`,
        `(relevance: ${(relevantContent[0].relevance * 100).toFixed(1)}%)`,
      );
    } else {
      console.log('RAG: No relevant content found');
    }

    // Get user location hints for prompt
    const requestHints = {
      latitude: '',
      longitude: '',
      city: '',
      country: '',
    };

    // Get system prompt with RAG context
    const baseSystemPrompt = await systemPrompt({
      selectedProvider: modelId,
      requestHints,
      ragContext: relevantContent,
      userId: session.user.id,
    });

    console.log('RAG: Created system prompt with context');

    // Add RAG usage indicator for debugging
    // Make RAG tools more likely to be used by the model
    const result = streamText({
      model: myProvider.languageModel(modelId as 'chat-model'),
      messages,
      system: `${baseSystemPrompt}\n\nALWAYS use the getInformation tool when you don't have enough context from the retrieved information above!\n\nIMPORTANT RAG RESPONSE INSTRUCTIONS:\n1. NEVER mention phrases like "Based on our knowledge base" or "According to our records" in your responses\n2. Provide COMPREHENSIVE and DETAILED responses that connect concepts and expand on key points\n3. Use RICH MARKDOWN FORMATTING with clear sections, hierarchical headings, and proper formatting\n4. When using retrieved information, incorporate it NATURALLY into your response without attributing it to a knowledge base\n5. TARGET RESPONSE LENGTH: Aim for approximately 1500 tokens (~1125 words) but always complete your thoughts naturally\n6. NATURAL COMPLETION: Never stop mid-sentence or mid-thought - complete your response naturally even if approaching the target length`,
      maxTokens: 2500, // High safety limit to prevent hard cutoffs while keeping responses reasonable
      temperature: 0.7,
      tools: {
        // Add Resource tool - saves information to knowledge base
        addResource: tool({
          description:
            'Add a new resource to the EOS knowledge base. Use this whenever the user shares information that should be remembered for future reference.',
          parameters: z.object({
            title: z.string().describe('Title of the resource'),
            content: z.string().describe('Content of the resource'),
          }),
          execute: async ({ title, content }) => {
            console.log('RAG: Adding resource to knowledge base', { title });
            if (!addResourceTool.handler) {
              console.error('RAG: addResourceTool.handler is undefined');
              return { success: false, error: 'Tool handler is not available' };
            }
            const result = await addResourceTool.handler(
              { title, content },
              session.user.id,
            );
            console.log('RAG: Resource added', result);
            return result;
          },
        }),

        // Get Information tool - retrieves information from knowledge base
        getInformation: tool({
          description:
            "Retrieve more relevant information from the EOS knowledge base. Use this when you need additional context to answer the user's question.",
          parameters: z.object({
            query: z
              .string()
              .describe(
                'The specific query to search for in the knowledge base',
              ),
            limit: z
              .number()
              .optional()
              .describe('Maximum number of results to return'),
          }),
          execute: async ({ query, limit }) => {
            console.log('RAG: Tool called to get information', {
              query,
              limit,
            });
            if (!getInformationTool.handler) {
              console.error('RAG: getInformationTool.handler is undefined');
              return {
                success: false,
                error: 'Tool handler is not available',
                results: [],
              };
            }
            const result = await getInformationTool.handler(
              { query, limit },
              session.user.id,
            );
            console.log(
              `RAG: Retrieved ${result.results?.length || 0} results from knowledge base`,
            );
            return result;
          },
        }),
      },
    });

    return result.toDataStreamResponse();
  } catch (error) {
    console.error('Error in chat-rag route:', error);
    writer.close();
    return NextResponse.json(
      { error: 'Failed to process chat request' },
      { status: 500 },
    );
  }
}
