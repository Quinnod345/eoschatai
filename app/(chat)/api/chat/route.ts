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
import { entitlementsByUserType, getActiveTools } from '@/lib/ai/entitlements';
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
import {
  addResourceTool,
  getInformationTool,
  getCalendarEventsTool,
  createCalendarEventTool,
} from '@/lib/ai/tools';
import { z } from 'zod';

export const maxDuration = 60;

let globalStreamContext: ResumableStreamContext | null = null;

function getStreamContext() {
  if (!globalStreamContext) {
    try {
      // Get REDIS_URL from environment and clean it (remove quotes if present)
      const redisUrl = process.env.REDIS_URL;
      if (redisUrl) {
        // Clean the URL by removing any quotes that might be causing issues
        const cleanRedisUrl = redisUrl.replace(/^["'](.*)["']$/, '$1');
        console.log('Creating resumable stream context with Redis');
      }

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

    // Check for @ mentions in the query text
    const mentionMatches = queryText.match(/@(\w+):([^\s]+)/g) || [];
    const detectedMentions = mentionMatches
      .map((mention) => {
        const [_, type, name] = mention.match(/@(\w+):(.+)/) || [];
        return { type, name };
      })
      .filter(Boolean);

    console.log(
      `Detected ${detectedMentions.length} @ mentions in query:`,
      detectedMentions,
    );

    // Track if we need to add special @ mention instructions
    let hasMentionedCalendar = false;
    let hasMentionedDocument = false;
    let hasMentionedScorecard = false;
    let hasMentionedVTO = false;
    let hasMentionedRocks = false;
    let hasMentionedPeople = false;

    // Check what resources were referenced with @ mentions
    if (detectedMentions.length > 0) {
      for (const mention of detectedMentions) {
        if (mention.type === 'calendar') hasMentionedCalendar = true;
        if (mention.type === 'document') hasMentionedDocument = true;
        if (mention.type === 'scorecard') hasMentionedScorecard = true;
        if (mention.type === 'vto') hasMentionedVTO = true;
        if (mention.type === 'rocks') hasMentionedRocks = true;
        if (mention.type === 'people') hasMentionedPeople = true;
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

    // Check if the user is asking about specific events in their calendar
    const eventTypeMatches =
      /(?:our|my|upcoming|next)\s+([a-z\s]+(?:session|meeting|review|appointment|event))/i.exec(
        queryText,
      );
    let shouldCheckCalendar =
      !!eventTypeMatches ||
      queryText.toLowerCase().includes('quarterly session') ||
      queryText.toLowerCase().includes('quarterly sessions') ||
      queryText.toLowerCase().includes('vision building') ||
      queryText.toLowerCase().includes('annual planning') ||
      queryText.toLowerCase().includes('focus day');

    // Extract the event type if present
    let eventType = '';
    if (eventTypeMatches?.[1]) {
      eventType = eventTypeMatches[1].trim();
      console.log(
        `Calendar: Detected request about event type: "${eventType}"`,
      );
    } else if (shouldCheckCalendar) {
      // Use specific named events
      if (
        queryText.toLowerCase().includes('quarterly session') ||
        queryText.toLowerCase().includes('quarterly sessions')
      )
        eventType = 'quarterly session';
      else if (queryText.toLowerCase().includes('vision building'))
        eventType = 'vision building';
      else if (queryText.toLowerCase().includes('annual planning'))
        eventType = 'annual planning';
      else if (queryText.toLowerCase().includes('focus day'))
        eventType = 'focus day';
      console.log(
        `Calendar: Detected request about specific event: "${eventType}"`,
      );
    }

    // If user is asking for help with a specific kind of session, we should check the calendar
    // This handles cases like "Can you help me prepare for our Quarterly Session?"
    if (
      !shouldCheckCalendar &&
      queryText.toLowerCase().includes('help') &&
      (queryText.toLowerCase().includes('prepare') ||
        queryText.toLowerCase().includes('ready'))
    ) {
      // Check for known EOS session types
      if (
        queryText.toLowerCase().includes('quarterly session') ||
        queryText.toLowerCase().includes('quarterly sessions')
      ) {
        shouldCheckCalendar = true;
        eventType = 'quarterly session';
        console.log(
          'Calendar: Detected preparation request for Quarterly Session',
        );
      } else if (queryText.toLowerCase().includes('vision building')) {
        shouldCheckCalendar = true;
        eventType = 'vision building';
        console.log(
          'Calendar: Detected preparation request for Vision Building',
        );
      } else if (queryText.toLowerCase().includes('annual planning')) {
        shouldCheckCalendar = true;
        eventType = 'annual planning';
        console.log(
          'Calendar: Detected preparation request for Annual Planning',
        );
      }
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

${
  selectedChatModel === 'chat-model-reasoning'
    ? `IMPORTANT REASONING MODEL LIMITATIONS:
This is the Reasoning model, which has limited tool access. You CANNOT:
1. Access calendar features
2. Save information to the knowledge base
3. Retrieve information from the knowledge base
4. Most other tool functionality

You CAN:
1. Create and update documents
2. Provide detailed step-by-step reasoning for complex problems
`
    : ''
}

${
  detectedMentions.length > 0
    ? `
@ MENTION INSTRUCTIONS:
The user has used @ mentions in their message. This indicates they want you to specifically focus on these linked resources.
${
  hasMentionedCalendar
    ? `
- Calendar mention detected: You should immediately check their calendar events by calling the getCalendarEvents tool. Present the results in a well-formatted table.
`
    : ''
}
${
  hasMentionedDocument
    ? `
- Document mention detected: Focus your response on the document content and any specific user documents uploaded to the knowledge base.
`
    : ''
}
${
  hasMentionedScorecard
    ? `
- Scorecard mention detected: Focus your response on EOS Scorecard concepts, measurables, and any scorecard content in their documents.
`
    : ''
}
${
  hasMentionedVTO
    ? `
- Vision/Traction Organizer (V/TO) mention detected: Focus your response on V/TO concepts and any V/TO content in their documents.
`
    : ''
}
${
  hasMentionedRocks
    ? `
- Rocks mention detected: Focus your response on the user's Rocks (priorities), quarterly goals, and any Rocks content in their documents.
`
    : ''
}
${
  hasMentionedPeople
    ? `
- People Analyzer mention detected: Focus your response on EOS People Analyzer concepts, GWC, and any people-related content in their documents.
`
    : ''
}

Remove the @ mention syntax from your response but focus heavily on the mentioned resources.
`
    : ''
}

IMPORTANT RESPONSE GUIDELINES:
1. When you use tools, NEVER display raw JSON responses in your replies.
2. For Calendar data:
   - Format them in a readable table or list format using markdown
   - Only display the title, date, time, and location of events
   - NEVER show the original response structure or raw data
   - NEVER mention technical details about formatting
   - If many events are returned, summarize them appropriately
3. When confirming event creation:
   - Simply state the event was created with its title and time
   - Do not show any event details as JSON or raw data structure
   - NEVER show any technical fields like 'id', 'htmlLink', etc.
4. CRITICAL CALENDAR RULE: If you notice JSON structures in your text that contain fields like "events", "status", or "_formatInstructions", DELETE THIS IMMEDIATELY and only show the properly formatted data.
5. This is especially critical for responses from the getCalendarEvents tool - NEVER emit raw JSON responses.
6. ALWAYS format calendar data as clean tables using Markdown, never as raw data.

AUTOMATIC CALENDAR INTELLIGENCE:
1. When the user message mentions any type of meeting, event, or session (like "Quarterly Session", "Vision Building", "Annual Planning"):
   - AUTOMATICALLY check their calendar for matching events 
   - If matching events exist, INCLUDE them in your response
   - If no matching events exist, DON'T mention the absence - simply respond to their question
2. DO NOT make the user explicitly ask "Do I have one coming up?" - be proactive!
3. When you find matching events, present them as a natural part of your response
4. Format event information in clear, easy-to-read tables

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

    // Add extra instructions about handling tool responses, particularly for calendar tools
    const toolResponseInstructions = `
CALENDAR DATA FORMATTING REQUIREMENTS:
1. NEVER show raw JSON output directly to the user
2. When displaying calendar events:
   - Format them in a readable table or list format using markdown
   - Only display the title, date, time, and location of events
   - NEVER show the original response structure or raw data
   - NEVER mention technical details about formatting
   - If many events are returned, summarize them appropriately
3. When confirming event creation:
   - Simply state the event was created with its title and time
   - Do not show any event details as JSON or raw data structure
   - NEVER show any technical fields like 'id', 'htmlLink', etc.
4. CRITICAL CALENDAR RULE: If you notice JSON structures in your text that contain fields like "events", "status", or "_formatInstructions", DELETE THIS IMMEDIATELY and only show the properly formatted data.
5. This is especially critical for responses from the getCalendarEvents tool - NEVER emit raw JSON responses.
6. ALWAYS format calendar data as clean tables using Markdown, never as raw data.

AUTOMATIC CALENDAR CHECK INSTRUCTIONS:
When the user asks about a specific type of event or session (like "Quarterly Session"), AUTOMATICALLY:
1. Check their calendar using the getCalendarEvents tool
2. If matching events exist, include them in your response WITHOUT mentioning the tool usage
3. If no matching events exist, focus on answering their original question without mentioning "I checked your calendar and found no events"
4. Be proactive - don't wait for them to explicitly ask "Do I have one coming up?"
5. For known EOS events like "Quarterly Session", "Vision Building", "Annual Planning", or "Focus Day", always check the calendar automatically
`;

    // Add special case for calendar questions with reasoning model
    if (
      selectedChatModel === 'chat-model-reasoning' &&
      (queryText.toLowerCase().includes('calendar') ||
        queryText.toLowerCase().includes('event') ||
        queryText.toLowerCase().includes('session') ||
        queryText.toLowerCase().includes('schedule') ||
        shouldCheckCalendar)
    ) {
      console.log(
        'Reasoning model: Adding special instructions for calendar-related query',
      );
      enhancedSystemPrompt += `

SPECIAL CALENDAR LIMITATION:
I notice you're asking about calendars, events, or scheduling. As a Reasoning model, I don't have access to calendar features. If you need to:
- Check your calendar
- Schedule events
- Find upcoming sessions
- Manage your appointments

Please switch to the regular Chat model using the model dropdown in the top-right corner. The Chat model has full calendar integration capabilities.
`;
    }

    // For document mentions
    if (
      (hasMentionedDocument ||
        hasMentionedScorecard ||
        hasMentionedVTO ||
        hasMentionedRocks ||
        hasMentionedPeople) &&
      selectedChatModel !== 'chat-model-reasoning'
    ) {
      try {
        console.log('Documents: Processing document-related @ mentions');

        // Here we'll add special prompt instructions to focus on document context
        // The document context is already loaded from fullSystemPrompt
        // But we'll add additional emphasis based on the specific document type mentioned

        const documentTypes = {
          document: hasMentionedDocument,
          scorecard: hasMentionedScorecard,
          vto: hasMentionedVTO,
          rocks: hasMentionedRocks,
          people: hasMentionedPeople,
        };

        // Get the specific document types that were mentioned
        const mentionedTypes = Object.entries(documentTypes)
          .filter(([_, mentioned]) => mentioned)
          .map(([type]) => type);

        // Create focused document context instructions
        if (mentionedTypes.length > 0) {
          enhancedSystemPrompt += `

DOCUMENT FOCUS INSTRUCTIONS:
The user has specifically requested information about: ${mentionedTypes.join(', ')}.

${
  hasMentionedDocument
    ? `
DOCUMENT MENTION:
- Focus on the user's uploaded documents
- Give specific information from their documents
- Don't give generic information if document content is available
`
    : ''
}

${
  hasMentionedScorecard
    ? `
SCORECARD MENTION:
- Focus on the user's Scorecard content
- Refer to their measurables, metrics, and KPIs
- Discuss specific numbers, targets, and owners if available
- Connect to Scorecard best practices when relevant
`
    : ''
}

${
  hasMentionedVTO
    ? `
VISION/TRACTION ORGANIZER (V/TO) MENTION:
- Focus on the user's V/TO content
- Reference their Core Values, Core Focus, and 10-Year Target
- Include their Marketing Strategy, 3 Uniques, and Proven Process
- Discuss their 3-Year Picture, 1-Year Plan, and Quarterly Rocks
`
    : ''
}

${
  hasMentionedRocks
    ? `
ROCKS MENTION:
- Focus on the user's quarterly priorities
- Discuss their Rocks - specific priorities for the current quarter
- Reference any Rock completion status if available
- Explain how these align with EOS Rocks best practices
`
    : ''
}

${
  hasMentionedPeople
    ? `
PEOPLE ANALYZER MENTION:
- Focus on the People Analyzer component of EOS
- Reference GWC (Get it, Want it, Capacity to do it)
- Discuss core values alignment in their team
- Provide specific information from their People Analyzer data if available
`
    : ''
}

Always prioritize the user's document content over generic information. If specific document content isn't available, clearly state this and provide best practices instead.
`;
        }
      } catch (docError) {
        console.error(
          'Documents: Error handling document @ mentions:',
          docError,
        );
      }
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
                    'getCalendarEvents',
                    'createCalendarEvent',
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

                  const result = await addResourceTool.execute(
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
                  const infoResult = await getInformationTool.execute(
                    { query, limit },
                    session.user.id,
                  );
                  console.log(
                    `RAG: Retrieved ${infoResult.results?.length || 0} results from knowledge base`,
                  );
                  return infoResult;
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
              // Add Google Calendar tools
              getCalendarEvents: tool({
                description:
                  "Get the user's upcoming calendar events. Use this when the user asks about their schedule, upcoming meetings, or events.",
                parameters: z.object({
                  timeMin: z
                    .string()
                    .optional()
                    .describe(
                      'The RFC3339 timestamp for the earliest time to fetch events from (defaults to now)',
                    ),
                  timeMax: z
                    .string()
                    .optional()
                    .describe(
                      'The RFC3339 timestamp for the latest time to fetch events to (defaults to 7 days from now)',
                    ),
                  maxResults: z
                    .number()
                    .optional()
                    .describe(
                      'Maximum number of events to return (default: 10)',
                    ),
                  searchTerm: z
                    .string()
                    .optional()
                    .describe(
                      'Optional search term to filter events by keyword in title or description',
                    ),
                }),
                execute: async ({
                  timeMin,
                  timeMax,
                  maxResults,
                  searchTerm,
                }) => {
                  console.log('Calendar: Tool called to get calendar events', {
                    timeMin,
                    timeMax,
                    maxResults,
                    searchTerm,
                  });

                  try {
                    // Use the direct tool.execute method to avoid URL construction issues
                    const calendarResult = await getCalendarEventsTool.execute(
                      { timeMin, timeMax, maxResults, searchTerm },
                      session.user.id,
                    );

                    console.log(
                      `Calendar: Retrieved ${
                        calendarResult.events?.length || 0
                      } events from calendar`,
                    );

                    // Add extra formatting instructions for AI to avoid raw JSON display
                    if (
                      calendarResult.status === 'success' &&
                      Array.isArray(calendarResult.events)
                    ) {
                      // Structure the data in a way that forces proper formatting and prevents raw display
                      return {
                        status: 'success',
                        message: `Found ${calendarResult.events.length} upcoming events in your calendar.`,
                        _formatInstructions:
                          "CRITICAL: Present these events ONLY in a properly formatted table or list, NEVER as raw JSON. Only include date, time, title, and location in your presentation. NEVER show properties like 'id', 'htmlLink', or any technical details. NEVER show the raw JSON object in your response. Do not use code blocks to display this data. Format calendar events using markdown as a table (| Title | Date | Time | Location |) or a clear list format with bold headers. If you start to output any JSON with curly braces, STOP IMMEDIATELY and reformat.",
                        isCalendarEvents: true, // Flag to signal this is calendar data
                        hideJSON: true, // Flag to signal this should not be shown as JSON
                        formattedEvents: calendarResult.events.map(
                          (event: {
                            start?: { dateTime?: string };
                            summary?: string;
                            location?: string;
                            [key: string]: any;
                          }) => ({
                            title: event.summary || 'Untitled Event',
                            date: event.start?.dateTime
                              ? new Date(
                                  event.start.dateTime,
                                ).toLocaleDateString()
                              : 'No date',
                            time: event.start?.dateTime
                              ? new Date(
                                  event.start.dateTime,
                                ).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : 'No time',
                            location: event.location || 'No location',
                          }),
                        ),
                      };
                    }

                    return calendarResult;
                  } catch (error) {
                    console.error('Calendar tool error:', error);
                    return {
                      status: 'error',
                      message:
                        'Failed to fetch calendar events. Please try again.',
                      error:
                        error instanceof Error ? error.message : String(error),
                    };
                  }
                },
              }),
              createCalendarEvent: tool({
                description:
                  "Create a new event in the user's Google Calendar. Use this when the user wants to schedule a meeting or add an event to their calendar.",
                parameters: z.object({
                  summary: z
                    .string()
                    .describe('The title/summary of the event'),
                  description: z
                    .string()
                    .optional()
                    .describe('Optional detailed description of the event'),
                  location: z
                    .string()
                    .optional()
                    .describe('Optional location of the event'),
                  startDateTime: z
                    .string()
                    .describe(
                      'The RFC3339 timestamp for the start time of the event',
                    ),
                  endDateTime: z
                    .string()
                    .describe(
                      'The RFC3339 timestamp for the end time of the event',
                    ),
                  attendees: z
                    .array(z.string())
                    .optional()
                    .describe('Optional list of email addresses of attendees'),
                }),
                execute: async ({
                  summary,
                  description,
                  location,
                  startDateTime,
                  endDateTime,
                  attendees,
                }) => {
                  console.log(
                    'Calendar: Tool called to create calendar event',
                    {
                      summary,
                      startDateTime,
                      endDateTime,
                    },
                  );

                  try {
                    // Use direct tool execution with proper error handling
                    const eventResult = await createCalendarEventTool.execute(
                      {
                        summary,
                        description,
                        location,
                        startDateTime,
                        endDateTime,
                        attendees,
                      },
                      session.user.id,
                    );

                    console.log(
                      `Calendar: ${
                        eventResult.status === 'success'
                          ? 'Successfully created'
                          : 'Failed to create'
                      } calendar event`,
                    );

                    // Add formatting instructions to prevent raw JSON display
                    if (eventResult.status === 'success') {
                      const startDate = new Date(
                        startDateTime,
                      ).toLocaleString();
                      return {
                        status: 'success',
                        isCalendarEvent: true, // Flag to signal this is calendar data
                        hideJSON: true, // Flag to signal this should not be shown as JSON
                        _formatInstructions:
                          'CRITICAL: Confirm the event was created with a simple sentence, NEVER as raw JSON. NEVER show any raw JSON or object data. NEVER display function call syntax, API responses, or JSON objects in your response. If you start to output any JSON with curly braces, STOP IMMEDIATELY and reformat.',
                        message: `Successfully created event "${summary}" for ${startDate}.`,
                        eventDetails: {
                          title: summary,
                          date: new Date(startDateTime).toLocaleDateString(),
                          time: new Date(startDateTime).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          }),
                          location: location || 'No location',
                        },
                      };
                    }

                    return eventResult;
                  } catch (error) {
                    console.error('Calendar create event error:', error);
                    return {
                      status: 'error',
                      message:
                        'Failed to create calendar event. Please try again.',
                      error:
                        error instanceof Error ? error.message : String(error),
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

            // Remove the stream processing code
            result.consumeStream();
            result.mergeIntoDataStream(dataStream, {
              sendReasoning: false,
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
          await addResourceTool.execute(
            { title, content: contentToRemember },
            session.user.id,
          );
          console.log('RAG: Auto-saved content from remember command');
        }
      } catch (saveError) {
        console.error('RAG: Error auto-saving content:', saveError);
      }
    }

    // Handle @ mention resource requests
    // For calendar mentions
    if (hasMentionedCalendar && selectedChatModel !== 'chat-model-reasoning') {
      try {
        console.log('Calendar: Auto-checking calendar from @ mention');

        // Create timeMin and timeMax for next 3 months
        const now = new Date();
        const threeMonthsLater = new Date();
        threeMonthsLater.setMonth(now.getMonth() + 3);

        try {
          // Directly call the calendar API to ensure results are available for the AI
          console.log('Calendar: Executing calendar tool from @ mention');

          getCalendarEventsTool
            .execute(
              {
                timeMin: now.toISOString(),
                timeMax: threeMonthsLater.toISOString(),
                maxResults: 15,
              },
              session.user.id,
            )
            .then((calendarResult) => {
              console.log(
                `Calendar @ mention: Retrieved ${calendarResult.events?.length || 0} events`,
              );

              // Update the system prompt with the calendar results
              if (
                calendarResult.status === 'success' &&
                Array.isArray(calendarResult.events) &&
                calendarResult.events.length > 0
              ) {
                enhancedSystemPrompt += `

CALENDAR RESULTS FROM @ MENTION:
The user has requested calendar information. Here are their upcoming events:

| Event | Date | Time | Location |
|-------|------|------|----------|
${calendarResult.events
  .map(
    (event: {
      summary?: string;
      start?: { dateTime?: string };
      location?: string;
    }) => {
      const eventDate = event.start?.dateTime
        ? new Date(event.start.dateTime).toLocaleDateString()
        : 'No date';
      const eventTime = event.start?.dateTime
        ? new Date(event.start.dateTime).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })
        : 'No time';
      return `| ${event.summary || 'Untitled Event'} | ${eventDate} | ${eventTime} | ${event.location || 'No location'} |`;
    },
  )
  .join('\n')}

Present this information to the user in a clear and readable format. Format it as a table using markdown syntax.
`;
              } else if (
                calendarResult.status === 'error' &&
                calendarResult.authRequired
              ) {
                enhancedSystemPrompt += `

CALENDAR CONNECTION ISSUE:
The user mentioned calendar, but they need to connect their Google Calendar in Settings > Integrations.
Please inform them of this requirement.
`;
              } else {
                enhancedSystemPrompt += `

CALENDAR RESULTS FROM @ MENTION:
No upcoming events found in the user's calendar.
`;
              }
            })
            .catch((error) => {
              console.error(
                'Calendar: Error retrieving events for @ mention:',
                error,
              );
            });
        } catch (toolError) {
          console.error(
            'Calendar: Failed to execute calendar tool for @ mention:',
            toolError,
          );
        }
      } catch (mentionError) {
        console.error('Calendar: Error in @ mention processing:', mentionError);
      }
    }

    // Auto-check calendar for specific event types
    if (
      shouldCheckCalendar &&
      eventType &&
      selectedChatModel !== 'chat-model-reasoning'
    ) {
      try {
        console.log(`Calendar: Auto-checking for "${eventType}" events`);

        // Create timeMin and timeMax for next 6 months
        const now = new Date();
        const sixMonthsLater = new Date();
        sixMonthsLater.setMonth(now.getMonth() + 6);

        // Save the event type to use in the query later
        const calendarEventType = eventType;

        // Pre-emptively call getCalendarEvents to check for matching event types
        // This way the AI will have access to this information without explicitly calling the tool
        console.log(
          `Calendar: Triggering auto-calendar check for "${calendarEventType}" events`,
        );

        try {
          // Directly execute the calendar tool with a 6-month range
          getCalendarEventsTool
            .execute(
              {
                timeMin: now.toISOString(),
                timeMax: sixMonthsLater.toISOString(),
                maxResults: 20,
                searchTerm: calendarEventType,
              },
              session.user.id,
            )
            .then((calendarResult) => {
              console.log(
                `Calendar: Auto-check complete, found ${calendarResult.events?.length || 0} events`,
              );

              // Since we're using searchTerm, we don't need the additional filtering here
              if (
                calendarResult.status === 'success' &&
                Array.isArray(calendarResult.events)
              ) {
                const matchingEvents = calendarResult.events;

                console.log(
                  `Calendar: Found ${matchingEvents.length} events matching "${calendarEventType}"`,
                );

                // This data will be available to the AI model during its response generation
                enhancedSystemPrompt += `

CALENDAR SEARCH RESULTS:
The user asked about "${calendarEventType}". ${
                  matchingEvents.length > 0
                    ? `There are ${matchingEvents.length} matching events in their calendar:`
                    : `There are no matching events in their calendar.`
                }
${
  matchingEvents.length > 0
    ? `
Here are the matching events:

| Event | Date | Time | Location |
|-------|------|------|----------|
${matchingEvents
  .map(
    (event: {
      summary?: string;
      start?: { dateTime?: string };
      location?: string;
    }) => {
      const eventDate = event.start?.dateTime
        ? new Date(event.start.dateTime).toLocaleDateString()
        : 'No date';
      const eventTime = event.start?.dateTime
        ? new Date(event.start.dateTime).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })
        : 'No time';
      return `| ${event.summary || 'Untitled Event'} | ${eventDate} | ${eventTime} | ${event.location || 'No location'} |`;
    },
  )
  .join('\n')}
`
    : ''
}
                
${
  matchingEvents.length > 0
    ? 'IMPORTANT: Include this information in your response using the table format above. NEVER mention that you searched their calendar or that you found these events. Simply respond to their question first, then mention "I see you have the following on your calendar:" and include the table. Format it nicely with a clear header row and well-aligned columns.'
    : 'You should NOT mention that there are no events found. Just answer their question without referencing their calendar.'
}
`;
              }
            })
            .catch((error) => {
              console.error(
                'Calendar: Auto-check calendar event search failed:',
                error,
              );
            });
        } catch (toolError) {
          console.error(
            'Calendar: Failed to execute calendar tool:',
            toolError,
          );
        }
      } catch (calendarError) {
        console.error('Calendar: Error in auto-calendar check:', calendarError);
      }
    }

    // Get the stream context for resumable streams
    const streamContext = getStreamContext();
    console.log(`Stream context available: ${!!streamContext}`);

    // Return the response with improved error handling and fallback
    if (streamContext) {
      try {
        console.log(`Using resumable stream with ID: ${streamId}`);

        // Add a timeout to detect stalled streams
        const streamPromise = streamContext.resumableStream(
          streamId,
          () => responseStream,
        );

        // Create a timeout promise
        const timeoutPromise = new Promise<null>((_, reject) => {
          setTimeout(() => {
            reject(new Error('Resumable stream creation timed out'));
          }, 10000); // 10 second timeout for stream creation
        });

        // Race the stream creation against the timeout
        const resumableStream = await Promise.race([
          streamPromise,
          timeoutPromise,
        ]).catch((error) => {
          console.error(`Resumable stream error or timeout: ${error}`);
          console.log('Falling back to direct response stream');
          return responseStream;
        });

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
