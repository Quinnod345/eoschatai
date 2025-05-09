import {
  appendClientMessage,
  appendResponseMessages,
  createDataStream,
  smoothStream,
  streamText,
  tool,
} from 'ai';
import { auth, type UserType } from '@/app/(auth)/auth';
import { type RequestHints, systemPrompt } from '@/lib/ai/prompts';
import {
  createStreamId,
  deleteChatById,
  getChatById,
  getMessageCountByUserId,
  getMessagesByChatId,
  getStreamIdsByChatId,
  saveChat,
  saveMessages,
} from '@/lib/db/queries';
import { generateUUID, getTrailingMessageId } from '@/lib/utils';
import { generateTitleFromUserMessage } from '../../actions';
import { createDocument } from '@/lib/ai/tools/create-document';
import { updateDocument } from '@/lib/ai/tools/update-document';
import { requestSuggestions } from '@/lib/ai/tools/request-suggestions';
import { getWeather } from '@/lib/ai/tools/get-weather';
import { isProductionEnvironment } from '@/lib/constants';
import {
  myProvider,
  DEFAULT_PROVIDER,
  createCustomProvider,
} from '@/lib/ai/providers';
import { entitlementsByUserType } from '@/lib/ai/entitlements';
import { postRequestBodySchema, type PostRequestBody } from './schema';
import { geolocation } from '@vercel/functions';
import {
  createResumableStreamContext,
  type ResumableStreamContext,
} from 'resumable-stream';
import { after } from 'next/server';
import type { Chat } from '@/lib/db/schema';
import {
  findRelevantContent,
  deleteContentByKeyword,
} from '@/lib/ai/embeddings';
import { addResourceTool, getInformationTool } from '@/lib/ai/tools';
import { z } from 'zod';

export const maxDuration = 60;

let globalStreamContext: ResumableStreamContext | null = null;

function getStreamContext() {
  if (!globalStreamContext) {
    try {
      globalStreamContext = createResumableStreamContext({
        waitUntil: after,
      });

      // Debug log for stream context
      console.log('Stream context created successfully');
    } catch (error: any) {
      if (error.message.includes('REDIS_URL')) {
        console.log(
          ' > Resumable streams are disabled due to missing REDIS_URL',
        );
        // When REDIS_URL is missing, we should return null to use non-resumable streams
        return null;
      } else {
        console.error('Error creating stream context:', error);
        return null;
      }
    }
  }

  return globalStreamContext;
}

