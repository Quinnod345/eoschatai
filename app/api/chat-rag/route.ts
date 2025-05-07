import { auth } from '@/app/(auth)/auth';
import { findRelevantContent } from '@/lib/ai/embeddings';
import { createResource } from '@/lib/actions/resources';
import { indexDocumentsTool, retrieveContextTool } from '@/lib/ai/tools';
import { myProvider } from '@/lib/ai/providers';
import { openai } from '@ai-sdk/openai';
import { ragContextPrompt } from '@/lib/ai/prompts';
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
    onError: () => {},
  };
}

export async function POST(req: Request) {
  // Auth check
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get request body
  const { messages, chatId } = await req.json();

  // Create data stream
  const dataStream = new TransformStream();
  const writer = dataStream.writable.getWriter();
  const dataStreamWriter = createDataStreamWriterAdapter(writer);

  try {
    // Get the last user message to use for context retrieval
    const lastUserMessage =
      [...messages].reverse().find((m) => m.role === 'user')?.content || '';

    // Retrieve relevant context from knowledge base
    const relevantContent = await findRelevantContent(lastUserMessage);

    // Stream response from model with RAG context
    const result = streamText({
      model: openai('gpt-4o'),
      messages,
      system: `You are EOS AI, a helpful assistant for EOS Implementers.
      
      ${ragContextPrompt(relevantContent)}
      
      Answer questions based on the retrieved information. If you don't have enough context, you can use the retrieve_context tool to find more information.`,
      maxTokens: 1000,
      tools: {
        retrieve_context: retrieveContextTool({ dataStream: dataStreamWriter }),
        add_to_knowledge: tool({
          description: 'Add information to the EOS knowledge base',
          parameters: z.object({
            content: z
              .string()
              .describe('The content to add to the knowledge base'),
          }),
          execute: async ({ content }) => createResource({ content }),
        }),
        index_documents: indexDocumentsTool({ dataStream: dataStreamWriter }),
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
