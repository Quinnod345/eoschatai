import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
  tool,
  generateText,
  UIMessage,
  stepCountIs,
  convertToModelMessages,
} from 'ai';
import { auth } from '@/app/(auth)/auth';
import { isAdminEmail } from '@/lib/auth/admin';
import { type RequestHints, systemPrompt, nexusResearcherPrompt } from '@/lib/ai/prompts';
import {
  createStreamId,
  deleteChatById,
  getChatById,
  getRecentMessagesByChatId,
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
import { getAccessContext, incrementUsageCounter } from '@/lib/entitlements';
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
import { triggerBackgroundSummary } from '@/lib/ai/background-summary';
import { searchWeb } from '@/lib/ai/tools/search-web';
import { z } from 'zod/v3';
import { MentionProcessor } from '@/lib/ai/mention-processor';
import { SmartMentionDetector } from '@/lib/ai/smart-mention-detector';
import { convertV4MessageToV5 } from '@/lib/ai/convert-messages';
// Citation formatting - citations now handled inline by the AI through searchWeb tool
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

      if (!redisUrl || typeof redisUrl !== 'string' || redisUrl.trim() === '') {
        console.log(
          ' > Resumable streams are disabled due to missing or invalid REDIS_URL',
        );
        return null;
      }

      // Clean the URL by removing any quotes that might be causing issues
      const cleanRedisUrl = redisUrl.trim().replace(/^["'](.*)["']$/, '$1');

      // Validate URL format
      if (
        !cleanRedisUrl.startsWith('redis://') &&
        !cleanRedisUrl.startsWith('rediss://')
      ) {
        console.warn(
          `[Chat Route] Invalid REDIS_URL format (expected redis:// or rediss://): ${cleanRedisUrl.substring(0, 20)}...`,
        );
        return null;
      }

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

function createTextStreamResponse(
  stream: ReadableStream<string> | null | undefined,
  init: ResponseInit = {},
) {
  if (!stream) {
    return new Response(null, init);
  }

  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'text/plain; charset=utf-8');
  }
  if (!headers.has('X-Vercel-AI-Data-Stream')) {
    headers.set('X-Vercel-AI-Data-Stream', 'v1');
  }

  return new Response(stream.pipeThrough(new TextEncoderStream()), {
    ...init,
    headers,
  });
}

// Lightweight preflight to pick model and suggest a token budget using GPT-4.1-nano
async function decideModelWithNano(args: {
  provider: ReturnType<typeof createCustomProvider>;
  queryText: string;
  hasCodeOrMath: boolean;
  hasDeepAnalysis?: boolean;
  hasFileUploads?: boolean;
  fileUploadCount?: number;
  inputCharacterCount?: number;
  mode?: 'nexus' | 'standard';
  hasComposerOpen?: boolean;
}): Promise<{
  model: 'gpt-4.1' | 'gpt-5';
  maxOutputTokens: number;
  reasoningEffort?: 'low' | 'medium' | 'high';
}> {
  const {
    provider,
    queryText,
    hasCodeOrMath,
    hasDeepAnalysis = false,
    hasFileUploads = false,
    fileUploadCount = 0,
    inputCharacterCount = 0,
    mode = 'standard',
    hasComposerOpen = false,
  } = args;
  console.log('[PREFLIGHT] Starting nano preflight', {
    mode,
    hasComposerOpen,
    hasCodeOrMath,
    hasDeepAnalysis,
    hasFileUploads,
    fileUploadCount,
    inputCharacterCount,
    queryLength: (queryText || '').length,
  });
  const { text } = await generateText({
    model: provider.languageModel('gpt-4.1-nano'),
    system: `You are a token allocation grader. Decide the optimal OpenAI model and output token budget ONLY from the task text and context below.

MODEL SELECTION (be generous with GPT-5):
- Use GPT-4.1 for: simple explanations, basic tutorials, straightforward code, simple troubleshooting, brief summaries.
- Use GPT-5 for: deep analysis, comprehensive summaries, multi-faceted analysis, literary/rhetorical analysis, "find what's hidden", critical analysis, weakness identification, audience analysis, detailed documentation, research tasks, or any request asking for both summary AND analysis.

DEEP ANALYSIS TRIGGERS (use GPT-5):
- "deep analysis", "comprehensive", "thorough", "detailed analysis"
- "find hidden", "beneath the surface", "relate everything", "central point"
- "rhetorical situation", "audience analysis", "critical analysis"
- "pick apart", "weak points", "critique", "evaluate"
- Multiple analysis dimensions requested (e.g., summary + analysis + rhetorical + audience)
- Academic or scholarly analysis requests
- Requests with specific formatting requirements for analysis

FILE UPLOAD TRIGGERS (strongly favor GPT-5):
- Any file uploads present (PDFs, documents, images, etc.)
- Multiple file uploads (2+ files) = automatic GPT-5
- Large documents (10+ pages) = automatic GPT-5
- Analysis of uploaded content = automatic GPT-5

INPUT LENGTH CONSIDERATIONS:
- Character count > 5000: Lean towards GPT-5
- Character count > 10000: Strong preference for GPT-5
- Character count > 20000: Automatic GPT-5
- Very long inputs often contain complex context requiring deeper reasoning

REASONING EFFORT (when GPT-5 is selected):
- Use "low" for: moderate complexity queries, summaries, standard analysis
- Use "medium" for: multi-step reasoning, critique, comparative analysis, complex code review
- Use "high" for: extreme complexity, multi-faceted analysis, research synthesis, hidden insight discovery, academic rigor, philosophical analysis, strategic planning

TOKEN BUDGET TIERS (choose one range, then pick a value inside it):
- Minimal: 400–800
- Light: 800–1500
- Standard: 1500–3000
- Comprehensive: 3000–6000
- Extensive: 6000–10000
- Massive: 10000–20000

TOKEN BUDGET ADJUSTMENTS:
- File uploads: +50% minimum, +100% for multiple files
- Long input (>10k chars): +40% minimum
- Very long input (>20k chars): +80% minimum
- Code/programming: +40–50% tokens baseline
- Math/derivations: +40–50% tokens baseline
- Literary/rhetorical analysis: +50–60% tokens baseline
- Multiple adjustments stack (e.g., file upload + long input + analysis)

DOCUMENT EDITING TRIGGERS (use high token budgets):
- "expand", "add more", "elaborate", "add detail", "add examples"
- "edit the document", "update the document", "revise", "rewrite"
- "add transitions", "improve", "enhance", "make it better"
- Document editing requires 3000–8000 tokens minimum for substantial edits
- When composer_open is true, assume document editing context

INTELLIGENCE SIGNALS:
- Major token increase for: "deep", "comprehensive", "thorough", "in-depth", "analysis", multi-part requests, academic analysis, literary criticism.
- Moderate increase for: examples, comparisons, strategies, step-by-step.
- File processing requires both intelligence and tokens for thorough analysis.

MODE CONTEXT:
- mode: ${mode}
- composer_open: ${hasComposerOpen}
If mode is nexus, allow even higher budgets. If composer_open is true, allocate AT LEAST 4000 tokens for document editing tasks.

Return STRICT JSON: {"model":"gpt-4.1"|"gpt-5","max_tokens":<integer 400..100000>,"reasoning_effort":"low"|"medium"|"high"}. 
If model is gpt-4.1, reasoning_effort must be "low" (ignored for GPT-4.1). 
If model is gpt-5, choose appropriate reasoning_effort based on complexity. No commentary.`,
    prompt: `task: ${queryText}\ncode_or_math: ${hasCodeOrMath}\ndeep_analysis_detected: ${hasDeepAnalysis}\nhas_file_uploads: ${hasFileUploads}\nfile_upload_count: ${fileUploadCount}\ninput_character_count: ${inputCharacterCount}\ncomposer_open: ${hasComposerOpen}`,
    maxOutputTokens: 128,
    temperature: 0,
  });

  const cleaned = text.trim().replace(/^```json\s*|\s*```$/g, '');
  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch (parseError) {
    console.error('[PREFLIGHT] Failed to parse nano response:', cleaned);
    throw new Error('Nano preflight returned invalid JSON');
  }

  const model = parsed.model === 'gpt-5' ? 'gpt-5' : 'gpt-4.1';
  const maxTokens = Number(parsed.max_tokens);
  // Normalize reasoning_effort to one of: 'low' | 'medium' | 'high'. Default to 'medium' if invalid.
  const rawEffort =
    typeof parsed.reasoning_effort === 'string'
      ? parsed.reasoning_effort.toLowerCase().trim()
      : '';
  const allowedEfforts = new Set(['low', 'medium', 'high']);
  const reasoningEffort: 'low' | 'medium' | 'high' = allowedEfforts.has(
    rawEffort,
  )
    ? (rawEffort as 'low' | 'medium' | 'high')
    : 'medium';
  if (!Number.isFinite(maxTokens)) {
    throw new Error('Nano preflight returned invalid max_tokens');
  }
  console.log('[PREFLIGHT] Decision', { model, maxOutputTokens: maxTokens, reasoningEffort });
  return {
    model,
    maxOutputTokens: Math.max(200, Math.floor(maxTokens)),
    reasoningEffort: model === 'gpt-5' ? reasoningEffort : undefined,
  };
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

    const accessContext = await getAccessContext(session.user.id);
    const chatLimit = accessContext.entitlements.features.chats_per_day;

    if (
      chatLimit > 0 &&
      accessContext.user.usageCounters.chats_today >= chatLimit
    ) {
      return new Response(
        JSON.stringify({
          error: 'DAILY_LIMIT_REACHED',
          message: 'You have reached your daily message limit.',
          limit: chatLimit,
          used: accessContext.user.usageCounters.chats_today,
          plan: accessContext.user.plan,
        }),
        {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    const chat = await getChatById({ id });

    if (!chat) {
      console.log('PERSONA_CHAT_API: Creating new chat', {
        chatId: id,
        userId: session.user.id,
        personaId: selectedPersonaId,
      });

      // Generate title with fallback in case AI fails
      let title = 'New Chat';
      try {
        title = await generateTitleFromUserMessage({
          message,
        });
      } catch (titleError) {
        console.error('Title generation failed, using fallback:', titleError);
        // Extract text from message for fallback title
        const firstPart = message.parts?.[0];
        let messageText = '';
        if (typeof firstPart === 'string') {
          messageText = firstPart;
        } else if (
          firstPart &&
          typeof firstPart === 'object' &&
          'text' in firstPart
        ) {
          messageText = firstPart.text || '';
        }
        const fallbackTitle = messageText.substring(0, 50);
        title =
          fallbackTitle + (messageText.length > 50 ? '...' : '') || 'New Chat';
      }

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

        // Sanitize title to prevent metadata injection
        // Remove any existing metadata markers to prevent corruption
        const sanitizedTitle = title.replace(/\|\|\|EOS_META:.*/g, '');

        // Encode the EOS Implementer selection in the title as metadata
        const metadata = {
          persona: 'eos-implementer',
          profile: selectedProfileId || null,
        };
        titleWithMetadata = `${sanitizedTitle}|||EOS_META:${JSON.stringify(metadata)}`;

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

    // Get recent messages with sliding window (limit to last 50)
    const { messages: previousMessages, totalCount } =
      await getRecentMessagesByChatId({ chatId: id, limit: 50 });

    // Check if we need to generate/retrieve conversation summary
    let conversationSummaryText = '';
    if (totalCount > 50) {
      console.log(
        `Message History: Chat has ${totalCount} messages, loading summary for older context`,
      );

      // Get chat record to check for existing summary
      const chatRecord = await getChatById({ id });
      if (chatRecord?.conversationSummary) {
        conversationSummaryText = chatRecord.conversationSummary;
        console.log(
          `Message History: Using existing summary (${conversationSummaryText.length} chars)`,
        );
      } else {
        // Trigger background summary generation
        console.log(
          'Message History: No summary available yet, triggering background generation',
        );
        triggerBackgroundSummary(id);
      }
    }

    // AI SDK 5: Attachments are now file parts in the parts array
    // Apply v4 → v5 conversion for any legacy parts (tool-invocation, etc.)
    const normalizedPreviousMessages = previousMessages.map((dbMessage, index) => {
      // Convert attachments to file parts and merge with existing parts
      const attachmentParts = Array.isArray(dbMessage.attachments)
        ? dbMessage.attachments.map((att: any) => ({
            type: 'file' as const,
            url: att.url,
            mediaType: att.contentType || att.mediaType,
            name: att.name,
          }))
        : [];
      
      // Ensure parts is an array before spreading
      const existingParts = Array.isArray(dbMessage.parts) ? dbMessage.parts : [];
      
      const baseMessage = {
        ...dbMessage,
        parts: [...existingParts, ...attachmentParts],
      };
      
      // Apply v4 → v5 conversion for any legacy parts
      return convertV4MessageToV5(baseMessage as any, index);
    });

    // Manually append client message (appendClientMessage was removed in AI SDK 5)
    const messages = [...normalizedPreviousMessages, message] as UIMessage[];

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

    // Check for new embedded content format
    const hasEmbeddedContent = queryText.includes('[EMBEDDED_CONTENT_START]');

    // Count file uploads
    let fileUploadCount = 0;
    if (hasInlineDocuments) {
      // Count legacy format uploads
      fileUploadCount += (queryText.match(/=== PDF Content from/g) || [])
        .length;
      fileUploadCount += (
        queryText.match(/=== Word Document Content from/g) || []
      ).length;
      fileUploadCount += (
        queryText.match(/=== Spreadsheet Content from/g) || []
      ).length;
      fileUploadCount += (queryText.match(/=== Image Analysis for/g) || [])
        .length;
    }
    if (hasEmbeddedContent) {
      // Count new format uploads
      const embeddedMatches = queryText.match(/\[EMBEDDED_CONTENT_START\]/g);
      fileUploadCount += embeddedMatches ? embeddedMatches.length : 0;
    }

    const hasFileUploads = hasInlineDocuments || hasEmbeddedContent;

    if (hasFileUploads) {
      console.log('RAG: Detected file uploads in user message', {
        hasInlineDocuments,
        hasEmbeddedContent,
        fileUploadCount,
      });
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

    // Store document IDs for context tracking
    let userDocumentIds: string[] = [];
    let userDocumentNames: string[] = [];

    // Skip RAG for very short or generic queries (<= 12 chars)
    // These queries like "hi", "ok", "yes", "mary antin" are too generic and match everything
    const shouldSkipRAG = !queryText || queryText.trim().length <= 12;
    if (shouldSkipRAG) {
      console.log(
        `RAG: Skipping RAG for short/generic query (${queryText?.length || 0} chars)`,
      );
    }

    const [
      relevantContent,
      userRagResult,
      personaRagContext,
      systemRagContext,
      memoryContext,
    ] = await Promise.all([
      // General RAG (Knowledge Base) - Company RAG
      queryText && !shouldSkipRAG
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

      // User RAG (User Documents) - Enhanced to return document IDs
      session.user.id && queryText && !shouldSkipRAG
        ? (() => {
            const userRagStart = Date.now();
            return import('@/lib/ai/user-rag-context')
              .then(({ getUserRagContextWithMetadata }) =>
                getUserRagContextWithMetadata(session.user.id, ragQueryText),
              )
              .then((result) => {
                const userRagTime = Date.now() - userRagStart;
                console.log(
                  `User RAG: Generated context with ${result.context.length} characters from ${result.documentIds.length} documents in ${userRagTime}ms`,
                );

                // Store document IDs for context tracking
                userDocumentIds = result.documentIds;
                userDocumentNames = result.documentNames;

                // Debug: Log first 200 characters and document info
                if (result.context.length > 0) {
                  console.log(
                    `User RAG: Context preview: ${result.context.substring(0, 200)}...`,
                  );
                  console.log(
                    `User RAG: Documents used: ${result.documentNames.join(', ')}`,
                  );
                }
                return result;
              })
              .catch((error) => {
                const userRagTime = Date.now() - userRagStart;
                console.error(
                  `User RAG: Error getting user RAG context after ${userRagTime}ms:`,
                  error,
                );
                return { context: '', documentIds: [], documentNames: [] };
              });
          })()
        : Promise.resolve({ context: '', documentIds: [], documentNames: [] }),

      // Persona RAG (Persona Documents) - Only if persona is selected
      selectedPersonaId && queryText && !shouldSkipRAG
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
      selectedPersonaId && queryText && !shouldSkipRAG
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

      // Memory RAG (User Memories)
      session.user.id && queryText && !shouldSkipRAG
        ? (() => {
            const memoryRagStart = Date.now();
            console.log(
              `Memory RAG: Starting retrieval for user ${session.user.id} with query: "${queryText}"`,
            );

            return import('@/lib/ai/memory-rag')
              .then(({ findRelevantMemories, formatMemoriesForPrompt }) =>
                findRelevantMemories(
                  session.user.id,
                  ragQueryText,
                  10,
                  0.75, // Raised from 0.5 to 0.75 - only include highly relevant memories
                ).then((memories) => {
                  const memoryRagTime = Date.now() - memoryRagStart;
                  console.log(
                    `Memory RAG: Retrieved ${memories.length} relevant memories in ${memoryRagTime}ms`,
                  );

                  if (memories.length > 0) {
                    console.log(
                      `Memory RAG: Top memory: "${memories[0].summary.substring(0, 100)}..." (relevance: ${(memories[0].relevance * 100).toFixed(1)}%)`,
                    );
                  }

                  // Format memories into prompt
                  const formattedMemories = formatMemoriesForPrompt(memories);

                  if (formattedMemories.length > 0) {
                    console.log(
                      `Memory RAG: Formatted context with ${formattedMemories.length} characters`,
                    );
                  }

                  return formattedMemories;
                }),
              )
              .catch((error) => {
                const memoryRagTime = Date.now() - memoryRagStart;
                console.error(
                  `Memory RAG: Error retrieving memories after ${memoryRagTime}ms:`,
                  error,
                );
                return '';
              });
          })()
        : Promise.resolve(''),
    ]);

    // Extract user RAG context string
    const userRagContext =
      typeof userRagResult === 'string' ? userRagResult : userRagResult.context;

    const ragEndTime = Date.now();
    console.log(
      `RAG: All parallel operations completed in ${ragEndTime - ragStartTime}ms`,
    );

    // Nexus Research Mode context - now handled by agentic researcher prompt
    const nexusResearchContext = '';

    // Log results summary
    if (!queryText) {
      console.log(
        'RAG: No text content found in user message to use for retrieval',
      );
    } else {
      console.log(
        `RAG Summary:`,
        `\n  - Company knowledge base: ${relevantContent.length} chunks`,
        `\n  - User documents: ${userRagContext.length} characters (${userDocumentIds.length} docs: ${userDocumentNames.join(', ')})`,
        `\n  - Persona documents: ${personaRagContext.length} characters`,
        `\n  - System knowledge: ${systemRagContext.length} characters`,
        `\n  - User memories: ${memoryContext.length} characters`,
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

    // AI SDK 5: Extract file parts from message.parts to save as attachments
    const fileParts = (message.parts || []).filter((part: any) => part.type === 'file');
    const nonFileParts = (message.parts || []).filter((part: any) => part.type !== 'file');
    const attachmentsToSave = fileParts.map((part: any) => ({
      url: part.url,
      contentType: part.mediaType,
      name: part.name,
    }));
    
    await saveMessages({
      messages: [
        {
          chatId: id,
          id: message.id,
          role: 'user',
          parts: nonFileParts.length > 0 ? nonFileParts : message.parts,
          attachments: attachmentsToSave,
          createdAt: new Date(),
          provider: selectedProvider,
        },
      ],
    });

    // Increment usage counter AFTER message is successfully saved
    await incrementUsageCounter(session.user.id, 'chats_today', 1);

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
      memoryContext: memoryContext, // User memories
      conversationSummary: conversationSummaryText, // Conversation summary for long chats
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
    // AI SDK 5: Provide originalMessages and generateId to prevent duplicate messages
    const responseStream = createUIMessageStream({
      originalMessages: normalizedPreviousMessages,
      generateId: generateUUID,
      execute: async ({ writer }) => {
        // Send initial status (transient - not added to message history)
        writer.write({
          type: 'data-custom',
          id: generateUUID(),
          transient: true,
          data: {
            type: 'chat-status',
            status: 'processing',
            message: 'Processing your request',
          }
        });

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

        // Preflight: decide model and token guidance using nano
        const hasCodeOrMath =
          /```|\b(code|implement|function|class|SQL|regex|equation|integral|proof|derive|theorem)\b/i.test(
            queryText || '',
          );

        // Enhanced detection for deep analysis requests
        const hasDeepAnalysis =
          /\b(deep analysis|comprehensive|thorough|detailed analysis|find.*hidden|beneath.*surface|relate everything|central point|rhetorical situation|audience analysis|critical analysis|pick apart|weak points|critique|evaluate)\b/i.test(
            queryText || '',
          ) ||
          (queryText?.toLowerCase().includes('summary') &&
            queryText?.toLowerCase().includes('analysis')); // Both summary AND analysis requested

        const providerForDecision = createCustomProvider(selectedProvider);
        let preflightModel: 'gpt-4.1' | 'gpt-5' = 'gpt-4.1';
        let preflightMaxTokens = 2000;
        let preflightReasoningEffort: 'low' | 'medium' | 'high' | undefined =
          undefined;

        // If the user supplied URLs, instruct the model to fetch them via searchWeb before answering
        const urlRegex = /(https?:\/\/[^\s)]+)|(www\.[^\s)]+)/gi;
        const suppliedUrls = Array.from(
          new Set((queryText || '').match(urlRegex) || []),
        );
        const urlFetchInstruction =
          suppliedUrls.length > 0
            ? `\n\nUSER PROVIDED LINKS (RETRIEVE BEFORE ANSWERING):\n${suppliedUrls
                .map((u, i) => `- [${i + 1}] ${u}`)
                .join(
                  '\n',
                )}\n\nCRITICAL: Use the searchWeb tool to fetch the content of EACH link above BEFORE writing any part of your answer. If a link fails, perform a refined web search for the page title and topic. After fetching, think briefly, optionally refine search, then synthesize.\n`
            : '';

        // Combine the enhanced system prompt with nexus research context and URL instruction
        // In Nexus mode, append the agentic researcher prompt for autonomous research
        const nexusPromptAddition = isNexusMode ? `\n\n${nexusResearcherPrompt}` : '';
        const finalSystemPrompt =
          enhancedSystemPrompt +
          nexusResearchContext +
          nexusPromptAddition +
          urlFetchInstruction +
          toolResponseInstructions;

        // Run preflight for all modes, but with different parameters for Nexus
        writer.write({
          type: 'data-custom',
          id: generateUUID(),
          transient: true,
          data: {
            type: 'chat-status',
            status: 'preflight',
            message: 'Analyzing request',
          }
        });

        try {
          const decision = await decideModelWithNano({
            provider: providerForDecision,
            queryText: queryText || '',
            hasCodeOrMath,
            hasDeepAnalysis: hasDeepAnalysis || isNexusMode, // Treat Nexus as deep analysis
            hasFileUploads,
            fileUploadCount,
            inputCharacterCount: queryText.length,
            mode: isNexusMode ? 'nexus' : 'standard',
            hasComposerOpen: Boolean(composerDocumentId),
          });
          preflightModel = decision.model;
          preflightMaxTokens = decision.maxOutputTokens;
          preflightReasoningEffort = decision.reasoningEffort;

          console.log('[PREFLIGHT] Final decision:', {
            model: preflightModel,
            maxOutputTokens: preflightMaxTokens,
            reasoningEffort: preflightReasoningEffort,
            mode: isNexusMode ? 'nexus' : 'standard',
          });
        } catch (e) {
          console.warn(
            'Preflight decision failed, falling back to defaults',
            e,
          );
          // For Nexus mode, use more generous defaults
          if (isNexusMode) {
            preflightModel = 'gpt-5';
            preflightMaxTokens = 8000;
            preflightReasoningEffort = 'high';
          }
        }

        // Apply conservative override: favor GPT-4.1 unless Nexus forces otherwise
        // Nexus mode uses GPT-4.1 by default per requirements; otherwise use preflight selection
        // Nexus uses the preflight-selected model as well, but preflight is conservative with GPT-5
        // Use preflight model selection for all modes
        const finalChatModel = preflightModel;

        // Establish safe hard limit based on final model
        // More generous limits for both models
        const safeHardLimit = finalChatModel.includes('gpt-4.1')
          ? 32000 // Doubled from 16000
          : 100000; // Doubled from 50000
        // Set temperature based on model
        // GPT-5 and newer models only support default temperature of 1
        const temperature = finalChatModel === 'gpt-5' ? 1 : 0.8;

        // For Nexus mode, allow reasonable cap; otherwise, clamp by both preflight and model limit
        // When a composer is open, use a much higher minimum for document editing
        const baseMinTokens = composerDocumentId ? 4000 : 1000;
        const nexusTokenLimit = isNexusMode
          ? 16000 // Doubled from 8000
          : Math.min(
              safeHardLimit,
              Math.max(baseMinTokens, preflightMaxTokens),
            );

        // Compute artifact token multiplier without disrupting preflight
        // More generous boost: 2.0x up to a higher cap
        const artifactMaxTokens = isNexusMode
          ? 24000 // Doubled from 12000
          : Math.min(20000, Math.floor((preflightMaxTokens || 3000) * 2.0)); // Increased multiplier and cap

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

        writer.write({
          type: 'data-custom',
          id: generateUUID(),
          transient: true,
          data: {
            type: 'chat-status',
            status: 'generating',
            message: 'Generating response',
          }
        });

        // NEXUS AGENTIC RESEARCH MODE
        // The AI handles planning and research autonomously through the nexusResearcherPrompt
        // Phase 1: AI creates plan, may ask clarifying questions if needed
        // Phase 2: AI searches autonomously using searchWeb tool
        // No complex orchestration needed - AI SDK maxSteps handles multi-turn tool calling
        if (selectedResearchMode === 'nexus' && queryText) {
          console.log('[NEXUS MODE] Agentic research mode enabled');
          
          // Signal that we're in Nexus mode (transient)
          writer.write({
            type: 'data-custom',
            id: generateUUID(),
            transient: true,
            data: {
              type: 'nexus-mode-active',
              message: 'Nexus Research Mode activated',
            }
          });
          
          // The nexusResearcherPrompt is appended to the system prompt below
          // The AI will autonomously:
          // 1. Create a brief research plan
          // 2. Ask clarifying questions if needed (as regular text output)
          // 3. Begin autonomous research using searchWeb tool
          // 4. Synthesize findings with citations
        }

        // Set up a timeout variable
        let responseTimeout: NodeJS.Timeout | undefined;

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
              reasoningEffort: preflightReasoningEffort || 'none',
            },
          );

          try {
            const result = streamText({
              model: provider.languageModel(finalChatModel),
              system: `${finalSystemPrompt}${preCreatedComposerNote}`,
              messages: await convertToModelMessages(modifiedMessages),
              stopWhen: stepCountIs(isNexusMode ? 30 : 20), // Increased: Nexus needs more steps for comprehensive research
              experimental_activeTools: [
                'searchWeb', // FIRST for priority - web search
                'getWeather',
                'createDocument',
                'updateDocument',
                'requestSuggestions',
                'addResource',
                'getInformation',
                'cleanKnowledgeBase',
                'getCalendarEvents',
                'createCalendarEvent',
                'checkCalendarConflicts',
                'findAvailableTimeSlots',
                'getCalendarAnalytics',
                'getDailyBriefing',
                'parseNaturalLanguageEvent',
                'findSmartAvailability',
              ],
              // Removed smoothStream transform - frontend handles smoothing with useSmoothStream hook
              // This allows immediate character-by-character streaming without word buffering
              // AI SDK 5: experimental_generateMessageId removed - use generateId in toUIMessageStreamResponse
              // Dynamic settings based on Nexus mode
              temperature: temperature, // Use the variable we defined
              maxOutputTokens: nexusTokenLimit, // Much higher limit for nexus/o3
              // Add reasoning effort for GPT-5
              ...(finalChatModel === 'gpt-5' && preflightReasoningEffort
                ? {
                    experimental_providerMetadata: {
                      openai: {
                        reasoningEffort: preflightReasoningEffort,
                      },
                    },
                  }
                : {}),
              tools: {
                // Web search tool - FIRST for priority
                searchWeb,
                getWeather,
                createDocument: createDocument({
                  session,
                  dataStream: writer,
                  artifactMaxTokens,
                  // Provide the original chat query plus recent tool results for richer context
                  context: (() => {
                    let enrichedContext = queryText || '';
                    const MAX_CONTEXT_SIZE = 2000000; // 2MB safety limit (extreme edge case protection)
                    let searchResultsAdded = 0;

                    // FIRST: Include recent conversation history for context
                    const conversationHistory = messages
                      .slice(-10) // Last 10 messages for conversation context
                      .map((msg) => {
                        if (msg.role === 'user') {
                          // Extract text from user messages
                          const textParts = msg.parts
                            ?.filter((p: any) => p.type === 'text')
                            .map((p: any) => p.text)
                            .join('\n');
                          return `User: ${textParts || ''}`;
                        } else if (msg.role === 'assistant') {
                          // Extract text from assistant messages
                          const textParts = msg.parts
                            ?.filter((p: any) => p.type === 'text')
                            .map((p: any) => p.text)
                            .join('\n');
                          return `Assistant: ${textParts || ''}`;
                        }
                        return null;
                      })
                      .filter((m): m is string => m !== null)
                      .join('\n\n');

                    if (conversationHistory) {
                      enrichedContext += '\n\n=== Recent Conversation ===\n';
                      enrichedContext += `${conversationHistory}\n`;
                    }

                    // SECOND: Include ALL web search results from conversation history
                    // Don't limit to recent messages - user might reference older searches
                    for (const msg of messages) {
                      if (msg.role === 'assistant' && msg.parts) {
                        for (const part of msg.parts) {
                          // AI SDK 5: Handle both old format (tool-invocation) and new format (tool-*)
                          const isToolPart = part.type === 'tool-invocation' || (part.type as string)?.startsWith('tool-');
                          if (isToolPart) {
                            const toolInv = (part as any).toolInvocation;
                            const toolName = toolInv?.toolName || (part.type as string)?.replace('tool-', '');
                            const state = toolInv?.state || (part as any).state;
                            const result = toolInv?.result || (part as any).output;
                            
                            // AI SDK 5: state 'result' renamed to 'output-available'
                            if (
                              toolName === 'searchWeb' &&
                              (state === 'result' || state === 'output-available') &&
                              result
                            ) {
                              const results = result.results || [];
                              if (results.length > 0) {
                                // Build the search result block first
                                let searchBlock =
                                  '\n\n=== Web Search Results ===\n';
                                searchBlock += `Query: ${result.query}\n\n`;
                                results
                                  .slice(0, 8)
                                  .forEach((r: any, i: number) => {
                                    searchBlock += `${i + 1}. **${r.title}**\n`;
                                    searchBlock += `   URL: ${r.url}\n`;
                                    // Use full content instead of just snippet (up to 5000 chars per result)
                                    if (r.content) {
                                      searchBlock += `   Content: ${r.content}\n`;
                                    } else if (r.snippet) {
                                      searchBlock += `   Snippet: ${r.snippet}\n`;
                                    }
                                    searchBlock += '\n';
                                  });

                                // Safety check: verify adding this block won't exceed limit
                                if (
                                  enrichedContext.length + searchBlock.length >
                                  MAX_CONTEXT_SIZE
                                ) {
                                  console.warn(
                                    `[Document Context] Reached max context size (${MAX_CONTEXT_SIZE} chars), stopping extraction. Added ${searchResultsAdded} search result sets. Next block would exceed limit by ${enrichedContext.length + searchBlock.length - MAX_CONTEXT_SIZE} chars.`,
                                  );
                                  break;
                                }

                                // Safe to add - won't exceed limit
                                enrichedContext += searchBlock;
                                searchResultsAdded++;
                              }
                            }
                          }
                        }
                      }
                    }

                    console.log(
                      `[Document Context] Enriched with ${searchResultsAdded} search result sets, total context: ${enrichedContext.length} chars (${Math.round(enrichedContext.length / 1024)}KB)`,
                    );
                    return enrichedContext;
                  })(),
                }),
                updateDocument: updateDocument({
                  session,
                  dataStream: writer,
                  artifactMaxTokens,
                }),
                requestSuggestions: requestSuggestions({
                  session,
                  dataStream: writer,
                }),
                addResource: tool({
                  description:
                    'Add a new resource to the EOS knowledge base. Use this whenever the user shares information that should be remembered for future reference.',
                  inputSchema: z.object({
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
                  inputSchema: z.object({
                    query: z
                      .string()
                      .describe(
                        'The specific query to search for in the knowledge base',
                      ),
                  }),
                  execute: async ({ query }) => {
                    console.log('RAG: Tool called to get information', {
                      query,
                      limit: 5,
                    });
                    const infoResult = await getInformationTool.execute(
                      { query, limit: 5 },
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
                  inputSchema: z.object({
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
                  inputSchema: z.object({}),
                  execute: async () => {
                    // Defaults handled inside tool implementation to avoid schema 'required' issues
                    const timeMin = undefined;
                    const timeMax = undefined;
                    const maxResults = undefined;
                    const searchTerm = undefined;
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
                  inputSchema: z.object({
                    summary: z
                      .string()
                      .describe('The title/summary of the event'),
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
                  }),
                  execute: async ({ summary, startDateTime, endDateTime }) => {
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
                        { summary, startDateTime, endDateTime },
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
                  inputSchema: z.object({
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
                  inputSchema: z.object({
                    duration: z.number().describe('Duration in minutes'),
                    searchDays: z
                      .number()
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
                  inputSchema: z.object({}),
                  execute: async () => {
                    const days = 30; // default handled internally
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
                  inputSchema: z.object({}),
                  execute: async () => {
                    const includePrep = true; // default handled internally
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
                  inputSchema: z.object({
                    text: z
                      .string()
                      .describe('Natural language description of the event'),
                  }),
                  execute: async ({ text }) => {
                    const currentDate = undefined; // default: use current date in tool
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
                  inputSchema: z.object({}),
                  execute: async () => {
                    const duration = 30;
                    const searchDays = 7;
                    const preferredTime = undefined;
                    const context = undefined;
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
              onStepFinish: async ({ toolCalls, toolResults }) => {
                // Send status updates for tool calls with concrete details
                if (!toolCalls || toolCalls.length === 0) return;

                for (const toolCall of toolCalls) {
                  if (toolCall.toolName === 'searchWeb') {
                    const q = (toolCall as any)?.args?.query;
                    
                    // In Nexus mode, send detailed progress events
                    if (isNexusMode) {
                      const searchResult = toolResults?.find(
                        (tr: any) => tr.toolCallId === toolCall.toolCallId
                      );
                      writer.write({
                        type: 'data-custom',
                        id: generateUUID(),
                        transient: true,
                        data: {
                          type: 'nexus-search-progress',
                          query: q || 'Searching...',
                          resultsFound: (searchResult as any)?.result?.resultCount || 0,
                          phase: 'researching',
                        }
                      });
                      console.log('[NEXUS] Search completed:', {
                        query: q,
                        resultsFound: (searchResult as any)?.result?.resultCount || 0,
                      });
                    } else {
                      // Standard mode: simple status update
                      writer.write({
                        type: 'data-custom',
                        id: generateUUID(),
                        transient: true,
                        data: {
                          type: 'chat-status',
                          status: 'searching',
                          message: q ? `Searching: ${q}` : 'Searching the web',
                        }
                      });
                    }
                  } else if (toolCall.toolName === 'getCalendarEvents') {
                    writer.write({
                      type: 'data-custom',
                      id: generateUUID(),
                      transient: true,
                      data: {
                        type: 'chat-status',
                        status: 'calendar',
                        message: 'Checking calendar',
                      }
                    });
                  } else if (toolCall.toolName === 'createDocument') {
                    writer.write({
                      type: 'data-custom',
                      id: generateUUID(),
                      transient: true,
                      data: {
                        type: 'chat-status',
                        status: 'creating',
                        message: 'Creating document',
                      }
                    });
                  }
                }
              },
              onFinish: async ({ response, usage, finishReason }) => {
                // Log usage statistics for monitoring
                if (usage) {
                  const outputTokens = usage.outputTokens || 0;
                  const inputTokens = usage.inputTokens || 0;
                  const totalTokens = usage.totalTokens || 0;

                  console.log('[USAGE] Token consumption:', {
                    input: inputTokens,
                    output: outputTokens,
                    total: totalTokens,
                    model: finalChatModel,
                    mode: isNexusMode ? 'nexus' : 'standard',
                    finishReason,
                  });

                  // Warn if approaching output limits
                  if (outputTokens > nexusTokenLimit * 0.9) {
                    console.warn(
                      `[USAGE] Response used ${outputTokens} tokens, very close to limit of ${nexusTokenLimit}`,
                    );
                  }

                  // Alert if response was truncated due to token limit
                  if (finishReason === 'length') {
                    console.error(
                      '[USAGE] Response truncated due to token limit!',
                      {
                        limit: nexusTokenLimit,
                        used: outputTokens,
                        model: finalChatModel,
                      },
                    );
                    // Send warning to client (transient)
                    writer.write({
                      type: 'data-custom',
                      id: generateUUID(),
                      transient: true,
                      data: {
                        type: 'token-limit-warning',
                        message: 'Response may be truncated due to length limits',
                        tokensUsed: outputTokens,
                        tokenLimit: nexusTokenLimit,
                      }
                    });
                  }
                }

                if (session.user?.id) {
                  try {
                    // AI SDK 5: Use result.steps to get ALL tool calls across all steps
                    // result.toolCalls only returns the LAST step's calls!
                    const assistantId = generateUUID();
                    
                    // Build message parts including text AND tool invocations
                    const messageParts: any[] = [];
                    
                    // Get all steps to collect tool calls from ALL steps (not just last)
                    const steps = await result.steps;
                    
                    console.log('[SAVE] Total steps:', steps?.length || 0);
                    
                    // Collect ALL tool calls and results from ALL steps
                    const allToolCalls: any[] = [];
                    const allToolResults: any[] = [];
                    let finalText = '';
                    
                    for (const step of steps || []) {
                      // Accumulate text from each step
                      if (step.text) {
                        finalText += step.text;
                      }
                      
                      // Collect tool calls from this step
                      if (step.toolCalls && step.toolCalls.length > 0) {
                        console.log(`[SAVE] Step has ${step.toolCalls.length} tool calls`);
                        allToolCalls.push(...step.toolCalls);
                      }
                      
                      // Collect tool results from this step
                      if (step.toolResults && step.toolResults.length > 0) {
                        console.log(`[SAVE] Step has ${step.toolResults.length} tool results`);
                        allToolResults.push(...step.toolResults);
                      }
                    }
                    
                    // Add the final text
                    if (finalText && finalText.trim()) {
                      messageParts.push({ type: 'text', text: finalText });
                    }
                    
                    console.log('[SAVE] Total tool calls found:', allToolCalls.length);
                    console.log('[SAVE] Total tool results found:', allToolResults.length);
                    
                    // Match tool calls with their results
                    for (const toolCall of allToolCalls) {
                      const tc = toolCall as any;
                      
                      // Find the matching result
                      const matchingResult = allToolResults.find(
                        (tr: any) => tr.toolCallId === tc.toolCallId
                      );
                      const mr = matchingResult as any;
                      
                      console.log(`[SAVE] Tool ${tc.toolName}:`, {
                        toolCallId: tc.toolCallId,
                        hasResult: !!matchingResult,
                        resultKeys: mr?.result ? Object.keys(mr.result) : [],
                      });
                      
                      // Save as SDK 5 tool part format: tool-{toolName}
                      messageParts.push({
                        type: `tool-${tc.toolName}`,
                        toolCallId: tc.toolCallId,
                        toolName: tc.toolName,
                        input: tc.args,
                        state: matchingResult ? 'output-available' : 'input-available',
                        output: mr?.result,
                      });
                    }

                    // Get citations from Redis if available (better than globalThis)
                    if (selectedResearchMode === 'nexus') {
                      const redisUrl = process.env.REDIS_URL?.replace(
                        /^["'](.*)["']$/,
                        '$1',
                      );
                      if (redisUrl) {
                        let redis: any = null;
                        try {
                          const { createClient } = await import('redis');
                          redis = createClient({ url: redisUrl });
                          await redis.connect();

                          // Try to get citations from Redis
                          const citationsData = await redis.get(
                            `nexus:${streamId}:citations`,
                          );
                          if (citationsData) {
                            let citations: any = null;
                            try {
                              citations = JSON.parse(citationsData);
                            } catch (parseError) {
                              console.error(
                                '[NEXUS MODE] Failed to parse citations JSON:',
                                parseError,
                              );
                              console.error(
                                '[NEXUS MODE] Raw citations data:',
                                citationsData?.substring(0, 500),
                              );
                              // Fallback: Try to recover citations by attempting alternate parsing
                              try {
                                // Sometimes data might be double-encoded or malformed
                                citations = JSON.parse(
                                  citationsData.replace(/\\/g, ''),
                                );
                                console.log(
                                  '[NEXUS MODE] Successfully recovered citations using fallback parsing',
                                );
                              } catch (fallbackError) {
                                console.error(
                                  '[NEXUS MODE] Fallback parsing also failed, citations will be unavailable',
                                );
                                // Add error metadata to message so user knows citations failed
                                (messageParts as any[]).push({
                                  type: 'error',
                                  errorId: 'citation-parse-failure',
                                  message:
                                    'Citation data was retrieved but could not be parsed',
                                });
                              }
                            }
                            if (
                              citations &&
                              Array.isArray(citations) &&
                              citations.length > 0
                            ) {
                              console.log(
                                `[NEXUS MODE] Retrieved ${citations.length} citations from Redis`,
                              );
                              // Store citations as metadata in the message
                              // Using type assertion since we're storing custom metadata
                              (messageParts as any[]).push({
                                type: 'source',
                                sourceId: 'nexus-citations',
                                content: JSON.stringify({ citations }),
                              });
                            } else if (citations !== null) {
                              console.warn(
                                '[NEXUS MODE] Citations data was parsed but is not a valid array',
                                typeof citations,
                              );
                            }
                          }
                        } catch (redisError) {
                          console.error(
                            '[NEXUS MODE] Failed to retrieve citations from Redis:',
                            redisError,
                          );
                        } finally {
                          // Ensure Redis connection is always closed
                          if (redis) {
                            try {
                              await redis.disconnect();
                            } catch (disconnectError) {
                              console.error(
                                '[NEXUS MODE] Error disconnecting from Redis:',
                                disconnectError,
                              );
                            }
                          }
                        }
                      }
                    }

                    // AI SDK 5: experimental_attachments removed, attachments now in parts array
                    await saveMessages({
                      messages: [
                        {
                          id: assistantId,
                          chatId: id,
                          role: 'assistant',
                          parts: messageParts,
                          attachments: [], // Attachments now part of file parts
                          createdAt: new Date(),
                          provider: selectedProvider,
                        },
                      ],
                    });

                    // Log context usage for effectiveness tracking
                    try {
                      const { logContextUsage } = await import(
                        '@/lib/db/context-tracking'
                      );

                      // Count chunks from each source
                      const systemChunks = systemRagContext
                        ? (systemRagContext.match(/\[\d+\]/g) || []).length
                        : 0;
                      const personaChunks = personaRagContext
                        ? (personaRagContext.match(/\[\d+\]/g) || []).length
                        : 0;
                      const userChunksMatch = userRagContext
                        ? (userRagContext.match(/\[\d+\]/g) || []).length
                        : 0;
                      const memoryChunksMatch = memoryContext
                        ? (memoryContext.match(/^-/gm) || []).length
                        : 0;

                      await logContextUsage({
                        chatId: id,
                        messageId: assistantId,
                        userId: session.user.id,
                        queryComplexity: undefined, // Will be added when we integrate query analysis
                        systemChunks,
                        personaChunks,
                        userChunks: userChunksMatch,
                        memoryChunks: memoryChunksMatch,
                        conversationSummaryUsed:
                          conversationSummaryText.length > 0,
                        totalTokens: usage?.totalTokens,
                        contextTokens: usage?.inputTokens,
                        responseTokens: usage?.outputTokens,
                        model: finalChatModel,
                        metadata: {
                          personaId: selectedPersonaId,
                          profileId: selectedProfileId,
                          researchMode: selectedResearchMode,
                          userDocumentIds, // Track which documents were used
                          userDocumentNames, // Track document names for display
                        },
                      });

                      console.log(
                        `[CONTEXT TRACKING] Logged usage: ${systemChunks} system, ${personaChunks} persona, ${userChunksMatch} user chunks, ${memoryChunksMatch} memories`,
                      );
                    } catch (trackingError) {
                      console.error(
                        '[CONTEXT TRACKING] Failed to log usage:',
                        trackingError,
                      );
                      // Don't throw - tracking shouldn't break chat
                    }

                    // Clean up nexus metadata if this was a nexus mode search
                    if (selectedResearchMode === 'nexus') {
                      const redisUrl = process.env.REDIS_URL?.replace(
                        /^["'](.*)["']$/,
                        '$1',
                      );
                      if (redisUrl) {
                        let redis: any = null;
                        try {
                          const { createClient } = await import('redis');
                          redis = createClient({ url: redisUrl });
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

                          // Clean up citations data after saving
                          await redis.del(`nexus:${streamId}:citations`);

                          console.log(
                            '[NEXUS MODE] Updated stream metadata to completed status and cleaned up citations',
                          );
                        } catch (redisError) {
                          console.error(
                            '[NEXUS MODE] Failed to update completed state:',
                            redisError,
                          );
                        } finally {
                          // Ensure Redis connection is always closed
                          if (redis) {
                            try {
                              await redis.disconnect();
                            } catch (disconnectError) {
                              console.error(
                                '[NEXUS MODE] Error disconnecting from Redis:',
                                disconnectError,
                              );
                            }
                          }
                        }
                      }
                    }
                  } catch (error) {
                    console.error('Failed to save chat:', error);
                    // Attempt to save partial message on error
                    try {
                      const partialMessage = response.messages.find(
                        (m) => m.role === 'assistant',
                      );
                      if (partialMessage) {
                        console.log(
                          '[ERROR RECOVERY] Attempting to save partial message',
                        );
                        const partialId = generateUUID();
                        await saveMessages({
                          messages: [
                            {
                              id: partialId,
                              chatId: id,
                              role: 'assistant',
                              parts: [
                                {
                                  type: 'text',
                                  text:
                                    (partialMessage as any).content ||
                                    'Error: Message failed to save',
                                },
                              ],
                              attachments: [],
                              createdAt: new Date(),
                              provider: selectedProvider,
                            },
                          ],
                        });
                        console.log(
                          '[ERROR RECOVERY] Partial message saved successfully',
                        );
                      }
                    } catch (recoveryError) {
                      console.error(
                        '[ERROR RECOVERY] Failed to save partial message:',
                        recoveryError,
                      );
                    }
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
              writer.merge(result.toUIMessageStream());
            } catch (streamError) {
              console.error('RAG ERROR: Error processing stream:', streamError);
              // Clear timeout on stream error
              if (responseTimeout) clearTimeout(responseTimeout);
              // Propagate error to user via dataStream
              writer.write({
                type: 'error',
                errorText: 'Stream processing error occurred',
              });
            } finally {
              // Ensure timeout is always cleared
              if (responseTimeout) clearTimeout(responseTimeout);
            }
          } catch (error) {
            console.error('Fatal error in stream processing:', error);
            if (responseTimeout) clearTimeout(responseTimeout);
            // Notify user of error via dataStream
            writer.write({
              type: 'error',
              errorText: 'Fatal error in chat processing',
            });
          }
      },
      onError: (error) => {
        console.error('Error in data stream:', error);
        return 'Oops, an error occurred while processing your request!';
      },
    });

    // Special case - cautious handling for "remember"
    if (queryText.toLowerCase().includes('remember') && queryText.length > 15) {
      try {
        const { generateObject } = await import('ai');
        const { z } = await import('zod');
        const schema = z.object({
          shouldSave: z.boolean(),
          summary: z.string().optional(),
          memoryType: z
            .enum([
              'preference',
              'profile',
              'company',
              'task',
              'knowledge',
              'personal',
              'other',
            ])
            .optional(),
          confidence: z.number().min(0).max(100).optional(),
        });
        const result = await generateObject({
          model: (await import('@ai-sdk/openai')).openai('gpt-5-mini'),
          schema,
          system:
            'Decide if the user is asking to store a useful long-term memory. Prefer not saving unless it is a clear, stable preference, profile fact, company detail, or reusable knowledge. Return conservative confidence.',
          prompt: `User message: ${queryText}\nRespond with fields.`,
        });
        const {
          shouldSave,
          summary,
          memoryType,
          confidence = 60,
        } = result.object as any;
        if (shouldSave && confidence >= 60) {
          const contentToRemember = queryText.trim();
          const title = `User Note: ${summary || contentToRemember.substring(0, 30)}${contentToRemember.length > 30 ? '...' : ''}`;
          await addResourceTool.execute(
            { title, content: contentToRemember },
            session.user.id,
          );
          console.log('RAG: Saved classified memory');
        } else {
          console.log('RAG: Skipping auto-save based on classifier');
        }
      } catch (saveError) {
        console.error('RAG: Error in cautious remember flow:', saveError);
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
        // AI SDK 5: Stream type is now UIMessageChunk, cast to any for resumable-stream compatibility
        const streamPromise = streamContext.resumableStream(streamId, () => {
          console.log(
            '[NEXUS MODE] Stream factory function called for streamId:',
            streamId,
          );

          // Return the original response stream - it already has nexus handling
          return responseStream as unknown as ReadableStream<string>;
        });

        // Create a timeout promise with longer duration for nexus searches
        let timeoutId: NodeJS.Timeout | null = null;
        const timeoutPromise = new Promise<null>((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(new Error('Nexus resumable stream creation timed out'));
          }, 20000); // 20 second timeout for nexus mode
        });

        // Race the stream creation against the timeout
        const resumableStream = await Promise.race([
          streamPromise.finally(() => {
            // Clean up timeout if stream resolves first
            if (timeoutId) {
              clearTimeout(timeoutId);
              timeoutId = null;
            }
          }),
          timeoutPromise.finally(() => {
            // Clean up timeout if timeout resolves first
            if (timeoutId) {
              clearTimeout(timeoutId);
              timeoutId = null;
            }
          }),
        ]).catch((error) => {
          // Ensure timeout is cleared on error
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }
          console.error(
            `[NEXUS MODE] Resumable stream error or timeout: ${error}`,
          );
          console.log('[NEXUS MODE] Falling back to direct response stream');
          return responseStream as unknown as ReadableStream<string>;
        });

        // AI SDK 5: Resumable streams use incompatible protocol (text/v1 vs UIMessage)
        // Always use createUIMessageStreamResponse for proper streaming
        console.log('[NEXUS MODE] Using direct UI message stream response');
        return createUIMessageStreamResponse({ stream: responseStream });
      } catch (streamError) {
        console.error(
          `[NEXUS MODE] Error with resumable stream: ${streamError}`,
        );
        console.log('[NEXUS MODE] Falling back to direct response stream');
        // AI SDK 5: Use createUIMessageStreamResponse for proper streaming
        return createUIMessageStreamResponse({ stream: responseStream });
      }
    }

    // AI SDK 5: Bypass resumable streams - they use incompatible text/v1 protocol
    // TODO: Update resumable-stream integration for AI SDK 5 UIMessage protocol
    else {
      console.log('Using direct UI message stream response (AI SDK 5)');
      // AI SDK 5: Use createUIMessageStreamResponse for proper streaming
      return createUIMessageStreamResponse({ stream: responseStream });
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

  // Allow admin users to access any chat
  const isAdminUser = isAdminEmail(session.user.email);

  if (
    chat.visibility === 'private' &&
    chat.userId !== session.user.id &&
    !isAdminUser
  ) {
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
    let redis: any = null;
    try {
      const { createClient } = await import('redis');
      redis = createClient({ url: redisUrl });
      await redis.connect();

      // Check for nexus metadata
      const nexusMetadata = await redis.get(`nexus:${recentStreamId}:metadata`);

      if (nexusMetadata) {
        console.log(
          `[NEXUS MODE] Found nexus metadata for stream ${recentStreamId}`,
        );
        let metadata: any;
        try {
          metadata = JSON.parse(nexusMetadata);

          // Log recovery information
          console.log('[NEXUS MODE] Stream recovery:', {
            streamId: recentStreamId,
            status: metadata.status,
            query: metadata.query,
            startTime: metadata.startTime,
            age: Date.now() - metadata.startTime,
          });
        } catch (parseError) {
          console.error(
            '[NEXUS MODE] Failed to parse metadata JSON:',
            parseError,
          );
        }
      }
    } catch (redisError) {
      console.error(
        '[NEXUS MODE] Failed to check stream metadata:',
        redisError,
      );
      // Continue without metadata
    } finally {
      // Ensure Redis connection is always closed
      if (redis) {
        try {
          await redis.disconnect();
        } catch (disconnectError) {
          console.error(
            '[NEXUS MODE] Error disconnecting from Redis:',
            disconnectError,
          );
        }
      }
    }
  }

  // AI SDK 5: Stream resumption via Redis uses incompatible protocol
  // Return 204 to signal client that resumption is not available
  // TODO: Implement AI SDK 5 compatible stream resumption
  console.log(`Stream resumption not available for ${recentStreamId} (AI SDK 5 migration)`);
  return new Response(null, { status: 204 });
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