export async function POST(request: Request) {
  let requestBody: PostRequestBody;

  try {
    const json = await request.json();
    requestBody = postRequestBodySchema.parse(json);
  } catch (_) {
    return new Response('Invalid request body', { status: 400 });
  }

  try {
    const {
      id,
      message,
      selectedChatModel,
      selectedVisibilityType,
      selectedProvider = DEFAULT_PROVIDER,
    } = requestBody;

    const session = await auth();

    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const userType: UserType = session.user.type;

    const messageCount = await getMessageCountByUserId({
      id: session.user.id,
      differenceInHours: 24,
    });

    if (messageCount > entitlementsByUserType[userType].maxMessagesPerDay) {
      return new Response(
        'You have exceeded your maximum number of messages for the day! Please try again later.',
        {
          status: 429,
        },
      );
    }

    const chat = await getChatById({ id });

    if (!chat) {
      const title = await generateTitleFromUserMessage({
        message,
      });

      await saveChat({
        id,
        userId: session.user.id,
        title,
        visibility: selectedVisibilityType,
      });
    } else {
      if (chat.userId !== session.user.id) {
        return new Response('Forbidden', { status: 403 });
      }
    }

    const previousMessages = await getMessagesByChatId({ id });

    const messages = appendClientMessage({
      // @ts-expect-error: todo add type conversion from DBMessage[] to UIMessage[]
      messages: previousMessages,
      message,
    });

    // Get the last user message to use for RAG context retrieval
    const lastUserMessage = message.parts[0];
    console.log('RAG: Processing chat request with query:', lastUserMessage);

    // Extract the actual text from the user message (handling different possible formats)
    let queryText = '';
    if (typeof lastUserMessage === 'string') {
      queryText = lastUserMessage;
    } else if (lastUserMessage && typeof lastUserMessage === 'object') {
      // Handle text object format { text: string, type: string }
      if (lastUserMessage.text && typeof lastUserMessage.text === 'string') {
        queryText = lastUserMessage.text;
      }
    }

    // Only attempt to retrieve context if we have text to work with
    let relevantContent: Array<{ content: string; relevance: number }> = [];
    if (queryText) {
      // Retrieve relevant context from knowledge base
      console.log('RAG: Fetching relevant content for query:', queryText);
      try {
        relevantContent = await findRelevantContent(queryText, 5);

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
      } catch (error) {
        console.error('RAG: Error retrieving relevant content:', error);
      }
    } else {
      console.log(
        'RAG: No text content found in user message to use for retrieval',
      );
    }

    const { longitude, latitude, city, country } = geolocation(request);

    const requestHints: RequestHints = {
      longitude,
      latitude,
      city,
      country,
    };

    await saveMessages({
      messages: [
        {
          chatId: id,
          id: message.id,
          role: 'user',
          parts: message.parts,
          attachments: message.experimental_attachments ?? [],
          createdAt: new Date(),
          provider: selectedProvider,
        },
      ],
    });

    const streamId = generateUUID();
    await createStreamId({ streamId, chatId: id });

    // Create a provider based on selected provider
    const provider = createCustomProvider(selectedProvider);

    // Get the system prompt with RAG context
    const fullSystemPrompt = await systemPrompt({
      selectedProvider,
      requestHints,
      ragContext: relevantContent,
      userId: session.user.id,
    });

    // Log document context usage
    const hasUserDocs = fullSystemPrompt.includes('## User Documents');
    console.log(
      `Chat: System prompt includes document context: ${hasUserDocs}`,
    );
    if (hasUserDocs) {
      // Extract document sections to log what documents are available
      const docSections = fullSystemPrompt.match(/### ([^\n]+)/g);
      if (docSections) {
        console.log(
          `Chat: Available document categories: ${docSections.join(', ')}`,
        );
      }
    }

    // Add explicit instructions about remembering information
    let enhancedSystemPrompt = `${fullSystemPrompt}

IMPORTANT RAG INSTRUCTIONS:
1. The user has just said: "${queryText}"
2. If this message contains "remember" or asks you to save any information, IMMEDIATELY use the addResource tool to save it.
3. Always give the saved information a clear, specific title that describes the content.
4. When using the getInformation tool, always incorporate the retrieved information into your response.
5. Look for opportunities to use these tools proactively - they are core to your functionality.
6. NEVER mention phrases like "Based on our knowledge base" or "According to our records" in your responses.
7. Provide COMPREHENSIVE and DETAILED responses that connect concepts and expand on key points.
8. Use RICH MARKDOWN FORMATTING with clear sections, hierarchical headings, and proper formatting.
9. When using retrieved information, incorporate it NATURALLY into your response without attributing it to a knowledge base.

DOCUMENT USAGE INSTRUCTIONS:
1. If the user asks about THEIR specific Core Process, Scorecard, Rocks, V/TO, or A/C, use ONLY the information provided in their uploaded documents.
2. These documents contain the user's ACTUAL company information and override any generic EOS knowledge you have.
3. When asked "What is my Core Process?" or similar questions, respond with the SPECIFIC information found in their documents.
4. Do NOT provide generic descriptions when specific document content is available.
5. PRIORITIZE document content over other knowledge when the user asks about their business.
6. These documents are the PRIMARY SOURCE OF TRUTH for the user's company information.
7. If you cannot find the requested information in their documents, clearly state this fact.`;

    // Add extra instructions specifically for Core Process questions
    if (queryText.toLowerCase().includes('core process')) {
      console.log(
        'Detected question about Core Process - adding special instructions',
      );
      enhancedSystemPrompt += `

SPECIAL INSTRUCTIONS FOR CORE PROCESS QUESTIONS:
- When the user asks about THEIR Core Process, ONLY use information from their Core Process documents.
- The Core Process document contains their actual business process steps.
- Use the EXACT text from their uploaded Core Process documents.
- Do NOT make up or generate a generic Core Process - use ONLY what is in their documents.
- If no Core Process document is found, clearly tell the user you cannot find their Core Process information.
`;
    }

    // Add special case for integrator questions
    if (queryText.toLowerCase().includes('integrator')) {
      console.log(
        'RAG: Detected question about integrators, adding special instructions',
      );
      enhancedSystemPrompt += `

SPECIAL INSTRUCTIONS FOR INTEGRATOR QUESTIONS:
For questions about integrators, please focus on information from Rocket Fuel and other EOS materials. Key concepts include:
1. The Visionary-Integrator relationship is a powerful leadership team dynamic
2. Integrators are essential for turning vision into execution
3. Integrators should be properly onboarded to the leadership team
4. This is a cornerstone concept in the book Rocket Fuel by Gino Wickman and Mark C. Winters
`;
    }

    // Add document creation guide
    if (
      queryText.toLowerCase().includes('document') ||
      queryText.toLowerCase().includes('create') ||
      queryText.toLowerCase().includes('v/to') ||
      queryText.toLowerCase().includes('accountability chart') ||
      queryText.toLowerCase().includes('scorecard')
    ) {
      console.log(
        'Detected document creation request - adding special instructions',
      );
      enhancedSystemPrompt += `

DOCUMENT CREATION GUIDE:
When asked to create a document or artifact, such as a Vision/Traction Organizer™, Accountability Chart™, or Scorecard:
1. Use the createDocument tool with the appropriate parameters
2. Always provide a descriptive title and the correct kind parameter ("text", "code", or "sheet")
3. NEVER use raw function call syntax like <function_call>{"action": "createDocument", ...}</function_call>
4. Always use the proper tool invocation mechanism provided by this system
5. For most EOS documents, use "text" kind unless specifically creating a spreadsheet or code

Example of CORRECT tool usage (conceptual, not actual syntax):
- Use the createDocument tool with parameters {title: "My V/TO", kind: "text"}
- Do NOT manually format function calls with custom syntax
`;
    }

    // Add additional instructions for Grok (XAI) provider which may have limited tool support
    if (selectedProvider === 'xai') {
      console.log(
        'RAG: Using XAI provider - adding explicit instructions for remembering',
      );
      enhancedSystemPrompt += `

SPECIAL INSTRUCTIONS FOR GROK:
- Since you're using Grok, if you cannot use the addResource tool directly, please respond with:
  "I'll remember that you love gala apples. This information has been saved to our knowledge base."
- This will be captured by our system and saved appropriately.
- If the user is asking for information that would normally use the getInformation tool, please
  use the information provided in the context at the top of this prompt.`;
    }

    // Create response stream
    const responseStream = createDataStream({
      execute: async (dataStream) => {
        // Set up a timeout to prevent hanging responses
        const responseTimeout = setTimeout(() => {
          console.error(
            'Response generation timeout reached - terminating stream',
          );
          // We can't directly modify the stream at this point, just log the error
          console.error('Stream response timed out - client should refresh');
        }, 30000); // Extended to 30 second timeout for document creation

        try {
          const result = streamText({
            model: provider.languageModel(selectedChatModel),
            system: enhancedSystemPrompt,
            messages,
            maxSteps: 5,
            experimental_activeTools:
              selectedChatModel === 'chat-model-reasoning'
                ? ['createDocument', 'updateDocument']
                : [
                    'getWeather',
                    'createDocument',
                    'updateDocument',
                    'requestSuggestions',
                    'addResource',
                    'getInformation',
                    'cleanKnowledgeBase',
                  ],
            experimental_transform: smoothStream({ chunking: 'word' }),
            experimental_generateMessageId: generateUUID,
            tools: {
              getWeather,
              createDocument: createDocument({ session, dataStream }),
              updateDocument: updateDocument({ session, dataStream }),
              requestSuggestions: requestSuggestions({
                session,
                dataStream,
              }),
              addResource: tool({
                description:
                  'Add a new resource to the EOS knowledge base. Use this whenever the user shares information that should be remembered for future reference.',
                parameters: z.object({
                  title: z.string().describe('Title of the resource'),
                  content: z.string().describe('Content of the resource'),
                }),
                execute: async ({ title, content }) => {
                  console.log('RAG: Adding resource to knowledge base', {
                    title,
                  });

                  // Handle case where content might be an object
                  let contentText = content;
                  if (typeof content === 'object' && content !== null) {
                    const contentObj = content as { text?: string };
                    if (
                      contentObj.text &&
                      typeof contentObj.text === 'string'
                    ) {
                      contentText = contentObj.text;
                    } else {
                      // Try to convert to string if it's a complex object
                      contentText = JSON.stringify(content);
                    }
                  }

                  const result = await addResourceTool.handler(
                    { title, content: contentText },
                    session.user.id,
                  );
                  console.log('RAG: Resource added', result);
                  return result;
                },
              }),
              getInformation: tool({
                description:
                  "Retrieve relevant information from the EOS knowledge base to help answer the user's question.",
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
                  const result = await getInformationTool.handler({
                    query,
                    limit,
                  });
                  console.log(
                    `RAG: Retrieved ${result.results?.length || 0} results from knowledge base`,
                  );
                  return result;
                },
              }),
              cleanKnowledgeBase: tool({
                description:
                  "ADMIN ONLY: Remove content from the knowledge base that doesn't belong or is misleading. Only use when users specifically request to clean up the knowledge base.",
                parameters: z.object({
                  keyword: z
                    .string()
                    .describe(
                      'Keyword or phrase to remove from the knowledge base (e.g., "gala apples")',
                    ),
                }),
                execute: async ({ keyword }) => {
                  console.log(
                    'RAG: Request to clean knowledge base containing',
                    {
                      keyword,
                    },
                  );

                  try {
                    // Only certain users can use this tool
                    // For now, we'll disallow this for everyone except in development
                    if (process.env.NODE_ENV !== 'development') {
                      console.log(
                        'RAG: Unauthorized attempt to clean knowledge base',
                      );
                      return {
                        status: 'error',
                        message:
                          'Only system administrators can clean the knowledge base.',
                      };
                    }

                    const result = await deleteContentByKeyword(keyword);
                    console.log(
                      'RAG: Cleaned knowledge base, removed items:',
                      result,
                    );

                    return {
                      status: 'success',
                      message: `I've removed ${result.deleted} items containing "${keyword}" from the knowledge base.`,
                    };
                  } catch (error) {
                    console.error(
                      'RAG ERROR: Failed to clean knowledge base:',
                      error,
                    );
                    return {
                      status: 'error',
                      message:
                        'I encountered an error while cleaning the knowledge base.',
                    };
                  }
                },
              }),
            },
            onFinish: async ({ response }) => {
              if (session.user?.id) {
                try {
                  const assistantId = getTrailingMessageId({
                    messages: response.messages.filter(
                      (message) => message.role === 'assistant',
                    ),
                  });

                  if (!assistantId) {
                    throw new Error('No assistant message found!');
                  }

                  const [, assistantMessage] = appendResponseMessages({
                    messages: [message],
                    responseMessages: response.messages,
                  });

                  await saveMessages({
                    messages: [
                      {
                        id: assistantId,
                        chatId: id,
                        role: assistantMessage.role,
                        parts: assistantMessage.parts,
                        attachments:
                          assistantMessage.experimental_attachments ?? [],
                        createdAt: new Date(),
                        provider: selectedProvider,
                      },
                    ],
                  });
                } catch (error) {
                  console.error('Failed to save chat:', error);
                }
              }
            },
            experimental_telemetry: {
              isEnabled: isProductionEnvironment,
              functionId: 'stream-text',
            },
          });

          // Clear the timeout when the stream is done
          clearTimeout(responseTimeout);

          // Debug logs for the stream
          console.log('RAG: Creating stream with tools configured');

          try {
            // Safely check if getTools is available (not all models support this)
            if ('getTools' in result && typeof result.getTools === 'function') {
              console.log(
                'RAG: Tools available:',
                Object.keys(result.getTools()),
              );
            }

            // Consume and merge the stream
            result.consumeStream();
            result.mergeIntoDataStream(dataStream, {
              sendReasoning: true,
            });
          } catch (streamError) {
            console.error('RAG ERROR: Error processing stream:', streamError);
            // Don't rethrow, just log it and continue
          }
        } catch (error) {
          console.error('Fatal error in stream processing:', error);
          clearTimeout(responseTimeout);
          // We can't return a value here, but we've logged the error
        }
      },
      onError: (error) => {
        console.error('Error in data stream:', error);
        return 'Oops, an error occurred while processing your request!';
      },
    });

    // Special case - if the message includes "remember", automatically save it in case the model fails to use tools
    if (queryText.toLowerCase().includes('remember') && queryText.length > 15) {
      try {
        console.log('RAG: Auto-saving information from "remember" message');
        // Extract what to remember (everything after "remember that" or "remember")
        let contentToRemember = queryText;
        if (queryText.toLowerCase().includes('remember that')) {
          contentToRemember = queryText
            .substring(queryText.toLowerCase().indexOf('remember that') + 13)
            .trim();
        } else if (queryText.toLowerCase().includes('remember')) {
          contentToRemember = queryText
            .substring(queryText.toLowerCase().indexOf('remember') + 8)
            .trim();
        }

        // Only proceed if there's meaningful content
        if (contentToRemember.length > 3) {
          const title = `User Note: ${contentToRemember.substring(0, 30)}${contentToRemember.length > 30 ? '...' : ''}`;
          await addResourceTool.handler(
            { title, content: contentToRemember },
            session.user.id,
          );
          console.log('RAG: Auto-saved content from remember command');
        }
      } catch (saveError) {
        console.error('RAG: Error auto-saving content:', saveError);
      }
    }

    // Get the stream context for resumable streams
    const streamContext = getStreamContext();
    console.log(`Stream context available: ${!!streamContext}`);

    // Return the response
    if (streamContext) {
      try {
        console.log(`Using resumable stream with ID: ${streamId}`);
        const resumableStream = await streamContext.resumableStream(
          streamId,
          () => responseStream,
        );
        console.log(`Resumable stream created for ID: ${streamId}`);
        return new Response(resumableStream);
      } catch (streamError) {
        console.error(`Error with resumable stream: ${streamError}`);
        console.log('Falling back to direct response stream');
        return new Response(responseStream);
      }
    } else {
      console.log('Using direct response stream (no resumable context)');
      return new Response(responseStream);
    }
  } catch (error) {
    console.error('Unhandled error in chat POST route:', error);
    return new Response('An error occurred while processing your request!', {
      status: 500,
    });
  }
}

