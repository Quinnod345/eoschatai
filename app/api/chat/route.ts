import {
  appendClientMessage,
  appendResponseMessages,
  createDataStream,
  smoothStream,
  streamText,
  tool,
  generateText,
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
import { generateTitleFromUserMessage } from '@/app/(chat)/actions';
import { createDocument } from '@/lib/ai/tools/create-document';
import { updateDocument } from '@/lib/ai/tools/update-document';
import { requestSuggestions } from '@/lib/ai/tools/request-suggestions';
import { getWeather } from '@/lib/ai/tools/get-weather';
import { isProductionEnvironment } from '@/lib/constants';
import { createCustomProvider } from '@/lib/ai/providers';
import { entitlementsByUserType } from '@/lib/ai/entitlements';
import {
  postRequestBodySchema,
  type PostRequestBody,
} from '@/app/(chat)/api/chat/schema';
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
import { MentionProcessor } from '@/lib/ai/mention-processor';
import { SmartMentionDetector } from '@/lib/ai/smart-mention-detector';
import {
  extractCitationsFromResults,
  type Citation,
} from '@/lib/ai/citation-formatter';
// import { documentHandlersByComposerKind } from '@/lib/composer/server';

export const maxDuration = 60;

let globalStreamContext: ResumableStreamContext | null = null;

function getStreamContext() {
  if (!globalStreamContext) {
    try {
      // Get REDIS_URL from environment and clean it (remove quotes if present)
      const redisUrl = process.env.REDIS_URL;
      console.log('Redis URL check:', {
        hasRedisUrl: !!redisUrl,
        redisUrlLength: redisUrl?.length || 0,
        redisUrlPrefix: redisUrl?.substring(0, 10) || 'none',
      });

      if (!redisUrl) {
        console.log(
          ' > Resumable streams are disabled due to missing REDIS_URL',
        );
        return null;
      }

      // Clean the URL by removing any quotes that might be causing issues
      const cleanRedisUrl = redisUrl.replace(/^["'](.*)["']$/, '$1');
      console.log(
        'Creating resumable stream context with Redis URL:',
        `${cleanRedisUrl.substring(0, 20)}...`,
      );

      // Set the cleaned Redis URL back to the environment for the resumable stream context
      process.env.REDIS_URL = cleanRedisUrl;

      globalStreamContext = createResumableStreamContext({
        waitUntil: after,
      });

      // Debug log for stream context
      console.log('Stream context created successfully with Redis');
      console.log('Stream context type:', typeof globalStreamContext);
      console.log(
        'Stream context methods:',
        Object.getOwnPropertyNames(globalStreamContext),
      );
    } catch (error: any) {
      console.error('Error creating stream context:', error);
      console.error('Error stack:', error.stack);
      console.log('Falling back to non-resumable streams');
      return null;
    }
  }

  return globalStreamContext;
}

// Lightweight preflight to pick model and suggest a token budget using GPT-4.1-nano
async function decideModelWithNano(args: {
  provider: ReturnType<typeof createCustomProvider>;
  queryText: string;
  hasCodeOrMath: boolean;
  mode?: 'nexus' | 'standard';
  hasComposerOpen?: boolean;
}): Promise<{ model: 'gpt-4.1' | 'gpt-5'; maxTokens: number }> {
  const {
    provider,
    queryText,
    hasCodeOrMath,
    mode = 'standard',
    hasComposerOpen = false,
  } = args;
  console.log('[PREFLIGHT] Starting nano preflight', {
    mode,
    hasComposerOpen,
    hasCodeOrMath,
    queryLength: (queryText || '').length,
  });
  const { text } = await generateText({
    model: provider.languageModel('gpt-4.1-nano'),
    system: `You are a token allocation grader. Decide the optimal OpenAI model and output token budget ONLY from the task text and context below.

MODEL SELECTION (be conservative with GPT-5):
- Use GPT-4.1 for most tasks: explanations, tutorials, code generation, troubleshooting, planning, documentation.
- Use GPT-5 ONLY when there is clearly: extremely complex multi-step reasoning, advanced mathematical derivations/proofs, exhaustive enterprise-scale planning, or the task explicitly demands maximum depth.

TOKEN BUDGET TIERS (choose one range, then pick a value inside it):
- Minimal: 200–400
- Light: 400–900
- Standard: 900–1800
- Comprehensive: 1800–3200
- Extensive: 3200–6000
- Massive: 6000–12000

INTELLIGENCE SIGNALS:
- Increase tokens for: "comprehensive", "in depth", "step-by-step", "guide", "documentation", multi-part requests, requests for examples, comparisons, strategies.
- Decrease tokens for: "quick", "brief", "short", "summary", simple yes/no, single-sentence asks.
- Code/programming: +30–40% tokens baseline.
- Math/derivations: +30–40% tokens baseline.

MODE CONTEXT:
- mode: ${mode}
- composer_open: ${hasComposerOpen}
If mode is nexus, allow higher budgets within limits. If an composer is open, still return a single budget for the chat model.

Return STRICT JSON: {"model":"gpt-4.1"|"gpt-5","max_tokens":<integer 200..100000>}. No commentary.`,
    prompt: `task: ${queryText}\ncode_or_math: ${hasCodeOrMath}`,
    maxTokens: 128,
    temperature: 0,
  });
  const cleaned = text.trim().replace(/^```json\s*|\s*```$/g, '');
  const parsed = JSON.parse(cleaned);
  const model = parsed.model === 'gpt-5' ? 'gpt-5' : 'gpt-4.1';
  const maxTokens = Number(parsed.max_tokens);
  if (!Number.isFinite(maxTokens)) {
    throw new Error('Nano preflight returned invalid max_tokens');
  }
  console.log('[PREFLIGHT] Decision', { model, maxTokens });
  return { model, maxTokens: Math.max(200, Math.floor(maxTokens)) };
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
      selectedProvider = 'openai',
      selectedPersonaId,
      selectedProfileId,
      selectedResearchMode,
      composerDocumentId,
    } = requestBody;

    console.log('PERSONA_CHAT_API: Request received', {
      chatId: id,
      selectedPersonaId: selectedPersonaId,
      selectedProfileId: selectedProfileId,
      selectedResearchMode: selectedResearchMode,
      composerDocumentId: composerDocumentId,
      hasPersona: !!selectedPersonaId,
      hasProfile: !!selectedProfileId,
      hasComposer: !!composerDocumentId,
      timestamp: new Date().toISOString(),
      requestBody: JSON.stringify(requestBody, null, 2),
    });

    // Add explicit Nexus mode logging
    console.log('[NEXUS MODE DEBUG] Research mode:', {
      selectedResearchMode,
      isNexusMode: selectedResearchMode === 'nexus',
      typeOfSelectedResearchMode: typeof selectedResearchMode,
    });

    const session = await auth();

    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Set the user type
    const userType: UserType = session.user.type || 'regular';

    const messageCount = await getMessageCountByUserId({
      id: session.user.id,
      differenceInHours: 24,
    });

    if (messageCount > entitlementsByUserType[userType].maxMessagesPerDay) {
      return new Response('You have reached your daily message limit.', {
        status: 429,
      });
    }

    const chat = await getChatById({ id });

    if (!chat) {
      console.log('PERSONA_CHAT_API: Creating new chat', {
        chatId: id,
        userId: session.user.id,
        personaId: selectedPersonaId,
      });

      const title = await generateTitleFromUserMessage({
        message,
      });

      console.log('PERSONA_CHAT_API: Before UUID conversion', {
        chatId: id,
        selectedPersonaId: selectedPersonaId,
        isEosImplementerString: selectedPersonaId === 'eos-implementer',
      });

      // Handle hardcoded EOS implementer persona - store metadata in title
      let personaIdToSave: string | null = selectedPersonaId || null;
      let profileIdToSave: string | null = selectedProfileId || null;
      let titleWithMetadata = title;

      if (
        selectedPersonaId === 'eos-implementer' ||
        selectedPersonaId === '00000000-0000-0000-0000-000000000001'
      ) {
        // Store null for persona but encode metadata in title
        personaIdToSave = null;
        profileIdToSave = null;

        // Encode the EOS Implementer selection in the title as metadata
        const metadata = {
          persona: 'eos-implementer',
          profile: selectedProfileId || null,
        };
        titleWithMetadata = `${title}|||EOS_META:${JSON.stringify(metadata)}`;

        console.log(
          'PERSONA_CHAT_API: EOS Implementer detected, storing metadata in title',
          {
            from: selectedPersonaId,
            profileFrom: selectedProfileId,
            metadata: metadata,
          },
        );
      }

      await saveChat({
        id,
        userId: session.user.id,
        title: titleWithMetadata,
        visibility: selectedVisibilityType,
        personaId: personaIdToSave || undefined,
        profileId: profileIdToSave || undefined,
      });

      console.log('PERSONA_CHAT_API: New chat created with persona', {
        chatId: id,
        personaId: selectedPersonaId,
        profileId: selectedProfileId,
        title: title,
      });
    } else {
      console.log('PERSONA_CHAT_API: Using existing chat', {
        chatId: id,
        existingPersonaId: chat.personaId,
        requestPersonaId: selectedPersonaId,
      });

      if (chat.userId !== session.user.id) {
        return new Response('Forbidden', { status: 403 });
      }
    }

    const previousMessages = await getMessagesByChatId({ id });

    const normalizedPreviousMessages = previousMessages.map((dbMessage) => ({
      ...dbMessage,
      experimental_attachments: Array.isArray(dbMessage.attachments)
        ? dbMessage.attachments
        : [],
    }));

    const messages = appendClientMessage({
      // @ts-expect-error: todo add type conversion from DBMessage[] to UIMessage[]
      messages: normalizedPreviousMessages,
      message,
    });

    // Get the last user message to use for RAG context retrieval
    const lastUserMessage = message.parts[0];
    console.log('RAG: Processing chat request with query:', lastUserMessage);
    console.log('RAG: Message structure:', {
      messageId: message.id,
      messageRole: message.role,
      messageContent: message.content,
      messageParts: message.parts,
      partsLength: message.parts?.length,
      firstPartType: typeof lastUserMessage,
      firstPartValue: lastUserMessage,
    });

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

    // Check if the message contains inline document uploads
    const hasInlineDocuments =
      queryText.includes('=== PDF Content from') ||
      queryText.includes('=== Word Document Content from') ||
      queryText.includes('=== Spreadsheet Content from') ||
      queryText.includes('=== Image Analysis for');

    if (hasInlineDocuments) {
      console.log('RAG: Detected inline document upload in user message');
    }

    console.log('RAG: Extracted queryText:', {
      queryText,
      queryTextLength: queryText.length,
      isEmpty: queryText.length === 0,
    });

    // For RAG purposes, extract just the user's actual question without inline documents
    let ragQueryText = queryText;
    if (hasInlineDocuments) {
      // Extract just the user's question part, removing inline document content for RAG search
      const beforeDoc = queryText.split('=== ')[0].trim();
      const afterDocMatch = queryText.match(/=== End of .* ===\s*(.*)$/s);
      ragQueryText = beforeDoc + (afterDocMatch ? ` ${afterDocMatch[1]}` : '');
      console.log(
        'RAG: Extracted user question from inline document message:',
        ragQueryText,
      );
    }

    // Enhanced mention processing with smart detection
    const extractedMentions = MentionProcessor.extractMentions(queryText);
    const implicitMentions =
      SmartMentionDetector.detectImplicitMentions(queryText);

    // Combine explicit and implicit mentions
    const allMentions = [
      ...extractedMentions,
      ...implicitMentions.map((im) => ({
        type: im.type,
        id: im.type,
        name: im.trigger,
        metadata: {
          confidence: im.confidence,
          implicit: true,
          context: im.context,
        },
      })),
    ];

    const mentionResult = MentionProcessor.processMentions(
      allMentions,
      queryText,
    );

    console.log(
      `Detected ${extractedMentions.length} explicit @ mentions and ${implicitMentions.length} implicit mentions:`,
      { explicit: extractedMentions, implicit: implicitMentions },
    );

    if (mentionResult.toolsToActivate.length > 0) {
      console.log(
        'Mentions suggest activating tools:',
        mentionResult.toolsToActivate,
      );
    }

    // Generate smart suggestions for the user
    const smartSuggestions =
      SmartMentionDetector.generateSmartSuggestions(queryText);
    if (smartSuggestions.length > 0) {
      console.log('Smart mention suggestions:', smartSuggestions);
    }

    // Legacy compatibility flags
    const hasMentionedCalendar = extractedMentions.some((m) =>
      ['calendar', 'event', 'meeting'].includes(m.type),
    );
    const hasMentionedDocument = extractedMentions.some((m) =>
      ['document', 'file'].includes(m.type),
    );
    const hasMentionedScorecard = extractedMentions.some(
      (m) => m.type === 'scorecard',
    );
    const hasMentionedVTO = extractedMentions.some((m) => m.type === 'vto');
    const hasMentionedRocks = extractedMentions.some((m) => m.type === 'rocks');
    const hasMentionedPeople = extractedMentions.some((m) =>
      ['user', 'team', 'contact'].includes(m.type),
    );

    // Execute both RAG operations in parallel for better performance
    console.log('RAG: Starting parallel RAG operations...');
    const ragStartTime = Date.now();

    const [
      relevantContent,
      userRagContext,
      personaRagContext,
      systemRagContext,
    ] = await Promise.all([
      // General RAG (Knowledge Base) - Company RAG
      queryText
        ? (() => {
            const generalRagStart = Date.now();
            return findRelevantContent(ragQueryText, 5)
              .then((content) => {
                const generalRagTime = Date.now() - generalRagStart;
                console.log(
                  `Company RAG: Retrieved ${content.length} chunks from vector store in ${generalRagTime}ms`,
                );
                if (content.length > 0) {
                  console.log(
                    'Company RAG: Top result:',
                    `${content[0].content.substring(0, 100)}...`,
                    `(relevance: ${(content[0].relevance * 100).toFixed(1)}%)`,
                  );
                }
                return content;
              })
              .catch((error) => {
                const generalRagTime = Date.now() - generalRagStart;
                console.error(
                  `Company RAG: Error retrieving relevant content after ${generalRagTime}ms:`,
                  error,
                );
                return [];
              });
          })()
        : Promise.resolve([]),

      // User RAG (User Documents)
      session.user.id && queryText
        ? (() => {
            const userRagStart = Date.now();
            return import('@/lib/ai/prompts')
              .then(({ userRagContextPrompt }) =>
                userRagContextPrompt(session.user.id, ragQueryText),
              )
              .then((context) => {
                const userRagTime = Date.now() - userRagStart;
                console.log(
                  `User RAG: Generated context with ${context.length} characters in ${userRagTime}ms`,
                );

                // Debug: Log first 200 characters of user RAG context
                if (context.length > 0) {
                  console.log(
                    `User RAG: Context preview: ${context.substring(0, 200)}...`,
                  );
                }
                return context;
              })
              .catch((error) => {
                const userRagTime = Date.now() - userRagStart;
                console.error(
                  `User RAG: Error getting user RAG context after ${userRagTime}ms:`,
                  error,
                );
                return '';
              });
          })()
        : Promise.resolve(''),

      // Persona RAG (Persona Documents) - Only if persona is selected
      selectedPersonaId && queryText
        ? (() => {
            const personaRagStart = Date.now();
            console.log(
              `Persona RAG: Starting retrieval for persona ${selectedPersonaId} with query: "${queryText}"`,
            );

            return import('@/lib/ai/persona-rag')
              .then(({ personaRagContextPrompt }) =>
                personaRagContextPrompt(
                  selectedPersonaId,
                  ragQueryText,
                  session.user.id,
                ),
              )
              .then((context) => {
                const personaRagTime = Date.now() - personaRagStart;
                console.log(
                  `Persona RAG: Generated context with ${context.length} characters in ${personaRagTime}ms`,
                );

                // Debug: Log first 200 characters of persona RAG context
                if (context.length > 0) {
                  console.log(
                    `Persona RAG: Context preview: ${context.substring(0, 200)}...`,
                  );
                }
                return context;
              })
              .catch((error) => {
                const personaRagTime = Date.now() - personaRagStart;
                console.error(
                  `Persona RAG: Error getting persona RAG context after ${personaRagTime}ms:`,
                  error,
                );
                return '';
              });
          })()
        : Promise.resolve(''),

      // System RAG (System Persona Documents) - Only if system persona is selected
      selectedPersonaId && queryText
        ? (() => {
            const systemRagStart = Date.now();
            console.log(
              `System RAG: Starting retrieval for persona ${selectedPersonaId}, profile ${selectedProfileId} with query: "${queryText}"`,
            );

            // Check if this is the hardcoded EOS implementer
            if (selectedPersonaId === 'eos-implementer') {
              console.log(
                `System RAG: Using hardcoded EOS implementer, profile: ${selectedProfileId}`,
              );

              // For hardcoded EOS implementer, use the new Upstash system RAG
              return import('@/lib/ai/upstash-system-rag')
                .then(({ upstashSystemRagContextPrompt }) =>
                  upstashSystemRagContextPrompt(
                    selectedProfileId || null,
                    ragQueryText,
                  ),
                )
                .then((context) => {
                  const systemRagTime = Date.now() - systemRagStart;
                  console.log(
                    `Upstash System RAG: Generated context with ${context.length} characters in ${systemRagTime}ms`,
                  );

                  // Debug: Log first 200 characters of system RAG context
                  if (context.length > 0) {
                    console.log(
                      `Upstash System RAG: Context preview: ${context.substring(0, 200)}...`,
                    );
                  }
                  return context;
                })
                .catch((error) => {
                  const systemRagTime = Date.now() - systemRagStart;
                  console.error(
                    `Upstash System RAG: Error getting system RAG context after ${systemRagTime}ms:`,
                    error,
                  );
                  return '';
                });
            }

            // For database personas, check if it's a system persona
            return import('@/lib/db')
              .then(async ({ db }) => {
                const { persona } = await import('@/lib/db/schema');
                const { eq } = await import('drizzle-orm');

                const [personaData] = await db
                  .select()
                  .from(persona)
                  .where(eq(persona.id, selectedPersonaId))
                  .limit(1);

                if (!personaData?.isSystemPersona) {
                  console.log(
                    `System RAG: Persona ${selectedPersonaId} is not a system persona, skipping`,
                  );
                  return '';
                }

                console.log(
                  `System RAG: Confirmed ${personaData.name} is a system persona`,
                );

                // Import and call systemRagContextPrompt
                const { systemRagContextPrompt } = await import(
                  '@/lib/ai/system-rag'
                );
                return systemRagContextPrompt(
                  selectedPersonaId,
                  selectedProfileId || null,
                  ragQueryText,
                );
              })
              .then((context) => {
                const systemRagTime = Date.now() - systemRagStart;
                console.log(
                  `System RAG: Generated context with ${context.length} characters in ${systemRagTime}ms`,
                );

                // Debug: Log first 200 characters of system RAG context
                if (context.length > 0) {
                  console.log(
                    `System RAG: Context preview: ${context.substring(0, 200)}...`,
                  );
                }
                return context;
              })
              .catch((error) => {
                const systemRagTime = Date.now() - systemRagStart;
                console.error(
                  `System RAG: Error getting system RAG context after ${systemRagTime}ms:`,
                  error,
                );
                return '';
              });
          })()
        : Promise.resolve(''),
    ]);

    const ragEndTime = Date.now();
    console.log(
      `RAG: All parallel operations completed in ${ragEndTime - ragStartTime}ms`,
    );

    // Nexus Research (Nexus Mode) - Will be performed in the data stream with progress updates
    let nexusResearchContext = '';
    const nexusResults: any[] = [];

    // Log results summary
    if (!queryText) {
      console.log(
        'RAG: No text content found in user message to use for retrieval',
      );
    } else {
      console.log(
        `RAG Summary:`,
        `\n  - Company knowledge base: ${relevantContent.length} chunks`,
        `\n  - User documents: ${userRagContext.length} characters`,
        `\n  - Persona documents: ${personaRagContext.length} characters`,
        `\n  - System knowledge: ${systemRagContext.length} characters`,
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

    // Only create stream ID if Redis is available
    const redisContext = getStreamContext();
    if (redisContext) {
      try {
        await createStreamId({ streamId, chatId: id });
      } catch (error) {
        console.error('Failed to create stream ID:', error);
        // Continue without stream ID - chat will still work
      }
    } else {
      console.log('Skipping stream ID creation - no Redis available');
    }

    // Create a provider based on selected provider
    const provider = createCustomProvider(selectedProvider);

    // Get the system prompt with both general RAG and user RAG context
    const fullSystemPrompt = await systemPrompt({
      selectedProvider,
      requestHints,
      ragContext: relevantContent, // General knowledge base RAG
      userRagContext: userRagContext, // User-specific document context
      personaRagContext: personaRagContext, // Persona-specific document context
      systemRagContext: systemRagContext, // System-specific document context
      userId: session.user.id,
      userEmail: session.user.email || '', // Add userEmail for hardcoded EOS implementer access
      query: queryText,
      selectedPersonaId: selectedPersonaId, // Pass the selected persona ID
      selectedProfileId: selectedProfileId, // Pass the selected profile ID
      composerDocumentId: composerDocumentId, // Pass the composer document ID if present
    });

    // Log document context usage
    const hasUserDocs = fullSystemPrompt.includes('## USER DOCUMENT CONTEXT');
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
    let enhancedSystemPrompt = `${fullSystemPrompt}${nexusResearchContext}

${
  hasInlineDocuments
    ? `
URGENT: INLINE DOCUMENT DETECTED
The user has just uploaded a document DIRECTLY in their message. This is NOT from the knowledge base.
You MUST focus on the document content between the === delimiters in their message.
This is what they are asking you to work with RIGHT NOW.
DO NOT confuse this with RAG content or knowledge base documents.
`
    : ''
}

${
  allMentions.length > 0
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
1. **NEVER RESPOND WITH GENERIC MESSAGES**: If you receive a user query, ALWAYS provide a substantive, helpful response. NEVER say "your message is blank" or "how can I help you" when document context is provided.

2. **DOCUMENT CONTEXT PRIORITY**: When user document context is included in the system prompt, it means the user has uploaded documents and is asking about their specific business. ALWAYS use this information to provide detailed, personalized responses.

3. When you use tools, NEVER display raw JSON responses in your replies.

4. For Calendar data:
   - Format them in a readable table or list format using markdown
   - Only display the title, date, time, and location of events
   - NEVER show the original response structure or raw data
   - NEVER mention technical details about formatting
   - If many events are returned, summarize them appropriately

5. When confirming event creation:
   - Simply state the event was created with its title and time
   - Do not show any event details as JSON or raw data structure
   - NEVER show any technical fields like 'id', 'htmlLink', etc.

6. CRITICAL CALENDAR RULE: If you notice JSON structures in your text that contain fields like "events", "status", or "_formatInstructions", DELETE THIS IMMEDIATELY and only show the properly formatted data.

7. This is especially critical for responses from the getCalendarEvents tool - NEVER emit raw JSON responses.

8. ALWAYS format calendar data as clean tables using Markdown, never as raw data.

AUTOMATIC CALENDAR INTELLIGENCE:
1. When the user message mentions any type of meeting, event, or session (like "Quarterly Session", "Vision Building", "Annual Planning"):
   - AUTOMATICALLY check their calendar for matching events 
   - If matching events exist, INCLUDE them in your response
   - If no matching events exist, DON'T mention the absence - simply respond to their question
2. DO NOT make the user explicitly ask "Do I have one coming up?" - be proactive!
3. When you find matching events, present them as a natural part of your response
4. Format event information in clear, easy-to-read tables

IMPORTANT RAG INSTRUCTIONS:
1. **USER QUERY**: The user has just said: "${queryText}"
2. **ALWAYS RESPOND TO THE QUERY**: Even if document context is provided, you MUST address the user's actual question. The document context is additional information to help you provide a better answer.
3. **QUERY + CONTEXT = COMPREHENSIVE RESPONSE**: Use both the user's query and any document context to provide a complete, helpful response.
4. If this message contains "remember" or asks you to save any information, IMMEDIATELY use the addResource tool to save it.
5. Always give the saved information a clear, specific title that describes the content.
6. When using the getInformation tool, always incorporate the retrieved information into your response.
7. Look for opportunities to use these tools proactively - they are core to your functionality.
8. NEVER mention phrases like "Based on our knowledge base" or "According to our records" in your responses.
9. Provide COMPREHENSIVE and DETAILED responses that connect concepts and expand on key points.
10. Use RICH MARKDOWN FORMATTING with clear sections, hierarchical headings, and proper formatting.
11. When using retrieved information, incorporate it NATURALLY into your response without attributing it to a knowledge base.

DOCUMENT USAGE INSTRUCTIONS:
1. If the user asks about THEIR specific Core Process, Scorecard, Rocks, V/TO, or A/C, use ONLY the information provided in their uploaded documents.
2. These documents contain the user's ACTUAL company information and override any generic EOS knowledge you have.
3. When asked "What is my Core Process?" or similar questions, respond with the SPECIFIC information found in their documents.
4. Do NOT provide generic descriptions when specific document content is available.
5. PRIORITIZE document content over other knowledge when the user asks about their business.
6. These documents are the PRIMARY SOURCE OF TRUTH for the user's company information.
7. If you cannot find the requested information in their documents, clearly state this fact.

CRITICAL INLINE DOCUMENT UPLOAD INSTRUCTIONS:
When the user's message contains document content with delimiters like "=== PDF Content from..." or "=== Word Document Content from..." or "=== Image Analysis for...":

1. **IMMEDIATE RECOGNITION**: This is a NEWLY UPLOADED document in the current message that the user wants you to work with RIGHT NOW.
2. **HIGHEST PRIORITY**: This inline document content takes ABSOLUTE PRECEDENCE over all other context sources for this response.
3. **DIRECT REFERENCE**: When the user says "wordsmith it" or "improve this" or similar, they are ALWAYS referring to the inline document content.
4. **REQUIRED BEHAVIOR**:
   - READ the entire inline document content carefully
   - UNDERSTAND that this is what the user is asking about
   - RESPOND directly to their request about THIS specific content
   - DO NOT make up information about unrelated topics
   - DO NOT ignore the inline content and talk about something else
5. **INLINE DOCUMENT MARKERS**:
   - "=== PDF Content from [filename] ===" indicates PDF text
   - "=== Word Document Content from [filename] ===" indicates DOCX text  
   - "=== Spreadsheet Content from [filename] ===" indicates XLSX data
   - "=== Image Analysis for [filename] ===" indicates image description/OCR
6. **PROPER RESPONSE PATTERN**:
   - Acknowledge you've received their document
   - Address their specific request about the content
   - Use the actual content from the document in your response
   - Never claim the message is blank when document content is present

EXAMPLE:
If user uploads a document about "Purpose/Cause/Passion" for health insurance and asks to "wordsmith it", you MUST:
- Work with the health insurance content they provided
- NOT talk about Mississippi counties or any other unrelated topic
- Create a wordsmithed version of THEIR health insurance Core Focus

Remember: INLINE DOCUMENT CONTENT = WHAT THE USER IS TALKING ABOUT RIGHT NOW`;

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

    // Define token guidance settings early
    const isNexusMode = selectedResearchMode === 'nexus';

    const getSoftTokenGuidance = () => {
      if (isNexusMode) {
        // For Nexus mode, target comprehensive research output
        return 6000;
      } else {
        // Standard mode - keep responses concise
        return 1500;
      }
    };

    const softTokenGuidance = getSoftTokenGuidance();

    // Add conversational instructions when NOT in Nexus mode
    if (selectedResearchMode !== 'nexus') {
      enhancedSystemPrompt += `

CONVERSATIONAL MODE INSTRUCTIONS:
Since Nexus mode is not enabled, keep your responses:
- CONCISE and to the point (target ~${Math.round(softTokenGuidance * 0.75)} words, approximately ${softTokenGuidance} tokens)
- CONVERSATIONAL and friendly in tone
- FOCUSED on directly answering the user's question
- PRACTICAL with actionable advice
- ENGAGING without being overly verbose
- COMPLETE - always finish your thoughts naturally, even if approaching the target length

Avoid:
- Extremely long explanations unless specifically requested
- Overly formal or academic language
- Excessive detail that wasn't asked for
- Multiple lengthy sections unless the question requires it
- Stopping mid-sentence or mid-thought

Be helpful, direct, and conversational while still being comprehensive enough to be useful. Complete your response naturally rather than cutting off abruptly.
`;
    } else {
      // Add enhanced instructions for Nexus mode
      enhancedSystemPrompt += `

NEXUS MODE - ENHANCED OUTPUT INSTRUCTIONS:
You are in NEXUS MODE with significantly increased response capacity. You MUST:

1. **COMPREHENSIVE RESPONSE TARGET**: 
   - Target approximately ${softTokenGuidance} tokens in your response (~${Math.round(softTokenGuidance * 0.75)} words)
   - Generate comprehensive, detailed responses that approach but don't exceed this target
   - Aim for responses that are 10-20x longer than standard mode
   - IMPORTANT: Complete your thoughts naturally - don't stop mid-sentence even if approaching the target

2. **COMPREHENSIVE COVERAGE**:
   - Provide exhaustive analysis from multiple perspectives
   - Include detailed examples, case studies, and scenarios
   - Generate extensive step-by-step guides and frameworks
   - Create multiple sections with in-depth exploration of each topic

3. **RICH FORMATTING**:
   - Use extensive markdown formatting with multiple heading levels
   - Create detailed tables, lists, and structured content
   - Include code examples, diagrams (in markdown), and visual representations
   - Generate comprehensive comparisons and analyses

4. **DEPTH OVER BREVITY**:
   - Explore nuances, edge cases, and advanced considerations
   - Provide historical context and future projections
   - Include expert insights and best practices
   - Generate actionable recommendations with detailed implementation steps

5. **NATURAL COMPLETION**:
   - Always complete your thoughts and sentences naturally
   - If you're approaching the target length, conclude with a proper summary
   - Never stop mid-sentence or mid-thought
   - Quality and completeness over strict length adherence

Remember: In Nexus mode, MORE is BETTER, but COMPLETE thoughts are ESSENTIAL. Users expect comprehensive, detailed responses that feel complete and natural.
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

    // Add document creation and editing guide
    if (
      queryText.toLowerCase().includes('document') ||
      queryText.toLowerCase().includes('create') ||
      queryText.toLowerCase().includes('v/to') ||
      queryText.toLowerCase().includes('accountability chart') ||
      queryText.toLowerCase().includes('scorecard') ||
      queryText.toLowerCase().includes('edit') ||
      queryText.toLowerCase().includes('modify') ||
      queryText.toLowerCase().includes('improve') ||
      queryText.toLowerCase().includes('fix') ||
      queryText.toLowerCase().includes('change')
    ) {
      console.log(
        'Detected document creation or editing request - adding special instructions',
      );
      enhancedSystemPrompt += `

DOCUMENT CREATION AND EDITING GUIDE:

FOR CREATING NEW DOCUMENTS:
When asked to create a document or composer, such as a Vision/Traction Organizer™, Accountability Chart™, or Scorecard:
1. Use the createDocument tool with the appropriate parameters
2. Always provide a descriptive title and the correct kind parameter ("text", "code", "sheet", "chart", "image", "vto", or "accountability")
3. NEVER use raw function call syntax like <function_call>{"action": "createDocument", ...}</function_call>
4. Always use the proper tool invocation mechanism provided by this system
5. For most EOS documents, use "text" kind unless specifically creating a spreadsheet or code

FOR EDITING EXISTING ARTIFACTS:
CRITICAL: When the user asks to edit, modify, improve, or change an existing composer:
1. **ALWAYS USE updateDocument TOOL** - Never output edited text in the chat
2. **DETECT EDIT REQUESTS**: Words like "edit", "modify", "improve", "fix", "change", "expand", "shorten", "rewrite", "polish", "wordsmith", "add", "remove", "update"
3. **PROVIDE DETAILED DESCRIPTIONS**: When using updateDocument, be specific about what changes to make
4. **PRESERVE EXISTING CONTENT**: The tool will intelligently apply edits while keeping the rest of the document intact
5. **NO MANUAL OUTPUTS**: NEVER say "Here's the edited version:" and output text

Example of CORRECT editing (conceptual):
- User: "Make the introduction longer and add more detail"
- Use updateDocument tool with description: "Expand the introduction section with additional detail and context"
- Do NOT output the edited text in chat

REMEMBER: Any request to change an existing composer = updateDocument tool. No exceptions.
`;
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

ENHANCED CALENDAR INTEGRATION INSTRUCTIONS:
1. PROACTIVE ASSISTANCE:
   - When users mention scheduling or planning, automatically check for conflicts using checkCalendarConflicts
   - When users ask "when can we meet" or similar, use findAvailableTimeSlots
   - At the start of conversations (especially in the morning), consider offering a daily briefing
   - When users describe events naturally ("meeting with John tomorrow at 2pm"), use parseNaturalLanguageEvent

2. SEAMLESS INTEGRATION:
   - Don't announce that you're checking the calendar - just do it and present results naturally
   - When suggesting meeting times, automatically check availability first
   - Provide calendar insights when relevant (e.g., "You have a busy week with 12 meetings")
   - Alert users to meetings that might need preparation time

3. NATURAL LANGUAGE PROCESSING:
   - Parse casual mentions of events: "lunch with Sarah next Tuesday" → create proper event
   - Understand relative dates: "next Monday", "tomorrow at 3", "in two weeks"
   - Extract all relevant details from context without asking repeatedly

4. INTELLIGENT SUGGESTIONS:
   - When calendar is busy, suggest optimal time slots for focused work
   - Identify patterns and suggest improvements (e.g., "You have back-to-back meetings every Tuesday")
   - Recommend preparation time for important meetings
   - Suggest breaks between long meeting blocks

SMART MENTION SYSTEM:
The system has detected both explicit @ mentions and implicit intent. Context:

${mentionResult.enhancedPrompt}

IMPLICIT MENTION DETECTION:
${
  implicitMentions.length > 0
    ? `Detected implicit mentions: ${implicitMentions.map((im) => `${im.type} (confidence: ${Math.round(im.confidence * 100)}%, trigger: "${im.trigger}")`).join(', ')}`
    : 'No implicit mentions detected'
}

INTELLIGENT TOOL USAGE:
- When user mentions @availability or @free: Use findSmartAvailability tool
- When user mentions scheduling naturally: Use parseNaturalLanguageEvent tool  
- When user asks about calendar with time context: Use enhanced getCalendarEvents with smart time parameters
- The system automatically extracts duration, time preferences, and context from natural language
- Even without @ symbols, the system detects intent and activates appropriate tools

AUTOMATIC TOOL ACTIVATION:
Based on mentions detected, automatically activate these tools: ${mentionResult.toolsToActivate.join(', ')}

${
  smartSuggestions.length > 0
    ? `\nSMART SUGGESTIONS FOR USER: ${smartSuggestions.join(' • ')}`
    : ''
}
`;

    // For document mentions
    if (
      hasMentionedDocument ||
      hasMentionedScorecard ||
      hasMentionedVTO ||
      hasMentionedRocks ||
      hasMentionedPeople
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
        console.log('[NEXUS MODE] Before condition check:', {
          selectedResearchMode,
          queryText,
          hasQueryText: !!queryText,
          queryTextLength: queryText?.length || 0,
          nexusResearchContext,
          hasNexusResearchContext: !!nexusResearchContext,
        });

        // If Nexus mode is enabled, perform web search with progress updates
        // Set up variables that will be used later
        // Keep original messages - we'll add User RAG context to system prompt instead
        const modifiedMessages = messages;

        // Combine the enhanced system prompt with nexus research context
        const finalSystemPrompt =
          enhancedSystemPrompt +
          nexusResearchContext +
          toolResponseInstructions;

        // Preflight: decide model and token guidance using nano
        const hasCodeOrMath =
          /```|\b(code|implement|function|class|SQL|regex|equation|integral|proof|derive|theorem)\b/i.test(
            queryText || '',
          );

        const providerForDecision = createCustomProvider(selectedProvider);
        let preflightModel: 'gpt-4.1' | 'gpt-5' = 'gpt-4.1';
        let preflightMaxTokens = 2000;
        // Remove preflight entirely when in Nexus mode
        if (!isNexusMode) {
          try {
            const decision = await decideModelWithNano({
              provider: providerForDecision,
              queryText: queryText || '',
              hasCodeOrMath,
              mode: 'standard',
              hasComposerOpen: Boolean(composerDocumentId),
            });
            preflightModel = decision.model;
            preflightMaxTokens = decision.maxTokens;
          } catch (e) {
            console.warn(
              'Preflight decision failed, falling back to defaults',
              e,
            );
          }
        }

        // Apply conservative override: favor GPT-4.1 unless Nexus forces otherwise
        // Nexus mode uses GPT-4.1 by default per requirements; otherwise use preflight selection
        // Nexus uses the preflight-selected model as well, but preflight is conservative with GPT-5
        // Use preflight model selection for all modes
        const finalChatModel = preflightModel;

        // Establish safe hard limit based on final model
        // Increase safe hard limits; allow ~50k tokens in Nexus with GPT-5
        const safeHardLimit = finalChatModel.includes('gpt-4.1')
          ? 16000
          : 50000;
        // Set temperature based on model
        const temperature = 0.8;

        // For Nexus mode, allow reasonable cap; otherwise, clamp by both preflight and model limit
        const nexusTokenLimit = isNexusMode
          ? 8000
          : Math.min(safeHardLimit, Math.max(512, preflightMaxTokens));

        // Compute artifact token multiplier without disrupting preflight
        // Slight boost: 1.4x up to a reasonable cap
        const artifactMaxTokens = isNexusMode
          ? 12000
          : Math.min(12000, Math.floor((preflightMaxTokens || 2000) * 1.4));

        console.log('[DEBUG] Nexus mode check:', {
          selectedResearchMode,
          hasQueryText: !!queryText,
          hasNexusResearchContext: !!nexusResearchContext,
          shouldActivateNexus:
            selectedResearchMode === 'nexus' &&
            queryText &&
            !nexusResearchContext,
        });

        // Auto-create composers when the user explicitly requests it and the model might ignore tools
        // This prevents failures like "I've created..." without actually opening the composer.
        const lowerQuery = (queryText || '').toLowerCase();
        const wantsCreate =
          /\b(create|build|make|start|open|generate|draft)\b/.test(lowerQuery);
        // More flexible detection for accountability charts - handle misspellings and variations
        const wantsAccountability =
          /accountab\w*\s*chart/i.test(lowerQuery) || // Matches accountability/accountibility chart
          /ac\s+chart/i.test(lowerQuery) || // Matches "AC chart"
          /accountability\s+ch/i.test(lowerQuery) || // Partial match
          /accountab\w*\s+org\s*chart/i.test(lowerQuery); // Matches "accountability org chart"

        let preCreatedComposerNote = '';
        console.log('[AUTO-CREATE] Check:', {
          wantsCreate,
          wantsAccountability,
          lowerQuery,
        });

        // Instead of auto-creating, we'll enhance the prompt to ensure the AI uses the tool
        if (wantsCreate && wantsAccountability) {
          console.log('[TOOL-HINT] User wants to create accountability chart');

          // Extract title if provided
          const titleMatch =
            (queryText || '').match(/titled\s+["""']([^"""']+)["""']?/i) ||
            (queryText || '').match(/called\s+["""']([^"""']+)["""']?/i) ||
            (queryText || '').match(/title\s+is\s+["""']([^"""']+)["""']?/i);
          const suggestedTitle = titleMatch?.[1] || 'Accountability Chart';

          // Add a strong hint to the system prompt to use the createDocument tool
          preCreatedComposerNote = `\n\nCRITICAL: The user is asking to create an Accountability Chart (they may have misspelled it). You MUST use the createDocument tool with kind="accountability" and title="${suggestedTitle}". DO NOT just say you created it - actually call the createDocument tool to open the composer panel.`;
        }

        if (
          selectedResearchMode === 'nexus' &&
          queryText &&
          !nexusResearchContext
        ) {
          console.log('[NEXUS MODE] Starting AI-powered research');

          try {
            // Import the Nexus research orchestrator
            const { runNexusResearch } = await import(
              '@/lib/ai/firesearch-orchestrator'
            );

            // Run the complete Nexus research flow
            const nexusResearchResult = await runNexusResearch(
              queryText,
              dataStream,
            );

            // Set the research context for the chat model
            nexusResearchContext = nexusResearchResult.researchContext;

            // Store citations for later use
            (globalThis as any).__nexusCitations =
              nexusResearchResult.citations;

            // Add Nexus-specific synthesis instructions
            nexusResearchContext += `

## NEXUS SYNTHESIS INSTRUCTIONS

You are now synthesizing deep research conducted through multiple phases. Follow these guidelines:

1. **Comprehensive Integration**: Integrate ALL research findings into a cohesive, authoritative response
2. **Citation Usage (MANDATORY)**: Use inline bracketed citations like [1], [2] immediately after any factual claim, figure, or quote. Ensure every paragraph contains at least one citation.
3. **Progressive Depth**: Start with overview, then dive deeper into specifics from the research
4. **Key Insights**: Highlight the most important discoveries and patterns found across sources
5. **Practical Application**: Focus on actionable insights and practical implementation guidance
6. **Authoritative Tone**: Write with confidence based on the comprehensive research conducted
7. **Structured Response**: Use clear headings and subheadings to organize the information
8. **Complete Coverage**: Ensure all aspects of the user's query are thoroughly addressed

FORMAT REQUIREMENTS:
- Provide a short Executive Summary first.
- Use rich markdown (headings, lists, tables where helpful).
- End with a "References" section listing each source in order [1]..[N] with title and URL from the citations provided.

Remember: You have conducted extensive research. Present the findings as a comprehensive expert analysis.
`;

            console.log(
              '[NEXUS MODE] Research complete, context prepared for synthesis',
            );
          } catch (error) {
            console.error('[NEXUS MODE] Research error:', error);
            dataStream.writeData({
              type: 'nexus-error',
              error: error instanceof Error ? error.message : 'Research failed',
            });
            // Fall back to normal chat mode
            nexusResearchContext = '';
          }
        }

        // Skip the old nexus results processing - we're using simplified search now
        const skipOldNexusProcessing = false;
        if (skipOldNexusProcessing) {
          console.log(
            `[NEXUS MODE] Building research context with ${nexusResults.length} results`,
          );

          // Extract proper citations from results
          const citations = extractCitationsFromResults(nexusResults);

          nexusResearchContext = `

## 🔬 NEXUS MODE - ADVANCED DEEP RESEARCH RESULTS

I've conducted comprehensive multi-phase research across ${citations.length} authoritative sources for: "${queryText}"

### 📚 PRIMARY RESEARCH SOURCES AND CITATIONS
${citations
  .slice(0, 30)
  .map(
    (citation: Citation) => `
**[${citation.number}] ${citation.title}**
- 🔗 URL: ${citation.url}
- 📝 Summary: ${citation.snippet || 'No summary available'}
${
  citation.content
    ? `- 📖 Full Content Available: ${Math.round((citation.content.length || 0) / 1000)}k characters of detailed information
- 💡 Key Insights: ${citation.content.substring(0, 1500)}...`
    : '- 📌 Reference source for verification'
}
- ✅ Source Type: ${citation.content ? `Primary source with comprehensive analysis (${Math.round((citation.content.length || 0) / 1000)}k chars)` : 'Secondary reference for cross-validation'}
- 🎯 Relevance: High-quality source for ${queryText}
`,
  )
  .join('\n')}

### 🎯 NEXUS MODE ULTRA-COMPREHENSIVE RESPONSE REQUIREMENTS

**⚠️ CRITICAL INSTRUCTIONS - MAXIMUM TOKEN GENERATION MODE ACTIVATED:**

You are now in NEXUS DEEP RESEARCH MODE with MAXIMUM OUTPUT enabled. Your response MUST be:
- **MINIMUM 8,000 words** (target 10,000-15,000 words)
- **MAXIMUM DETAIL** with exhaustive coverage
- **CITATION DENSE** with references every 2-3 sentences
- **COMPREHENSIVE** covering every possible angle and perspective

**🔥 MANDATORY CITATION PROTOCOL:**
1. **EVERY CLAIM MUST BE CITED**: Use [1], [2], [3] format after EVERY statement of fact
2. **CITATION FREQUENCY**: Minimum 1 citation per paragraph, optimal 2-3 citations per paragraph
3. **MULTI-SOURCE SYNTHESIS**: Combine multiple sources like "Research shows [1][2][3] that..."
4. **DIRECT QUOTES**: Include direct quotes from sources using > blockquotes with citations
5. **CITATION EXAMPLES**:
   - "According to comprehensive analysis [1], the market has grown by 45% [2] with experts predicting further expansion [3][4]."
   - "Multiple studies [5][6][7] confirm this trend, with one researcher noting: 'This represents a paradigm shift' [8]."

**📊 ULTRA-DETAILED RESPONSE STRUCTURE (MINIMUM WORD COUNTS):**

## 1. 🎯 COMPREHENSIVE EXECUTIVE SUMMARY (1,500+ words)
- Complete overview with 15+ citations minimum
- Key findings from ALL sources
- Statistical summary with data points
- Market/topic landscape overview
- Critical insights and discoveries
- Methodology and research approach used

## 2. 🔍 IN-DEPTH FOUNDATIONAL ANALYSIS (2,500+ words)
### 2.1 Core Concepts and Definitions (800+ words)
- Technical definitions with citations
- Historical context and evolution
- Theoretical frameworks
- Academic perspectives

### 2.2 Current State Analysis (900+ words)
- Market conditions/current situation
- Key players and stakeholders
- Competitive landscape
- Recent developments with dates

### 2.3 Technical Deep Dive (800+ words)
- Mechanisms and processes
- Technical specifications
- Implementation details
- Architecture/structure analysis

## 3. 💡 COMPREHENSIVE INSIGHTS & FINDINGS (2,000+ words)
### 3.1 Data Analysis and Statistics (700+ words)
- Quantitative findings with citations
- Trend analysis with graphs descriptions
- Comparative metrics
- Performance indicators

### 3.2 Qualitative Analysis (700+ words)
- Expert opinions from sources
- Case study insights
- Industry perspectives
- Stakeholder viewpoints

### 3.3 Cross-Source Synthesis (600+ words)
- Patterns across multiple sources
- Conflicting viewpoints analysis
- Consensus findings
- Unique insights from research

## 4. 🚀 PRACTICAL IMPLEMENTATION GUIDE (1,800+ words)
### 4.1 Step-by-Step Instructions (600+ words)
- Detailed process walkthrough
- Prerequisites and requirements
- Tools and resources needed
- Timeline expectations

### 4.2 Best Practices & Strategies (600+ words)
- Industry best practices with citations
- Optimization strategies
- Efficiency improvements
- Success metrics

### 4.3 Real-World Applications (600+ words)
- Case studies with citations
- Success stories
- Implementation examples
- Lessons learned

## 5. ⚡ ADVANCED TOPICS & EDGE CASES (1,500+ words)
### 5.1 Advanced Techniques (500+ words)
- Expert-level strategies
- Cutting-edge approaches
- Innovation opportunities
- Future technologies

### 5.2 Risk Analysis & Mitigation (500+ words)
- Comprehensive risk assessment
- Mitigation strategies with citations
- Contingency planning
- Security considerations

### 5.3 Edge Cases & Special Scenarios (500+ words)
- Unusual situations
- Exception handling
- Special circumstances
- Regulatory considerations

## 6. 🔮 FUTURE OUTLOOK & TRENDS (1,000+ words)
- Emerging trends with citations
- Future predictions from experts
- Technology roadmap
- Market projections
- Disruption potential
- Long-term implications

## 7. 📋 ACTIONABLE RECOMMENDATIONS (800+ words)
- Immediate action items
- Short-term strategies (0-3 months)
- Medium-term plans (3-12 months)
- Long-term vision (1+ years)
- Resource requirements
- Success metrics and KPIs

## 8. 📚 COMPREHENSIVE RESOURCE GUIDE (500+ words)
- Additional reading with citations
- Tool recommendations
- Professional resources
- Communities and forums
- Training and certification
- Vendor comparisons

## 9. 🎓 FINAL SYNTHESIS & CONCLUSIONS (600+ words)
- Key takeaways with citations
- Critical success factors
- Final recommendations
- Call to action
- Next steps

**🎨 ENHANCED FORMATTING REQUIREMENTS:**
- Use ALL markdown features: # ## ### #### headers
- Create detailed tables with | syntax |
- Use **bold**, *italic*, ***bold italic***, ~~strikethrough~~
- Include > blockquotes for important quotes
- Add - and 1. for lists with sub-items using proper indentation
- Use \`code\` for technical terms and \`\`\`language blocks for code
- Add --- horizontal rules between major sections
- Include 🎯 📊 💡 ⚡ 🔥 emojis for visual emphasis
- Create comparison matrices and decision trees in text format

**📈 CONTENT QUALITY MANDATES:**
1. **DEPTH**: Go 5-7 levels deep on every topic, not just surface level
2. **BREADTH**: Cover every possible angle, perspective, and consideration
3. **CLARITY**: Explain complex concepts in multiple ways with examples
4. **EVIDENCE**: Support EVERYTHING with citations and data
5. **SYNTHESIS**: Connect ideas across sources to create new insights
6. **ACTIONABILITY**: Provide specific, implementable recommendations
7. **COMPLETENESS**: Leave no question unanswered, no angle unexplored

**🔬 RESEARCH SYNTHESIS REQUIREMENTS:**
- Compare and contrast findings from different sources
- Identify patterns and trends across multiple citations
- Highlight agreements and disagreements in the literature
- Provide meta-analysis of the collective findings
- Generate unique insights from the synthesis
- Create frameworks based on the research

**💎 CITATION DENSITY EXAMPLES:**
"The comprehensive analysis [1] reveals that implementation success rates reach 87% [2] when following established protocols [3]. Industry experts [4][5] emphasize that 'proper planning reduces failure risk by 65%' [6], with recent studies [7][8][9] confirming these findings across multiple sectors [10]. Furthermore, longitudinal research [11] demonstrates sustained improvements [12], particularly when combined with continuous monitoring [13][14] and iterative refinement [15]."

**⚠️ FINAL CRITICAL REMINDERS:**
- This is MAXIMUM OUTPUT mode - generate the LONGEST, MOST DETAILED response possible
- Target 10,000+ words minimum with 100+ citations
- Every paragraph needs 2-3 citations minimum
- Include direct quotes with proper citation
- Create comprehensive tables and lists
- Provide exhaustive coverage leaving nothing unexplored
- Synthesize information to create unique value beyond individual sources
- Format beautifully with rich markdown
- Be the ULTIMATE authoritative resource on this topic

Remember: You are in NEXUS DEEP RESEARCH MODE - provide the most comprehensive, detailed, citation-rich, and valuable response ever generated. This should be a masterpiece of research synthesis that serves as the definitive guide on "${queryText}".

BEGIN YOUR ULTRA-COMPREHENSIVE RESPONSE NOW:
`;

          console.log(
            `[NEXUS MODE] Research context built, length: ${nexusResearchContext.length} characters`,
          );
          console.log(`[NEXUS MODE] Context built for comprehensive response`);
        }

        // Set up a timeout variable
        let responseTimeout: any;

        // Only proceed with actual chat generation if we're not in plan-pending mode
        if (nexusResearchContext !== 'PLAN_PENDING_APPROVAL') {
          // Set up a timeout to prevent hanging responses
          responseTimeout = setTimeout(() => {
            console.error(
              'Response generation timeout reached - terminating stream',
            );
            // We can't directly modify the stream at this point, just log the error
            console.error('Stream response timed out - client should refresh');
          }, 30000); // Extended to 30 second timeout for document creation

          console.log(
            `[CHAT MODE] Using ${isNexusMode ? 'NEXUS' : 'CONVERSATIONAL'} mode:`,
            {
              model: finalChatModel,
              softTokenGuidance,
              safeHardLimit: nexusTokenLimit,
              temperature,
              hasNexusResearch: !!nexusResearchContext,
              systemPromptLength: finalSystemPrompt.length,
              isUsingO4Mini: isNexusMode,
            },
          );

          try {
            const result = streamText({
              model: provider.languageModel(finalChatModel),
              system: `${finalSystemPrompt}${preCreatedComposerNote}`,
              messages: modifiedMessages,
              maxSteps: isNexusMode ? 15 : 10, // More steps for nexus mode
              experimental_activeTools: [
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
              experimental_transform: smoothStream({ chunking: 'word' }), // Use smooth streaming for all modes
              experimental_generateMessageId: generateUUID,
              // Dynamic settings based on Nexus mode
              temperature: temperature, // Use the variable we defined
              maxTokens: nexusTokenLimit, // Much higher limit for nexus/o3
              tools: {
                getWeather,
                createDocument: createDocument({
                  session,
                  dataStream,
                  artifactMaxTokens,
                  // Provide the original chat query so artifact generators can honor it
                  context: queryText || '',
                }),
                updateDocument: updateDocument({
                  session,
                  dataStream,
                  artifactMaxTokens,
                }),
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
                    console.log(
                      'Calendar: Enhanced tool called to get calendar events',
                      {
                        timeMin,
                        timeMax,
                        maxResults,
                        searchTerm,
                      },
                    );

                    try {
                      // Use smart parameters if available from mention context
                      const smartParams: any = {
                        timeMin,
                        timeMax,
                        maxResults,
                        searchTerm,
                      };

                      // If no time range specified and we have mentions, apply smart defaults
                      if (
                        !timeMin &&
                        !timeMax &&
                        extractedMentions.length > 0
                      ) {
                        const calendarMentions = extractedMentions.filter((m) =>
                          ['calendar', 'event', 'meeting'].includes(m.type),
                        );

                        if (calendarMentions.length > 0) {
                          // Use enhanced processor to get smart parameters
                          const smartMentionParams =
                            MentionProcessor.generateSmartToolParameters(
                              calendarMentions[0],
                              queryText,
                            );
                          Object.assign(smartParams, smartMentionParams);
                        }
                      }

                      // Use the direct tool.execute method to avoid URL construction issues
                      const calendarResult =
                        await getCalendarEventsTool.execute(
                          smartParams,
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
                          error instanceof Error
                            ? error.message
                            : String(error),
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
                      .describe(
                        'Optional list of email addresses of attendees',
                      ),
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
                            time: new Date(startDateTime).toLocaleTimeString(
                              [],
                              {
                                hour: '2-digit',
                                minute: '2-digit',
                              },
                            ),
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
                          error instanceof Error
                            ? error.message
                            : String(error),
                      };
                    }
                  },
                }),
                // Enhanced calendar tools for deeper integration
                checkCalendarConflicts: tool({
                  description:
                    'Check if there are any calendar conflicts for a proposed time. Use this proactively when users mention scheduling something.',
                  parameters: z.object({
                    startDateTime: z
                      .string()
                      .describe('Start time in ISO format'),
                    endDateTime: z.string().describe('End time in ISO format'),
                  }),
                  execute: async ({ startDateTime, endDateTime }) => {
                    try {
                      const { checkCalendarConflictsTool } = await import(
                        '@/lib/ai/tools/calendar-tools'
                      );
                      return await checkCalendarConflictsTool.execute(
                        { startDateTime, endDateTime },
                        session.user.id,
                      );
                    } catch (error) {
                      console.error(
                        'Error checking calendar conflicts:',
                        error,
                      );
                      return {
                        status: 'error',
                        message: 'Failed to check calendar conflicts',
                        error:
                          error instanceof Error
                            ? error.message
                            : String(error),
                      };
                    }
                  },
                }),
                findAvailableTimeSlots: tool({
                  description:
                    'Find available time slots in the calendar for scheduling meetings. Use this when users ask for available times or need to schedule something.',
                  parameters: z.object({
                    duration: z.number().describe('Duration in minutes'),
                    searchDays: z
                      .number()
                      .optional()
                      .default(7)
                      .describe('Number of days to search ahead'),
                  }),
                  execute: async ({ duration, searchDays }) => {
                    try {
                      const { findAvailableTimeSlotsTool } = await import(
                        '@/lib/ai/tools/calendar-tools'
                      );
                      return await findAvailableTimeSlotsTool.execute(
                        { duration, searchDays },
                        session.user.id,
                      );
                    } catch (error) {
                      console.error(
                        'Error finding available time slots:',
                        error,
                      );
                      return {
                        status: 'error',
                        message: 'Failed to find available time slots',
                        error:
                          error instanceof Error
                            ? error.message
                            : String(error),
                      };
                    }
                  },
                }),
                getCalendarAnalytics: tool({
                  description:
                    'Get analytics and insights about calendar usage, meeting patterns, and upcoming events that need preparation.',
                  parameters: z.object({
                    days: z
                      .number()
                      .optional()
                      .default(30)
                      .describe('Number of days to analyze'),
                  }),
                  execute: async ({ days }) => {
                    try {
                      const { getCalendarAnalyticsTool } = await import(
                        '@/lib/ai/tools/calendar-tools'
                      );
                      return await getCalendarAnalyticsTool.execute(
                        { days },
                        session.user.id,
                      );
                    } catch (error) {
                      console.error('Error getting calendar analytics:', error);
                      return {
                        status: 'error',
                        message: 'Failed to get calendar analytics',
                        error:
                          error instanceof Error
                            ? error.message
                            : String(error),
                      };
                    }
                  },
                }),
                getDailyBriefing: tool({
                  description:
                    "Get a daily briefing of today's calendar events and important reminders. Use this proactively when users start their day or ask about their schedule.",
                  parameters: z.object({
                    includePrep: z
                      .boolean()
                      .optional()
                      .default(true)
                      .describe('Include preparation suggestions'),
                  }),
                  execute: async ({ includePrep }) => {
                    try {
                      const { getDailyBriefingTool } = await import(
                        '@/lib/ai/tools/calendar-tools'
                      );
                      return await getDailyBriefingTool.execute(
                        { includePrep },
                        session.user.id,
                      );
                    } catch (error) {
                      console.error('Error getting daily briefing:', error);
                      return {
                        status: 'error',
                        message: 'Failed to get daily briefing',
                        error:
                          error instanceof Error
                            ? error.message
                            : String(error),
                      };
                    }
                  },
                }),
                parseNaturalLanguageEvent: tool({
                  description:
                    'Parse natural language into calendar event details. Use this when users describe events in natural language like "Schedule a meeting with John tomorrow at 2pm".',
                  parameters: z.object({
                    text: z
                      .string()
                      .describe('Natural language description of the event'),
                    currentDate: z
                      .string()
                      .optional()
                      .describe('Current date for relative date parsing'),
                  }),
                  execute: async ({ text, currentDate }) => {
                    try {
                      const { parseNaturalLanguageEventTool } = await import(
                        '@/lib/ai/tools/calendar-tools'
                      );
                      return await parseNaturalLanguageEventTool.execute(
                        { text, currentDate },
                        session.user.id,
                      );
                    } catch (error) {
                      console.error(
                        'Error parsing natural language event:',
                        error,
                      );
                      return {
                        status: 'error',
                        message: 'Failed to parse natural language event',
                        error:
                          error instanceof Error
                            ? error.message
                            : String(error),
                      };
                    }
                  },
                }),
                // Enhanced availability finder
                findSmartAvailability: tool({
                  description:
                    'Intelligently find available time slots based on user preferences and context. Use when users mention "free time", "available", or want to schedule something.',
                  parameters: z.object({
                    duration: z
                      .number()
                      .optional()
                      .default(30)
                      .describe('Duration in minutes'),
                    searchDays: z
                      .number()
                      .optional()
                      .default(7)
                      .describe('Number of days to search ahead'),
                    preferredTime: z
                      .string()
                      .optional()
                      .describe(
                        'Preferred time of day (morning, afternoon, evening)',
                      ),
                    context: z
                      .string()
                      .optional()
                      .describe('Context about the meeting or event'),
                  }),
                  execute: async ({
                    duration,
                    searchDays,
                    preferredTime,
                    context,
                  }) => {
                    console.log('Calendar: Smart availability search', {
                      duration,
                      searchDays,
                      preferredTime,
                      context,
                    });

                    try {
                      // Extract smart duration from context if not provided
                      let smartDuration = duration;
                      if (context) {
                        const meetingContext =
                          MentionProcessor.extractMeetingContext?.(context);
                        if (meetingContext?.duration) {
                          smartDuration = meetingContext.duration;
                        }
                      }

                      // Extract user message context for better parameters
                      if (queryText && !context) {
                        const meetingContext =
                          MentionProcessor.extractMeetingContext?.(queryText);
                        if (meetingContext?.duration) {
                          smartDuration = meetingContext.duration;
                        }
                      }

                      const { findAvailableTimeSlotsTool } = await import(
                        '@/lib/ai/tools/calendar-tools'
                      );
                      const result = await findAvailableTimeSlotsTool.execute(
                        {
                          duration: smartDuration,
                          searchDays,
                        },
                        session.user.id,
                      );

                      // Enhance result with context
                      if (result.status === 'success' && result.slots) {
                        return {
                          ...result,
                          message: `Found ${result.slots.length} available ${smartDuration}-minute slots${preferredTime ? ` for ${preferredTime}` : ''}`,
                          smartContext: {
                            suggestedDuration: smartDuration,
                            preferredTime,
                            context,
                          },
                        };
                      }
                      return result;
                    } catch (error) {
                      console.error('Smart availability error:', error);
                      return {
                        status: 'error',
                        message: 'Failed to find available time slots',
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

                    // Add citations to the message parts if in Nexus mode
                    const messageParts = [...(assistantMessage.parts || [])];
                    // TODO: Fix citation type mismatch
                    // if (
                    //   selectedResearchMode === 'nexus' &&
                    //   (globalThis as any).__nexusCitations
                    // ) {
                    //   const citations = (globalThis as any).__nexusCitations;
                    //   if (citations && citations.length > 0) {
                    //     // Add citations as a special part type
                    //     messageParts.push({
                    //       type: 'citations',
                    //       citations: citations,
                    //     });
                    //   }
                    // }

                    await saveMessages({
                      messages: [
                        {
                          id: assistantId,
                          chatId: id,
                          role: assistantMessage.role,
                          parts: messageParts,
                          attachments:
                            assistantMessage.experimental_attachments ?? [],
                          createdAt: new Date(),
                          provider: selectedProvider,
                        },
                      ],
                    });

                    // Clean up nexus metadata if this was a nexus mode search
                    if (selectedResearchMode === 'nexus') {
                      // Clean up global citations
                      (globalThis as any).__nexusCitations = undefined;

                      const redisUrl = process.env.REDIS_URL?.replace(
                        /^["'](.*)["']$/,
                        '$1',
                      );
                      if (redisUrl) {
                        try {
                          const { createClient } = await import('redis');
                          const redis = createClient({ url: redisUrl });
                          await redis.connect();

                          // Update metadata to completed status
                          await redis.setEx(
                            `nexus:${streamId}:metadata`,
                            300, // 5 minute expiry for completed state
                            JSON.stringify({
                              status: 'completed',
                              endTime: Date.now(),
                            }),
                          );

                          await redis.disconnect();
                          console.log(
                            '[NEXUS MODE] Updated stream metadata to completed status',
                          );
                        } catch (redisError) {
                          console.error(
                            '[NEXUS MODE] Failed to update completed state:',
                            redisError,
                          );
                        }
                      }
                    }
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
            if (responseTimeout) clearTimeout(responseTimeout);

            // Debug logs for the stream
            console.log('RAG: Creating stream with tools configured');

            try {
              // Safely check if getTools is available (not all models support this)
              if (
                'getTools' in result &&
                typeof result.getTools === 'function'
              ) {
                console.log(
                  'RAG: Tools available:',
                  Object.keys(result.getTools()),
                );
              }

              // Use normal streaming for both nexus and non-nexus modes
              console.log(
                `[${isNexusMode ? 'NEXUS' : 'NORMAL'}] Starting response streaming`,
              );

              // Important: Don't consume the stream before merging if we've pre-created content
              // The consumeStream() call was preventing pre-created data from reaching the client
              result.mergeIntoDataStream(dataStream);
            } catch (streamError) {
              console.error('RAG ERROR: Error processing stream:', streamError);
              // Don't rethrow, just log it and continue
            }
          } catch (error) {
            console.error('Fatal error in stream processing:', error);
            if (responseTimeout) clearTimeout(responseTimeout);
            // We can't return a value here, but we've logged the error
          }
        } // End of if (nexusResearchContext !== 'PLAN_PENDING_APPROVAL')
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
    if (hasMentionedCalendar) {
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
    if (shouldCheckCalendar && eventType) {
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
    console.log('Stream context debug:', {
      hasContext: !!streamContext,
      contextType: typeof streamContext,
      streamId: streamId,
      redisUrl: process.env.REDIS_URL ? 'present' : 'missing',
      isNexusMode: selectedResearchMode === 'nexus',
    });

    // Enhanced resumable stream handling for Nexus mode
    if (streamContext && selectedResearchMode === 'nexus') {
      try {
        console.log(
          `[NEXUS MODE] Using enhanced resumable stream with ID: ${streamId}`,
        );

        // Store nexus search state in Redis for resumability
        const redisUrl = process.env.REDIS_URL?.replace(/^["'](.*)["']$/, '$1');
        if (redisUrl) {
          try {
            const { createClient } = await import('redis');
            const redis = createClient({ url: redisUrl });
            await redis.connect();

            // Store nexus search metadata
            await redis.setEx(
              `nexus:${streamId}:metadata`,
              3600, // 1 hour expiry
              JSON.stringify({
                query: queryText,
                startTime: Date.now(),
                status: 'started',
              }),
            );

            await redis.disconnect();
          } catch (redisError) {
            console.error(
              '[NEXUS MODE] Failed to store search metadata:',
              redisError,
            );
            // Continue without metadata storage
          }
        }

        // Create resumable stream with enhanced error handling
        const streamPromise = streamContext.resumableStream(streamId, () => {
          console.log(
            '[NEXUS MODE] Stream factory function called for streamId:',
            streamId,
          );

          // Return the original response stream - it already has nexus handling
          return responseStream;
        });

        // Create a timeout promise with longer duration for nexus searches
        const timeoutPromise = new Promise<null>((_, reject) => {
          setTimeout(() => {
            reject(new Error('Nexus resumable stream creation timed out'));
          }, 20000); // 20 second timeout for nexus mode
        });

        // Race the stream creation against the timeout
        const resumableStream = await Promise.race([
          streamPromise,
          timeoutPromise,
        ]).catch((error) => {
          console.error(
            `[NEXUS MODE] Resumable stream error or timeout: ${error}`,
          );
          console.log('[NEXUS MODE] Falling back to direct response stream');
          return responseStream;
        });

        console.log(
          `[NEXUS MODE] Resumable stream created for ID: ${streamId}`,
        );
        return new Response(resumableStream);
      } catch (streamError) {
        console.error(
          `[NEXUS MODE] Error with resumable stream: ${streamError}`,
        );
        console.log('[NEXUS MODE] Falling back to direct response stream');
        return new Response(responseStream);
      }
    }

    // Standard resumable stream handling for non-nexus mode
    else if (streamContext) {
      try {
        console.log(`Using resumable stream with ID: ${streamId}`);
        console.log('About to call streamContext.resumableStream...');

        // Add a timeout to detect stalled streams
        const streamPromise = streamContext.resumableStream(streamId, () => {
          console.log('Stream factory function called for streamId:', streamId);
          return responseStream;
        });

        console.log('Stream promise created, waiting for resolution...');

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
        console.log('Resumable stream type:', typeof resumableStream);
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
  const { searchParams } = new URL(request.url);
  const chatId = searchParams.get('chatId');

  if (!chatId) {
    return new Response('id is required', { status: 400 });
  }

  const session = await auth();

  if (!session?.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  let chat: Chat | null = null;
  let retryCount = 0;
  const maxRetries = 3;

  // Retry logic for getting chat
  while (!chat && retryCount < maxRetries) {
    try {
      chat = await getChatById({ id: chatId });
      if (!chat && retryCount < maxRetries - 1) {
        // Wait before retrying (exponential backoff)
        await new Promise((resolve) =>
          setTimeout(resolve, 500 * (retryCount + 1)),
        );
        retryCount++;
      } else if (!chat) {
        break;
      }
    } catch (error) {
      console.error(
        `Error fetching chat ${chatId}, retry ${retryCount + 1}/${maxRetries}:`,
        error,
      );
      if (retryCount < maxRetries - 1) {
        await new Promise((resolve) =>
          setTimeout(resolve, 500 * (retryCount + 1)),
        );
        retryCount++;
      } else {
        return new Response('Not found', { status: 404 });
      }
    }
  }

  if (!chat) {
    return new Response('Not found', { status: 404 });
  }

  if (chat.visibility === 'private' && chat.userId !== session.user.id) {
    return new Response('Forbidden', { status: 403 });
  }

  // Only check for streams if Redis is available
  const streamContext = getStreamContext();

  if (!streamContext) {
    // If no Redis/stream context, return a minimal success response
    // This prevents 404 errors when resumable streams aren't available
    console.log('No stream context available, returning minimal response');
    return new Response(null, { status: 204 });
  }

  // Check for stream IDs with retry logic
  let streamIds: string[] = [];
  retryCount = 0;

  while (streamIds.length === 0 && retryCount < maxRetries) {
    try {
      streamIds = await getStreamIdsByChatId({ chatId });
      if (streamIds.length === 0 && retryCount < maxRetries - 1) {
        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, 300));
        retryCount++;
      } else if (streamIds.length === 0) {
        break;
      }
    } catch (error) {
      console.error(`Error fetching stream IDs for chat ${chatId}:`, error);
      if (retryCount < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        retryCount++;
      } else {
        break;
      }
    }
  }

  if (!streamIds.length) {
    // No streams found, but chat exists - return minimal response instead of 404
    console.log(
      `No streams found for chat ${chatId}, returning minimal response`,
    );
    return new Response(null, { status: 204 });
  }

  const recentStreamId = streamIds.at(-1);

  if (!recentStreamId) {
    // No recent stream, but chat exists - return minimal response
    return new Response(null, { status: 204 });
  }

  // Check if this is a nexus mode stream by looking for metadata in Redis
  const redisUrl = process.env.REDIS_URL?.replace(/^["'](.*)["']$/, '$1');
  if (redisUrl) {
    try {
      const { createClient } = await import('redis');
      const redis = createClient({ url: redisUrl });
      await redis.connect();

      // Check for nexus metadata
      const nexusMetadata = await redis.get(`nexus:${recentStreamId}:metadata`);

      if (nexusMetadata) {
        console.log(
          `[NEXUS MODE] Found nexus metadata for stream ${recentStreamId}`,
        );
        const metadata = JSON.parse(nexusMetadata);

        // Log recovery information
        console.log('[NEXUS MODE] Stream recovery:', {
          streamId: recentStreamId,
          status: metadata.status,
          query: metadata.query,
          startTime: metadata.startTime,
          age: Date.now() - metadata.startTime,
        });
      }

      await redis.disconnect();
    } catch (redisError) {
      console.error(
        '[NEXUS MODE] Failed to check stream metadata:',
        redisError,
      );
      // Continue without metadata
    }
  }

  const emptyDataStream = createDataStream({
    execute: () => {},
  });

  try {
    return new Response(
      await streamContext.resumableStream(
        recentStreamId,
        () => emptyDataStream,
      ),
      {
        status: 200,
      },
    );
  } catch (error) {
    console.error('Error creating resumable stream:', error);
    // Fallback to minimal response if stream creation fails
    return new Response(null, { status: 204 });
  }
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