export async function GET(request: Request) {
  const streamContext = getStreamContext();

  if (!streamContext) {
    return new Response(null, { status: 204 });
  }

  const { searchParams } = new URL(request.url);
  const chatId = searchParams.get('chatId');

  if (!chatId) {
    return new Response('id is required', { status: 400 });
  }

  const session = await auth();

  if (!session?.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  let chat: Chat;

  try {
    chat = await getChatById({ id: chatId });
  } catch {
    return new Response('Not found', { status: 404 });
  }

  if (!chat) {
    return new Response('Not found', { status: 404 });
  }

  if (chat.visibility === 'private' && chat.userId !== session.user.id) {
    return new Response('Forbidden', { status: 403 });
  }

  const streamIds = await getStreamIdsByChatId({ chatId });

  if (!streamIds.length) {
    return new Response('No streams found', { status: 404 });
  }

  const recentStreamId = streamIds.at(-1);

  if (!recentStreamId) {
    return new Response('No recent stream found', { status: 404 });
  }

  const emptyDataStream = createDataStream({
    execute: () => {},
  });

  return new Response(
    await streamContext.resumableStream(recentStreamId, () => emptyDataStream),
    {
      status: 200,
    },
  );
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return new Response('Not Found', { status: 404 });
  }

  const session = await auth();

  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const chat = await getChatById({ id });

    if (chat.userId !== session.user.id) {
      return new Response('Forbidden', { status: 403 });
    }

    const deletedChat = await deleteChatById({ id });

    return Response.json(deletedChat, { status: 200 });
  } catch (error) {
    console.error(error);
    return new Response('An error occurred while processing your request!', {
      status: 500,
    });
  }
}
