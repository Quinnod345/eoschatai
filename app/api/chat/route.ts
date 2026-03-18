import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
  tool,
  generateText,
  type UIMessage,
  stepCountIs,
  convertToModelMessages,
} from 'ai';
import { auth } from '@/app/(auth)/auth';
import { withErrorHandler, handleApiError } from '@/lib/errors/api-wrapper';
import { isAdminEmail } from '@/lib/auth/admin';
import {
  type RequestHints,
  systemPrompt,
  nexusResearcherPrompt,
} from '@/lib/ai/prompts';
import {
  createStreamId,
  deleteChatById,
  getChatById,
  getRecentMessagesByChatId,
  saveChat,
  saveMessages,
  markStreamCompleted,
  markStreamErrored,
  updateStreamLastActive,
} from '@/lib/db/queries';
import { StreamBufferService } from '@/lib/stream/buffer-service';
import { generateUUID } from '@/lib/utils';
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
  generateEmbedding,
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
import {
  buildCalendarPromptAdditions,
  dedupeMessagesById,
  extractAssistantTextFromMessage,
  extractPrimaryMessageText,
} from '@/lib/ai/chat-route-helpers';
import type { RelevantMemory } from '@/lib/ai/memory-rag';
// Citation formatting - citations now handled inline by the AI through searchWeb tool

export const maxDuration = 300; // 5 minutes - deep research mode needs extended time

let globalStreamContext: ResumableStreamContext | null = null;

function getStreamContext() {
  if (!globalStreamContext) {
    try {
      // Get REDIS_URL from environment and clean it (remove quotes if present)
      const redisUrl = process.env.REDIS_URL;
      console.log('Redis URL configured for resumable streams:', !!redisUrl);

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
          '[Chat Route] Invalid REDIS_URL format (expected redis:// or rediss://)',
        );
        return null;
      }

      console.log('Creating resumable stream context');

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

// Lightweight preflight to pick model and suggest a token budget using Claude Haiku
async function decideModelWithHaiku(args: {
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
  enableThinking: boolean;
  maxOutputTokens: number;
  thinkingBudget?: number;
  requiresDocumentCreation: boolean;
  suggestedDocumentKind: string | null;
  saveMemory: boolean;
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
  console.log('[PREFLIGHT] Starting Haiku preflight', {
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
    model: provider.languageModel('preflight-model'),
    system: `You are a token allocation grader. Decide the optimal Claude model configuration and output token budget ONLY from the task text and context below.

EXTENDED THINKING DECISION (enable_thinking: true/false):
Extended thinking makes Claude reason more deeply before responding. Enable it for complex tasks.

ENABLE THINKING (enable_thinking: true) for:
- Deep analysis, comprehensive summaries, multi-faceted analysis
- Literary/rhetorical analysis, "find what's hidden", critical analysis
- Weakness identification, audience analysis, detailed documentation
- Research tasks, any request asking for both summary AND analysis
- "deep analysis", "comprehensive", "thorough", "detailed analysis"
- "find hidden", "beneath the surface", "relate everything", "central point"
- "rhetorical situation", "audience analysis", "critical analysis"
- "pick apart", "weak points", "critique", "evaluate"
- Multiple analysis dimensions requested
- Academic or scholarly analysis requests
- Requests with specific formatting requirements for analysis
- Any file uploads (PDFs, documents, images)
- Multiple file uploads (2+ files)
- Large documents (10+ pages)
- Analysis of uploaded content
- Character count > 10000
- Complex multi-step reasoning

DISABLE THINKING (enable_thinking: false) for:
- Simple explanations, basic tutorials, straightforward code
- Simple troubleshooting, brief summaries
- Quick questions, casual conversation
- Character count < 5000 with no complexity signals

THINKING BUDGET (when enable_thinking is true - be very generous, deeper thinking = better results):
- Use 16000 for: moderate complexity queries, summaries, standard analysis
- Use 32000 for: multi-step reasoning, critique, comparative analysis, complex code review
- Use 50000 for: extreme complexity, multi-faceted analysis, research synthesis
- Use 64000 for: hidden insight discovery, academic rigor, philosophical analysis, strategic planning

TOKEN BUDGET TIERS (Claude supports very long outputs - be generous):
- Minimal: 1000–2000 (simple questions)
- Light: 2000–4000 (basic explanations)
- Standard: 4000–8000 (typical responses)
- Comprehensive: 8000–16000 (detailed explanations, analysis)
- Extensive: 16000–32000 (research, documentation)
- Massive: 32000–64000 (comprehensive reports, long documents)

TOKEN BUDGET ADJUSTMENTS (Claude is very capable - lean toward higher values):
- File uploads: +100% minimum
- Long input (>10k chars): +50% minimum
- Very long input (>20k chars): +100% minimum
- Code/programming: +50% tokens baseline
- Math/derivations: +50% tokens baseline
- Literary/rhetorical analysis: +60% tokens baseline
- Multiple adjustments stack

DOCUMENT EDITING TRIGGERS (use high token budgets):
- "expand", "add more", "elaborate", "add detail", "add examples"
- "edit the document", "update the document", "revise", "rewrite"
- "add transitions", "improve", "enhance", "make it better"
- Document editing requires 8000–16000 tokens minimum for substantial edits
- When composer_open is true, assume document editing context and use at least 8000 tokens

INTELLIGENCE SIGNALS:
- Major token increase for: "deep", "comprehensive", "thorough", "in-depth", "analysis", multi-part requests, academic analysis, literary criticism.
- Moderate increase for: examples, comparisons, strategies, step-by-step.
- File processing requires both intelligence and tokens for thorough analysis.

MODE CONTEXT:
- mode: ${mode}
- composer_open: ${hasComposerOpen}
If mode is nexus, use high budgets (16000+). If composer_open is true, allocate AT LEAST 8000 tokens for document editing tasks.

DOCUMENT CREATION DETECTION (requires_document_creation: true/false):
Set to true when the user is EXPLICITLY asking to create, build, generate, draft, or make a document, artifact, template, chart, spreadsheet, V/TO, accountability chart, scorecard, or any structured content output.
Set to false for questions, explanations, discussions, or edits to existing documents.
When true, also set suggested_document_kind to one of: "text", "code", "image", "sheet", "chart", "vto", "accountability".
When false, suggested_document_kind should be null.

MEMORY EXTRACTION DETECTION (save_memory: true/false):
Set to true when the user's message contains ANY personal information, preferences, facts, or details worth remembering for future conversations. Be VERY liberal here — even short statements are valuable.

SAVE MEMORY (save_memory: true) for:
- Likes/dislikes/preferences: "I like X", "I prefer Y", "I hate Z", "my favorite is..."
- Personal facts: "I have 2 dogs", "I'm from Texas", "I'm 30 years old"
- Company/work info: "We use Slack", "my team has 10 people", "I'm a PM"
- Goals/challenges: "I want to lose weight", "we're growing fast"
- Opinions/values: "I think X is important", "I believe in Y"
- Names/relationships: "my wife Sarah", "my boss John", "my company is Acme"
- Habits/routines: "I wake up at 6am", "I exercise daily"
- Any statement revealing something about WHO the user IS or WHAT they care about

DO NOT SAVE MEMORY (save_memory: false) for:
- Pure questions with no personal info ("What is EOS?", "How do I make a chart?")
- Commands/instructions ("Create a V/TO", "Summarize this document")
- Greetings with no content ("hi", "thanks", "ok")
- Requests that only reference external information, not about the user

Return STRICT JSON: {"enable_thinking":true|false,"max_tokens":<integer 1000..64000>,"thinking_budget":<integer 0|16000|32000|50000|64000>,"requires_document_creation":true|false,"suggested_document_kind":<string|null>,"save_memory":true|false}.
If enable_thinking is false, thinking_budget should be 0.
If enable_thinking is true, choose appropriate thinking_budget based on complexity.
If requires_document_creation is true, suggested_document_kind must be one of: text, code, image, sheet, chart, vto, accountability.
If requires_document_creation is false, suggested_document_kind must be null. No commentary.`,
    prompt: `task: ${queryText}\ncode_or_math: ${hasCodeOrMath}\ndeep_analysis_detected: ${hasDeepAnalysis}\nhas_file_uploads: ${hasFileUploads}\nfile_upload_count: ${fileUploadCount}\ninput_character_count: ${inputCharacterCount}\ncomposer_open: ${hasComposerOpen}`,
    maxOutputTokens: 256,
    temperature: 0,
  });

  const cleaned = text.trim().replace(/^```json\s*|\s*```$/g, '');
  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch (parseError) {
    // Haiku sometimes appends a natural-language explanation after the JSON.
    // Extract the first top-level {...} block and retry.
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        parsed = JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
      } catch {
        console.error('[PREFLIGHT] Failed to parse Haiku response:', cleaned);
        throw new Error('Haiku preflight returned invalid JSON');
      }
    } else {
      console.error('[PREFLIGHT] Failed to parse Haiku response:', cleaned);
      throw new Error('Haiku preflight returned invalid JSON');
    }
  }

  const enableThinking = parsed.enable_thinking === true;
  const maxTokens = Number(parsed.max_tokens);
  // Normalize thinking_budget to one of: 16000 | 32000 | 50000 | 64000. Default to 32000 if invalid.
  const rawBudget = Number(parsed.thinking_budget);
  const allowedBudgets = new Set([16000, 32000, 50000, 64000]);
  const thinkingBudget: number = allowedBudgets.has(rawBudget)
    ? rawBudget
    : 32000;

  if (!Number.isFinite(maxTokens)) {
    throw new Error('Haiku preflight returned invalid max_tokens');
  }

  const validDocumentKinds = new Set([
    'text',
    'code',
    'image',
    'sheet',
    'chart',
    'vto',
    'accountability',
  ]);
  const requiresDocumentCreation = parsed.requires_document_creation === true;
  const suggestedDocumentKind =
    requiresDocumentCreation &&
    parsed.suggested_document_kind &&
    validDocumentKinds.has(String(parsed.suggested_document_kind))
      ? String(parsed.suggested_document_kind)
      : null;

  // If the model omits save_memory (older response format), fall back to a
  // quick heuristic: any first-person statement or short personal message
  // is likely memory-worthy.
  const saveMemory =
    parsed.save_memory === true ||
    (parsed.save_memory === undefined &&
      /\b(i |my |i'm |i've |i'll |we |our |prefer|like|love|hate|favorite|use |enjoy)\b/i.test(
        queryText,
      ));

  console.log('[PREFLIGHT] Decision', {
    enableThinking,
    maxOutputTokens: maxTokens,
    thinkingBudget: enableThinking ? thinkingBudget : 0,
    requiresDocumentCreation,
    suggestedDocumentKind,
    saveMemory,
  });
  return {
    enableThinking,
    maxOutputTokens: Math.max(200, Math.floor(maxTokens)),
    thinkingBudget: enableThinking ? thinkingBudget : undefined,
    requiresDocumentCreation,
    suggestedDocumentKind,
    saveMemory,
  };
}

export async function POST(request: Request) {
  let requestBody: PostRequestBody;
  let rawBody: unknown;

  try {
    rawBody = await request.json();
  } catch (error) {
    if (error instanceof SyntaxError) {
      console.error('[CHAT] Malformed JSON request body:', error.message);
    } else {
      console.error('[CHAT] Failed to parse request body:', error);
    }
    return new Response('Invalid request body', { status: 400 });
  }

  try {
    requestBody = postRequestBodySchema.parse(rawBody);
  } catch (error) {
    console.error('[CHAT] Request body validation failed:', error);
    if (error && typeof error === 'object' && 'issues' in error) {
      console.error(
        '[CHAT] Validation issues:',
        JSON.stringify((error as any).issues, null, 2),
      );
    }
    return new Response('Invalid request body', { status: 400 });
  }

  try {
    let {
      id,
      message,
      selectedChatModel,
      selectedVisibilityType,
      selectedProvider = 'anthropic',
      selectedPersonaId,
      selectedProfileId,
      selectedResearchMode,
      composerDocumentId,
    } = requestBody;
    let personaFallbackApplied = false;

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
      selectedPersonaId &&
      !accessContext.entitlements.features.personas.custom
    ) {
      console.warn(
        '[CHAT] Free plan persona selection blocked, falling back to default assistant',
        {
          userId: session.user.id,
          selectedPersonaId,
        },
      );
      personaFallbackApplied = true;
      selectedPersonaId = undefined;
      selectedProfileId = undefined;
    }

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
          message: message as UIMessage,
        });
      } catch (titleError) {
        console.error('Title generation failed, using fallback:', titleError);
        // Extract text from message for fallback title
        const messageText = extractPrimaryMessageText(message);
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
    const normalizedPreviousMessages = previousMessages.map(
      (dbMessage, index) => {
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
        const existingParts = Array.isArray(dbMessage.parts)
          ? dbMessage.parts
          : [];

        const baseMessage = {
          ...dbMessage,
          parts: [...existingParts, ...attachmentParts],
        };

        // Apply v4 → v5 conversion for any legacy parts
        return convertV4MessageToV5(baseMessage as any, index);
      },
    );

    // Retry safety: if the current user message already exists in history, drop it
    // before appending the client message again.
    const dedupedPreviousMessages = dedupeMessagesById(
      normalizedPreviousMessages,
      message.id,
    );

    // Manually append client message (appendClientMessage was removed in AI SDK 5)
    const messages = [...dedupedPreviousMessages, message] as UIMessage[];

    // Extract user text for RAG context retrieval
    const firstPart = message.parts?.[0];
    const queryText = extractPrimaryMessageText(message);
    console.log('RAG: Processing chat request with query:', queryText);
    console.log('RAG: Message structure:', {
      messageId: message.id,
      messageRole: message.role,
      messageContent: message.content,
      messageParts: message.parts,
      partsLength: message.parts?.length,
      firstPartType: typeof firstPart,
      firstPartValue: firstPart,
    });

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

    // Fetch actual content for @mentioned composer documents.
    // MentionProcessor only has the ID from the regex parse — no DB content yet.
    if (mentionResult.composerMentions && mentionResult.composerMentions.length > 0) {
      const { getDocumentById } = await import('@/lib/db/queries');
      await Promise.all(
        mentionResult.composerMentions.map(async (cm) => {
          if (!cm.content && cm.composerId) {
            try {
              const doc = await getDocumentById({ id: cm.composerId });
              if (doc) {
                cm.content = doc.content?.trim() ?? '';
                cm.title = doc.title ?? cm.title;
              }
            } catch {
              // Non-fatal — mention hint still provides ID
            }
          }
        }),
      );
    }

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

    // Legacy compatibility flags — check allMentions (explicit + implicit) for complete coverage
    const hasMentionedCalendar = allMentions.some((m) =>
      ['calendar', 'event', 'meeting'].includes(m.type),
    );
    const hasMentionedDocument = allMentions.some((m) =>
      ['document', 'file'].includes(m.type),
    );
    const hasMentionedScorecard = allMentions.some(
      (m) => m.type === 'scorecard',
    );
    const hasMentionedVTO = allMentions.some((m) => m.type === 'vto');
    const hasMentionedRocks = allMentions.some((m) => m.type === 'rocks');
    const hasMentionedPeople = allMentions.some((m) =>
      ['user', 'team', 'contact'].includes(m.type),
    );
    const hasMentionedAccountability = allMentions.some(
      (m) => m.type === 'accountability',
    );

    // Execute RAG operations AND preflight in parallel for maximum performance.
    // The preflight (Haiku model decision) only needs queryText and simple flags,
    // so it can run at the same time as embedding generation + RAG retrieval.
    console.log('RAG: Starting parallel RAG operations + preflight...');
    const ragStartTime = Date.now();

    // Store document IDs for context tracking
    let userDocumentIds: string[] = [];
    let userDocumentNames: string[] = [];
    let orgDocumentIds: string[] = [];
    let orgDocumentNames: string[] = [];

    // Skip RAG for very short or generic queries (<= 12 chars)
    // These queries like "hi", "ok", "yes", "mary antin" are too generic and match everything
    const shouldSkipRAG = !queryText || queryText.trim().length <= 3;
    if (shouldSkipRAG) {
      console.log(
        `RAG: Skipping RAG for short/generic query (${queryText?.length || 0} chars)`,
      );
    }

    // Preflight detection flags (computed from queryText only - no RAG dependency)
    const hasCodeOrMath =
      /```|\b(code|implement|function|class|SQL|regex|equation|integral|proof|derive|theorem)\b/i.test(
        queryText || '',
      );
    const hasDeepAnalysis =
      /\b(deep analysis|comprehensive|thorough|detailed analysis|find.*hidden|beneath.*surface|relate everything|central point|rhetorical situation|audience analysis|critical analysis|pick apart|weak points|critique|evaluate)\b/i.test(
        queryText || '',
      ) ||
      (queryText?.toLowerCase().includes('summary') &&
        queryText?.toLowerCase().includes('analysis'));
    const isNexusMode = selectedResearchMode === 'nexus';

    // Fire preflight Haiku call NOW so it runs in parallel with embedding + RAG.
    const providerForDecision = createCustomProvider(selectedProvider);
    const preflightPromise = decideModelWithHaiku({
      provider: providerForDecision,
      queryText: queryText || '',
      hasCodeOrMath,
      hasDeepAnalysis: hasDeepAnalysis || isNexusMode,
      hasFileUploads,
      fileUploadCount,
      inputCharacterCount: (queryText || '').length,
      mode: isNexusMode ? 'nexus' : 'standard',
      hasComposerOpen: Boolean(composerDocumentId),
    }).catch((err) => {
      console.warn('Preflight decision failed, falling back to defaults', err);
      return null; // null signals fallback
    });

    // Generate query embedding once and reuse it across all RAG branches.
    const queryEmbedding =
      !shouldSkipRAG && ragQueryText
        ? await generateEmbedding(ragQueryText)
        : null;

    const [
      relevantContent,
      userRagResult,
      orgRagResult,
      personaRagResult,
      systemRagResult,
      memoryResult,
    ] = await Promise.all([
      // General RAG (Knowledge Base) - Company RAG
      queryText && !shouldSkipRAG
        ? (() => {
            const generalRagStart = Date.now();
            return findRelevantContent(
              ragQueryText,
              5,
              0.6,
              queryEmbedding ?? undefined,
            )
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
                getUserRagContextWithMetadata(
                  session.user.id,
                  ragQueryText,
                  queryEmbedding ?? undefined,
                ),
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
                return { context: '', documentIds: [], documentNames: [], chunkCount: 0 };
              });
          })()
        : Promise.resolve({ context: '', documentIds: [], documentNames: [], chunkCount: 0 }),

      // Organization RAG (Org Knowledge Base)
      accessContext.user.orgId && queryText && !shouldSkipRAG
        ? (() => {
            const orgRagStart = Date.now();
            return import('@/lib/ai/org-rag-context')
              .then(({ getOrgRagContextWithMetadata }) =>
                getOrgRagContextWithMetadata(
                  accessContext.user.orgId as string,
                  ragQueryText,
                  queryEmbedding ?? undefined,
                ),
              )
              .then((result) => {
                const orgRagTime = Date.now() - orgRagStart;
                console.log(
                  `Org RAG: Generated context with ${result.context.length} characters from ${result.documentIds.length} documents in ${orgRagTime}ms`,
                );
                orgDocumentIds = result.documentIds;
                orgDocumentNames = result.documentNames;
                return result;
              })
              .catch((error) => {
                const orgRagTime = Date.now() - orgRagStart;
                console.error(
                  `Org RAG: Error getting org RAG context after ${orgRagTime}ms:`,
                  error,
                );
                return {
                  context: '',
                  documentIds: [],
                  documentNames: [],
                  chunkCount: 0,
                };
              });
          })()
        : Promise.resolve({ context: '', documentIds: [], documentNames: [], chunkCount: 0 }),

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
                  queryEmbedding ?? undefined,
                ),
              )
              .then((result) => {
                const personaRagTime = Date.now() - personaRagStart;
                console.log(
                  `Persona RAG: Generated context with ${result.context.length} characters in ${personaRagTime}ms`,
                );

                // Debug: Log first 200 characters of persona RAG context
                if (result.context.length > 0) {
                  console.log(
                    `Persona RAG: Context preview: ${result.context.substring(0, 200)}...`,
                  );
                }
                return result;
              })
              .catch((error) => {
                const personaRagTime = Date.now() - personaRagStart;
                console.error(
                  `Persona RAG: Error getting persona RAG context after ${personaRagTime}ms:`,
                  error,
                );
                return { context: '', chunkCount: 0 };
              });
          })()
        : Promise.resolve({ context: '', chunkCount: 0 }),

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
                    queryEmbedding ?? undefined,
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
                  // Estimate chunk count from formatted text (Upstash returns plain string)
                  const upstashChunkCount = context ? (context.match(/\[\d+\]/g) || []).length : 0;
                  return { context, chunkCount: upstashChunkCount };
                })
                .catch((error) => {
                  const systemRagTime = Date.now() - systemRagStart;
                  console.error(
                    `Upstash System RAG: Error getting system RAG context after ${systemRagTime}ms:`,
                    error,
                  );
                  return { context: '', chunkCount: 0 };
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
                  return { context: '', chunkCount: 0 };
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
                  queryEmbedding ?? undefined,
                );
              })
              .then((result) => {
                const systemRagTime = Date.now() - systemRagStart;
                const ctx = typeof result === 'string' ? result : result.context;
                const count = typeof result === 'string' ? 0 : result.chunkCount;
                console.log(
                  `System RAG: Generated context with ${ctx.length} characters in ${systemRagTime}ms`,
                );

                // Debug: Log first 200 characters of system RAG context
                if (ctx.length > 0) {
                  console.log(
                    `System RAG: Context preview: ${ctx.substring(0, 200)}...`,
                  );
                }
                return { context: ctx, chunkCount: count };
              })
              .catch((error) => {
                const systemRagTime = Date.now() - systemRagStart;
                console.error(
                  `System RAG: Error getting system RAG context after ${systemRagTime}ms:`,
                  error,
                );
                return { context: '', chunkCount: 0 };
              });
          })()
        : Promise.resolve({ context: '', chunkCount: 0 }),

      // Memory RAG (User Memories) — similarity-based + recency-based, merged and deduplicated
      session.user.id && queryText && !shouldSkipRAG
        ? (() => {
            const memoryRagStart = Date.now();
            console.log(
              `Memory RAG: Starting retrieval for user ${session.user.id} with query: "${queryText}"`,
            );

            return import('@/lib/ai/memory-rag')
              .then(
                ({
                  findRelevantMemories,
                  getRecentMemories,
                  formatMemoriesForPrompt,
                }) =>
                  Promise.all([
                    findRelevantMemories(
                      session.user.id,
                      ragQueryText,
                      15, // Increased from 10
                      0.35, // Low threshold: memory embeddings are still ada-002, queries are 3-small
                      queryEmbedding ?? undefined,
                    ),
                    getRecentMemories(session.user.id, 5),
                  ]).then(([similarMemories, recentMemories]) => {
                    // Merge and deduplicate by memory ID
                    const seenIds = new Set<string>();
                    const merged: RelevantMemory[] = [];
                    for (const m of similarMemories) {
                      if (!seenIds.has(m.id)) {
                        seenIds.add(m.id);
                        merged.push(m);
                      }
                    }
                    for (const m of recentMemories) {
                      if (!seenIds.has(m.id)) {
                        seenIds.add(m.id);
                        merged.push(m);
                      }
                    }

                    const semanticMemoryIds = Array.from(
                      new Set(similarMemories.map((memory) => memory.id)),
                    );
                    const recentMemoryIds = Array.from(
                      new Set(recentMemories.map((memory) => memory.id)),
                    );
                    const semanticIdSet = new Set(semanticMemoryIds);
                    const overlappingMemoryIds = recentMemoryIds.filter((id) =>
                      semanticIdSet.has(id),
                    );
                    const unembeddedRetrievedCount = similarMemories.filter(
                      (memory) => memory.retrievalSource === 'unembedded',
                    ).length;

                    const memoryRagTime = Date.now() - memoryRagStart;
                    console.log(
                      `Memory RAG: Retrieved ${merged.length} unique memories (semantic: ${semanticMemoryIds.length}, recent: ${recentMemoryIds.length}, overlap: ${overlappingMemoryIds.length}, unembedded: ${unembeddedRetrievedCount}) in ${memoryRagTime}ms`,
                    );

                    const topSemanticMemory = merged.find(
                      (memory) =>
                        memory.retrievalSource === 'semantic' ||
                        memory.retrievalSource === 'semantic-fallback',
                    );

                    if (
                      topSemanticMemory &&
                      typeof topSemanticMemory.similarity === 'number'
                    ) {
                      console.log(
                        `Memory RAG: Top semantic memory: "${topSemanticMemory.summary.substring(0, 100)}..." (similarity: ${(topSemanticMemory.similarity * 100).toFixed(1)}%, combined: ${(topSemanticMemory.relevance * 100).toFixed(1)}%)`,
                      );
                    } else if (merged.length > 0) {
                      console.log(
                        `Memory RAG: Top context memory (non-semantic): "${merged[0].summary.substring(0, 100)}..." (source: ${merged[0].retrievalSource})`,
                      );
                    }

                    // Format memories into prompt
                    const memoryFormatResult =
                      formatMemoriesForPrompt(merged);

                    if (memoryFormatResult.formatted.length > 0) {
                      console.log(
                        `Memory RAG: Formatted context with ${memoryFormatResult.formatted.length} characters`,
                      );
                    }

                    return {
                      ...memoryFormatResult,
                      semanticMemoryIds,
                      recentMemoryIds,
                      overlappingMemoryIds,
                      memorySourceCounts: {
                        semantic: semanticMemoryIds.length,
                        recent: recentMemoryIds.length,
                        overlap: overlappingMemoryIds.length,
                        unique: memoryFormatResult.chunkCount,
                        unembedded: unembeddedRetrievedCount,
                      },
                    };
                  }),
              )
              .catch((error) => {
                const memoryRagTime = Date.now() - memoryRagStart;
                console.error(
                  `Memory RAG: Error retrieving memories after ${memoryRagTime}ms:`,
                  error,
                );
                return {
                  formatted: '',
                  chunkCount: 0,
                  memoryIds: [],
                  sourceCounts: { semantic: 0, recent: 0, unembedded: 0 },
                  semanticMemoryIds: [],
                  recentMemoryIds: [],
                  overlappingMemoryIds: [],
                  memorySourceCounts: {
                    semantic: 0,
                    recent: 0,
                    overlap: 0,
                    unique: 0,
                    unembedded: 0,
                  },
                };
              });
          })()
        : Promise.resolve({
            formatted: '',
            chunkCount: 0,
            memoryIds: [],
            sourceCounts: { semantic: 0, recent: 0, unembedded: 0 },
            semanticMemoryIds: [],
            recentMemoryIds: [],
            overlappingMemoryIds: [],
            memorySourceCounts: {
              semantic: 0,
              recent: 0,
              overlap: 0,
              unique: 0,
              unembedded: 0,
            },
          }),
    ]);

    // Extract context strings from structured results
    const userRagContext =
      typeof userRagResult === 'string' ? userRagResult : userRagResult.context;
    const orgRagContext =
      typeof orgRagResult === 'string' ? orgRagResult : orgRagResult.context;
    const personaRagContext = personaRagResult.context;
    const systemRagContext = systemRagResult.context;
    const memoryContext = memoryResult.formatted;
    const memoryIds = memoryResult.memoryIds ?? [];
    const semanticMemoryIds = memoryResult.semanticMemoryIds ?? [];
    const recentMemoryIds = memoryResult.recentMemoryIds ?? [];
    const overlappingMemoryIds = memoryResult.overlappingMemoryIds ?? [];
    const memorySourceCounts = memoryResult.memorySourceCounts ?? {
      semantic: 0,
      recent: 0,
      overlap: 0,
      unique: memoryResult.chunkCount ?? 0,
      unembedded: 0,
    };

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
        `\n  - Organization knowledge: ${orgRagContext.length} characters (${orgDocumentIds.length} docs: ${orgDocumentNames.join(', ')})`,
        `\n  - Persona documents: ${personaRagContext.length} characters`,
        `\n  - System knowledge: ${systemRagContext.length} characters`,
        `\n  - User memories: ${memoryContext.length} characters (${memorySourceCounts.unique} unique; semantic: ${memorySourceCounts.semantic}, recent: ${memorySourceCounts.recent}, overlap: ${memorySourceCounts.overlap}, unembedded: ${memorySourceCounts.unembedded})`,
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
    const fileParts = (message.parts || []).filter(
      (part: any) => part.type === 'file',
    );
    const nonFileParts = (message.parts || []).filter(
      (part: any) => part.type !== 'file',
    );
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
          stoppedAt: null,
          reasoning: null, // User messages don't have reasoning
        },
      ],
    });

    const streamId = generateUUID();

    // Initialize stream buffer service for resumable streams
    const streamBuffer = new StreamBufferService(streamId);
    let streamBufferInitialized = false;

    // Create stream ID with enhanced state tracking
    try {
      await createStreamId({
        streamId,
        chatId: id,
        messageId: undefined, // Will be set when assistant message is created
        composerDocumentId: composerDocumentId || undefined,
        metadata: {
          researchMode: selectedResearchMode,
        },
      });

      // Initialize Redis buffer for chunk storage
      if (streamBuffer.isAvailable()) {
        streamBufferInitialized = await streamBuffer.initializeStream({
          chatId: id,
          composerDocumentId: composerDocumentId || undefined,
          metadata: {
            researchMode: selectedResearchMode,
          },
        });
        console.log(
          `[Stream] Buffer initialized: ${streamBufferInitialized}, streamId: ${streamId}`,
        );
      }
    } catch (error) {
      console.error('Failed to create stream ID:', error);
      // Continue without stream ID - chat will still work
    }

    // Create a provider based on selected provider
    const provider = createCustomProvider(selectedProvider);

    // Get the system prompt with both general RAG and user RAG context
    const fullSystemPrompt = await systemPrompt({
      selectedProvider,
      requestHints,
      ragContext: relevantContent, // General knowledge base RAG
      userRagContext: userRagContext, // User-specific document context
      orgRagContext: orgRagContext, // Organization-level shared knowledge context
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

    // Define token guidance settings early (isNexusMode already defined above RAG block)

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

${
  mentionResult.composerMentions && mentionResult.composerMentions.length > 0
    ? `REFERENCED COMPOSER DOCUMENTS:
${mentionResult.composerMentions
  .filter((cm) => cm.content)
  .map(
    (cm) => `### "${cm.title}" (${cm.kind})
${(cm.content ?? '').slice(0, 6000)}${(cm.content ?? '').length > 6000 ? '\n[... content truncated ...]' : ''}`,
  )
  .join('\n\n---\n\n')}

When the user refers to these documents, use the content above. Use updateDocument to edit them.`
    : ''
}

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
      hasMentionedPeople ||
      hasMentionedAccountability
    ) {
      try {
        console.log('Documents: Processing document-related @ mentions');

        const documentTypes = {
          document: hasMentionedDocument,
          scorecard: hasMentionedScorecard,
          vto: hasMentionedVTO,
          rocks: hasMentionedRocks,
          people: hasMentionedPeople,
          accountability: hasMentionedAccountability,
        };

        const mentionedTypes = Object.entries(documentTypes)
          .filter(([_, mentioned]) => mentioned)
          .map(([type]) => type);

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

${
  hasMentionedAccountability
    ? `
ACCOUNTABILITY CHART MENTION:
- Focus on the user's Accountability Chart content
- Reference the structure of their Leadership Team, seats, and roles
- Discuss who is in the Visionary vs Integrator seat if available
- Highlight any open seats, GWC gaps, or structural issues
- Connect to EOS best practices for the Accountability Chart
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

    // Pre-fetch calendar context before streaming so prompt content is deterministic.
    // This avoids late async mutations to the system prompt after model execution starts.
    if (hasMentionedCalendar || (shouldCheckCalendar && eventType)) {
      const calendarPromptAdditions = await buildCalendarPromptAdditions({
        hasMentionedCalendar,
        shouldCheckCalendar,
        eventType,
        fetchCalendarEvents: (params) =>
          getCalendarEventsTool.execute(params, session.user.id) as any,
        logger: console,
      });

      if (calendarPromptAdditions) {
        enhancedSystemPrompt += calendarPromptAdditions;
      }
    }

    // Create response stream
    // AI SDK 5: Provide originalMessages and generateId to prevent duplicate messages.
    // Pre-generate the assistantId so the client-side message.id matches the ID
    // we save to the database and the contextUsageLog. This is critical for the
    // context-indicator badge to find the log entry without a page reload.
    const assistantId = generateUUID();
    let assistantIdClaimed = false;

    const responseStream = createUIMessageStream({
      originalMessages: dedupedPreviousMessages,
      generateId: () => {
        // Return the pre-generated assistantId for the first message (the main
        // assistant response). Subsequent calls (tool-call steps) get fresh UUIDs.
        if (!assistantIdClaimed) {
          assistantIdClaimed = true;
          return assistantId;
        }
        return generateUUID();
      },
      execute: async ({ writer: originalWriter }) => {
        // Create buffered writer wrapper that also stores chunks to Redis
        let chunkCount = 0;
        let lastActiveUpdate = Date.now();
        const ACTIVE_UPDATE_INTERVAL = 5000; // Update lastActiveAt every 5 seconds

        const writer = {
          write: (chunk: unknown) => {
            // Always forward to original writer
            originalWriter.write(chunk as any);

            // Buffer non-transient chunks to Redis for resumability
            if (streamBufferInitialized && !(chunk as any)?.transient) {
              streamBuffer.appendChunk(chunk).catch((err) => {
                console.error('[Stream] Failed to buffer chunk:', err);
              });
            }

            // Periodically update stream lastActiveAt in database
            chunkCount++;
            const now = Date.now();
            if (now - lastActiveUpdate > ACTIVE_UPDATE_INTERVAL) {
              lastActiveUpdate = now;
              updateStreamLastActive({ streamId }).catch((err) => {
                console.error('[Stream] Failed to update lastActiveAt:', err);
              });
            }
          },
          merge: (inputStream: any) => {
            // For merge operations, we need to intercept and buffer the chunks
            // Note: inputStream may be an AsyncIterable (from toUIMessageStream) or a ReadableStream
            // We need to handle both cases properly
            if (streamBufferInitialized && inputStream) {
              // Check if inputStream is a ReadableStream (has tee method) or AsyncIterable
              if (typeof inputStream.tee === 'function') {
                // ReadableStream path - use tee() to split the stream
                const [forBuffer, forOriginal] = inputStream.tee();

                // Process forBuffer stream in the background to save chunks
                (async () => {
                  try {
                    const reader = forBuffer.getReader();
                    while (true) {
                      const { done, value } = await reader.read();
                      if (done) break;

                      // Buffer the chunk
                      if (value && !value.transient) {
                        await streamBuffer.appendChunk(value);
                      }

                      // Update activity
                      chunkCount++;
                      const now = Date.now();
                      if (now - lastActiveUpdate > ACTIVE_UPDATE_INTERVAL) {
                        lastActiveUpdate = now;
                        updateStreamLastActive({ streamId }).catch(() => {});
                      }
                    }
                  } catch (err) {
                    console.error(
                      '[Stream] Error buffering merged stream:',
                      err,
                    );
                  }
                })();

                // Forward the other tee to the original writer
                originalWriter.merge(forOriginal);
              } else if (
                typeof inputStream[Symbol.asyncIterator] === 'function'
              ) {
                // AsyncIterable path - create a passthrough ReadableStream that buffers while forwarding
                // We can't tee an AsyncIterable, so we wrap it in a ReadableStream that buffers
                const bufferedStream = new ReadableStream({
                  async start(controller) {
                    try {
                      for await (const value of inputStream) {
                        // Buffer the chunk
                        if (value && !value.transient) {
                          await streamBuffer.appendChunk(value);
                        }

                        // Update activity
                        chunkCount++;
                        const now = Date.now();
                        if (now - lastActiveUpdate > ACTIVE_UPDATE_INTERVAL) {
                          lastActiveUpdate = now;
                          updateStreamLastActive({ streamId }).catch(() => {});
                        }

                        // Enqueue to forward to the original writer
                        controller.enqueue(value);
                      }
                      controller.close();
                    } catch (err) {
                      console.error(
                        '[Stream] Error buffering merged async iterable:',
                        err,
                      );
                      controller.error(err);
                    }
                  },
                });

                originalWriter.merge(bufferedStream);
              } else {
                // Unknown stream type, just forward without buffering
                console.warn(
                  '[Stream] Unknown stream type in merge, forwarding without buffering',
                );
                originalWriter.merge(inputStream);
              }
            } else {
              // If buffer not initialized, just forward
              originalWriter.merge(inputStream);
            }
          },
          onError: (error: unknown) => {
            // Forward error to original writer if available
            originalWriter.onError?.(error);
          },
        };

        // Send initial status (transient - not added to message history)
        writer.write({
          type: 'data-custom',
          id: generateUUID(),
          transient: true,
          data: {
            type: 'chat-status',
            status: 'processing',
            message: 'Processing your request',
          },
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
        const nexusPromptAddition = isNexusMode
          ? `\n\n${nexusResearcherPrompt}`
          : '';
        const finalSystemPrompt =
          enhancedSystemPrompt +
          nexusResearchContext +
          nexusPromptAddition +
          urlFetchInstruction +
          toolResponseInstructions;

        // Await the preflight promise that was fired in parallel with RAG.
        let preflightEnableThinking = false;
        let preflightMaxTokens = 2000;
        let preflightThinkingBudget: number | undefined = undefined;
        let preflightRequiresDocumentCreation = false;
        let preflightSuggestedDocumentKind: string | null = null;
        let preflightSaveMemory = false;

        const preflightDecision = await preflightPromise;
        if (preflightDecision) {
          preflightEnableThinking = preflightDecision.enableThinking;
          preflightMaxTokens = preflightDecision.maxOutputTokens;
          preflightThinkingBudget = preflightDecision.thinkingBudget;
          preflightRequiresDocumentCreation = preflightDecision.requiresDocumentCreation;
          preflightSuggestedDocumentKind = preflightDecision.suggestedDocumentKind;
          preflightSaveMemory = preflightDecision.saveMemory;

          console.log('[PREFLIGHT] Final decision:', {
            enableThinking: preflightEnableThinking,
            maxOutputTokens: preflightMaxTokens,
            thinkingBudget: preflightThinkingBudget,
            requiresDocumentCreation: preflightRequiresDocumentCreation,
            suggestedDocumentKind: preflightSuggestedDocumentKind,
            saveMemory: preflightSaveMemory,
            mode: isNexusMode ? 'nexus' : 'standard',
          });
        } else {
          // Preflight failed - use defaults. For Nexus mode, be more generous.
          if (isNexusMode) {
            preflightEnableThinking = true;
            preflightMaxTokens = 8000;
            preflightThinkingBudget = 20000;
          }
          // On preflight failure, default to attempting memory extraction
          preflightSaveMemory = true;
        }

        // Always use claude-sonnet model - thinking is controlled via parameter
        const finalChatModel = 'claude-sonnet';

        // Claude has very generous output limits - no hard caps needed
        // Claude 4.5 Sonnet supports up to 64K output tokens
        // Set temperature based on thinking mode
        // Claude with extended thinking requires temperature undefined or 1
        const temperature = preflightEnableThinking ? undefined : 0.8;

        // Use preflight token recommendation directly - no capping
        // Claude can handle much larger outputs than GPT models
        const baseMinTokens = composerDocumentId ? 8000 : 2000;
        const outputTokenLimit = Math.max(baseMinTokens, preflightMaxTokens);

        // For composer/artifact generation, be very generous
        const artifactMaxTokens = Math.max(16000, preflightMaxTokens * 2);

        console.log('[DEBUG] Nexus mode check:', {
          selectedResearchMode,
          hasQueryText: !!queryText,
          hasNexusResearchContext: !!nexusResearchContext,
          shouldActivateNexus:
            selectedResearchMode === 'nexus' &&
            queryText &&
            !nexusResearchContext,
        });

        writer.write({
          type: 'data-custom',
          id: generateUUID(),
          transient: true,
          data: {
            type: 'chat-status',
            status: 'generating',
            message: 'Generating response',
          },
        });

        // DEEP RESEARCH MODE (replaces old Nexus agentic research)
        // When Nexus mode is active, delegate to the multi-phase deep research orchestrator
        // instead of using the single streamText call with nexusResearcherPrompt.
        if (selectedResearchMode === 'nexus' && queryText) {
          console.log('[DEEP RESEARCH] Deep research mode activated');

          // Signal deep research activation
          writer.write({
            type: 'data-custom',
            id: generateUUID(),
            transient: true,
            data: {
              type: 'nexus-mode-active',
              message: 'Deep Research Mode activated',
            },
          } as any);

          // Import and run the deep research orchestrator
          const { runDeepResearch } = await import('@/lib/ai/deep-research/orchestrator');
          const { DEFAULT_DEEP_RESEARCH_CONFIG } = await import('@/lib/ai/deep-research/types');

          let deepResearchText = '';
          const assistantId = generateUUID();

          try {
            await runDeepResearch(queryText, {
              writeProgress(event) {
                writer.write({
                  type: 'data-custom',
                  id: generateUUID(),
                  transient: true,
                  data: event,
                } as any);
              },
              writeText(text) {
                deepResearchText += text;
                writer.write({
                  type: 'text',
                  text,
                } as any);
              },
              writeCitations(citations) {
                writer.write({
                  type: 'data-custom',
                  id: generateUUID(),
                  data: {
                    type: 'deep-research-citations',
                    citations,
                  },
                } as any);
              },
              writeComplete(detail) {
                writer.write({
                  type: 'data-custom',
                  id: generateUUID(),
                  data: {
                    type: 'deep-research-complete',
                    ...detail,
                  },
                } as any);
              },
              writeError(error) {
                writer.write({
                  type: 'data-custom',
                  id: generateUUID(),
                  data: {
                    type: 'deep-research-error',
                    error,
                  },
                } as any);
              },
            }, DEFAULT_DEEP_RESEARCH_CONFIG);

            // Save the deep research result as an assistant message
            if (deepResearchText) {
              await saveMessages({
                messages: [
                  {
                    id: assistantId,
                    chatId: id,
                    role: 'assistant',
                    parts: [{ type: 'text', text: deepResearchText }],
                    attachments: [],
                    createdAt: new Date(),
                    provider: selectedProvider,
                    stoppedAt: null,
                    reasoning: null,
                  },
                ],
              });
              console.log('[DEEP RESEARCH] Saved assistant message:', { assistantId, textLength: deepResearchText.length });

              // Count usage only after assistant output is persisted.
              try {
                await incrementUsageCounter(session.user.id, 'chats_today', 1);
              } catch (usageError) {
                console.error(
                  '[USAGE] Failed to increment chats_today after deep research completion:',
                  usageError,
                );
              }
            }
          } catch (deepResearchError) {
            console.error('[DEEP RESEARCH] Fatal error:', deepResearchError);
            writer.write({
              type: 'data-custom',
              id: generateUUID(),
              data: {
                type: 'deep-research-error',
                error: deepResearchError instanceof Error ? deepResearchError.message : 'Deep research failed',
              },
            } as any);
          }

          // Deep research handles its own completion — skip the normal streamText path
          return;
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
            outputTokenLimit,
            temperature,
            hasNexusResearch: !!nexusResearchContext,
            systemPromptLength: finalSystemPrompt.length,
            thinkingBudget: preflightThinkingBudget || 'none',
          },
        );

        try {
          const result = streamText({
            model: provider.languageModel(finalChatModel),
            system: finalSystemPrompt,
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
            prepareStep: ({ stepNumber }) => {
              if (preflightRequiresDocumentCreation && stepNumber === 0) {
                return {
                  toolChoice: {
                    type: 'tool' as const,
                    toolName: 'createDocument' as const,
                  },
                };
              }
              return {};
            },
            // Removed smoothStream transform - frontend handles smoothing with useSmoothStream hook
            // This allows immediate character-by-character streaming without word buffering
            // AI SDK 5: experimental_generateMessageId removed - use generateId in toUIMessageStreamResponse
            // Dynamic settings based on mode
            temperature: temperature, // Use the variable we defined (undefined for thinking mode)
            maxOutputTokens: outputTokenLimit, // Generous limit for Claude
            // Add extended thinking when enabled via preflight
            // AI SDK 5: Use providerOptions (not experimental_providerMetadata) for inputs
            ...(preflightEnableThinking && preflightThinkingBudget
              ? {
                  providerOptions: {
                    anthropic: {
                      thinking: {
                        type: 'enabled',
                        budgetTokens: preflightThinkingBudget,
                      },
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
                        const isToolPart =
                          part.type === 'tool-invocation' ||
                          (part.type as string)?.startsWith('tool-');
                        if (isToolPart) {
                          const toolInv = (part as any).toolInvocation;
                          const toolName =
                            toolInv?.toolName ||
                            (part.type as string)?.replace('tool-', '');
                          const state = toolInv?.state || (part as any).state;
                          const result =
                            toolInv?.result || (part as any).output;

                          // AI SDK 5: state 'result' renamed to 'output-available'
                          if (
                            toolName === 'searchWeb' &&
                            (state === 'result' ||
                              state === 'output-available') &&
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
                    if (!timeMin && !timeMax && extractedMentions.length > 0) {
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
                    const calendarResult = await getCalendarEventsTool.execute(
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
                        error instanceof Error ? error.message : String(error),
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
                          time: new Date(startDateTime).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          }),
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
                    console.error('Error checking calendar conflicts:', error);
                    return {
                      status: 'error',
                      message: 'Failed to check calendar conflicts',
                      error:
                        error instanceof Error ? error.message : String(error),
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
                    console.error('Error finding available time slots:', error);
                    return {
                      status: 'error',
                      message: 'Failed to find available time slots',
                      error:
                        error instanceof Error ? error.message : String(error),
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
                        error instanceof Error ? error.message : String(error),
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
                        error instanceof Error ? error.message : String(error),
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
                        error instanceof Error ? error.message : String(error),
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
                      (tr: any) => tr.toolCallId === toolCall.toolCallId,
                    );
                    writer.write({
                      type: 'data-custom',
                      id: generateUUID(),
                      transient: true,
                      data: {
                        type: 'nexus-search-progress',
                        query: q || 'Searching...',
                        resultsFound:
                          (searchResult as any)?.result?.resultCount || 0,
                        phase: 'researching',
                      },
                    });
                    console.log('[NEXUS] Search completed:', {
                      query: q,
                      resultsFound:
                        (searchResult as any)?.result?.resultCount || 0,
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
                      },
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
                    },
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
                    },
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
                if (outputTokens > outputTokenLimit * 0.9) {
                  console.warn(
                    `[USAGE] Response used ${outputTokens} tokens, very close to limit of ${outputTokenLimit}`,
                  );
                }

                // Alert if response was truncated due to token limit
                if (finishReason === 'length') {
                  console.error(
                    '[USAGE] Response truncated due to token limit!',
                    {
                      limit: outputTokenLimit,
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
                      tokenLimit: outputTokenLimit,
                    },
                  });
                }
              }

              if (session.user?.id) {
                try {
                  // AI SDK 5: Use result.steps to get ALL tool calls across all steps
                  // result.toolCalls only returns the LAST step's calls!
                  // assistantId is pre-generated above createUIMessageStream so the
                  // client-side message.id matches the DB/contextUsageLog messageId.

                  // Capture reasoning content from extended thinking (if enabled)
                  let reasoningContent: string | null = null;
                  try {
                    const reasoningOutputs = await result.reasoning;
                    if (
                      reasoningOutputs &&
                      Array.isArray(reasoningOutputs) &&
                      reasoningOutputs.length > 0
                    ) {
                      // Join all reasoning outputs into a single string
                      reasoningContent = reasoningOutputs
                        .map(
                          (r: any) =>
                            r.text ||
                            r.content ||
                            r.thinking ||
                            r.reasoning ||
                            (typeof r === 'string' ? r : null),
                        )
                        .filter(Boolean)
                        .join('\n\n');
                      if (reasoningContent) {
                        console.log(
                          '[SAVE] Reasoning saved:',
                          reasoningContent.length,
                          'chars',
                        );
                      }
                    } else if (typeof reasoningOutputs === 'string') {
                      reasoningContent = reasoningOutputs;
                      console.log(
                        '[SAVE] Reasoning saved:',
                        (reasoningContent as string).length,
                        'chars',
                      );
                    }
                  } catch {
                    // Reasoning not available - normal for non-thinking responses
                  }

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
                      console.log(
                        `[SAVE] Step has ${step.toolCalls.length} tool calls`,
                      );
                      allToolCalls.push(...step.toolCalls);
                    }

                    // Collect tool results from this step
                    if (
                      step.toolResults?.length &&
                      step.toolResults.length > 0
                    ) {
                      console.log(
                        `[SAVE] Step has ${step.toolResults.length} tool results`,
                      );
                      allToolResults.push(...step.toolResults);
                    }
                  }

                  // Add the final text
                  if (finalText?.trim()) {
                    messageParts.push({ type: 'text', text: finalText });
                  }

                  console.log(
                    '[SAVE] Total tool calls found:',
                    allToolCalls.length,
                  );
                  console.log(
                    '[SAVE] Total tool results found:',
                    allToolResults.length,
                  );

                  // Match tool calls with their results
                  for (const toolCall of allToolCalls) {
                    const tc = toolCall as any;

                    // Find the matching result
                    const matchingResult = allToolResults.find(
                      (tr: any) => tr.toolCallId === tc.toolCallId,
                    );
                    const mr = matchingResult as any;

                    console.log(`[SAVE] Tool ${tc.toolName}:`, {
                      toolCallId: tc.toolCallId,
                      hasResult: !!matchingResult,
                      resultKeys: mr?.output ? Object.keys(mr.output) : [],
                    });

                    // Save as SDK 5 tool part format: tool-{toolName}
                    messageParts.push({
                      type: `tool-${tc.toolName}`,
                      toolCallId: tc.toolCallId,
                      toolName: tc.toolName,
                      input: tc.input, // SDK 5 uses 'input' not 'args'
                      state: matchingResult
                        ? 'output-available'
                        : 'input-available',
                      output: mr?.output,
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
                        stoppedAt: null,
                        reasoning: reasoningContent, // Save Claude's extended thinking
                      },
                    ],
                  });

                  // Count usage only after assistant output is persisted.
                  try {
                    await incrementUsageCounter(session.user.id, 'chats_today', 1);
                  } catch (usageError) {
                    console.error(
                      '[USAGE] Failed to increment chats_today after assistant save:',
                      usageError,
                    );
                  }

                  // Automatic memory extraction - gated by preflight intelligence.
                  // The preflight Haiku decides if the user's message contains
                  // personal info, preferences, or facts worth remembering.
                  try {
                    const assistantText = finalText?.trim() || '';
                    const userText = queryText?.trim() || '';

                    if (
                      preflightSaveMemory &&
                      userText &&
                      assistantText
                    ) {
                      console.log(
                        `[AutoMemory] Preflight flagged memory-worthy message: "${userText.substring(0, 80)}"`,
                      );
                      import('@/lib/ai/memory-extractor').then(
                        ({ extractAndSaveMemories }) => {
                          extractAndSaveMemories({
                            userId: session.user.id,
                            chatId: id,
                            userMessage: userText,
                            assistantMessage: assistantText,
                            existingMemories: memoryContext,
                            sourceMessageId: assistantId,
                          })
                            .then((memResult) => {
                              if (
                                memResult.saved > 0 ||
                                memResult.updated > 0
                              ) {
                                console.log(
                                  `[AutoMemory] Extracted ${memResult.saved} new, ${memResult.updated} updated memories`,
                                );
                                // Send transient indicator to client
                                try {
                                  writer.write({
                                    type: 'data-custom',
                                    id: generateUUID(),
                                    transient: true,
                                    data: {
                                      type: 'memory-saved',
                                      count:
                                        memResult.saved + memResult.updated,
                                    },
                                  });
                                } catch {
                                  // Writer may be closed - that's fine
                                }
                              }
                            })
                            .catch((err) =>
                              console.error(
                                '[AutoMemory] Extraction failed:',
                                err,
                              ),
                            );
                        },
                      );
                    } else {
                      const reason = !preflightSaveMemory
                        ? 'preflight flagged save_memory=false'
                        : !userText
                          ? 'empty user text'
                          : 'empty assistant text';
                      console.log(
                        `[AutoMemory] Skipped: ${reason} (saveMemory=${preflightSaveMemory}, userLen=${userText.length}, assistLen=${assistantText.length})`,
                      );
                    }
                  } catch (memoryError) {
                    // Never let memory extraction break the chat flow
                    console.error(
                      '[AutoMemory] Failed to start extraction:',
                      memoryError,
                    );
                  }

                  // Trigger background summary update for long conversations
                  triggerBackgroundSummary(id);

                  // Link the stream to the assistant message for recovery purposes
                  try {
                    const { updateStreamMessageId } = await import(
                      '@/lib/db/queries'
                    );
                    await updateStreamMessageId({
                      streamId,
                      messageId: assistantId,
                    });
                  } catch (linkError) {
                    console.error(
                      '[Stream] Failed to link stream to message:',
                      linkError,
                    );
                    // Non-fatal: stream recovery may be impaired but chat continues
                  }

                  // Log context usage for effectiveness tracking
                  try {
                    const { logContextUsage } = await import(
                      '@/lib/db/context-tracking'
                    );

                    // Use actual chunk counts from structured RAG results
                    const systemChunks = systemRagResult.chunkCount;
                    const personaChunks = personaRagResult.chunkCount;
                    const userChunksMatch = userRagResult.chunkCount ?? 0;
                    const memoryChunksMatch = memoryResult.chunkCount;

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
                        orgChunks: orgRagResult.chunkCount ?? 0,
                        orgDocumentIds,
                        orgDocumentNames,
                        memoryIds,
                        semanticMemoryIds,
                        recentMemoryIds,
                        overlappingMemoryIds,
                        memorySourceCounts,
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

                  // Mark stream as completed in database and Redis buffer
                  try {
                    await markStreamCompleted({ streamId });
                    if (streamBufferInitialized) {
                      await streamBuffer.markCompleted();
                    }
                    console.log(`[Stream] Stream completed: ${streamId}`);
                  } catch (streamCompleteError) {
                    console.error(
                      '[Stream] Failed to mark stream as completed:',
                      streamCompleteError,
                    );
                  }
                } catch (error) {
                  console.error('Failed to save chat:', error);

                  // Mark stream as errored
                  try {
                    await markStreamErrored({
                      streamId,
                      error:
                        error instanceof Error
                          ? error.message
                          : 'Unknown error',
                    });
                    if (streamBufferInitialized) {
                      await streamBuffer.markErrored(
                        error instanceof Error
                          ? error.message
                          : 'Unknown error',
                      );
                    }
                  } catch (streamErrorMarkError) {
                    console.error(
                      '[Stream] Failed to mark stream as errored:',
                      streamErrorMarkError,
                    );
                  }

                  // Attempt to save partial message on error
                  try {
                    const partialMessage = response.messages.find(
                      (m) => m.role === 'assistant',
                    );
                    if (partialMessage) {
                      console.log(
                        '[ERROR RECOVERY] Attempting to save partial message',
                      );
                      const partialText =
                        extractAssistantTextFromMessage(partialMessage) ||
                        'Error: Message failed to save';
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
                                text: partialText,
                              },
                            ],
                            attachments: [],
                            createdAt: new Date(),
                            provider: selectedProvider,
                            stoppedAt: null,
                            reasoning: null, // Partial messages don't have reasoning
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
            if ('getTools' in result && typeof result.getTools === 'function') {
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
            // Enable sendReasoning to stream Claude's extended thinking content to the client
            console.log(
              '[THINKING DEBUG] Thinking enabled:',
              preflightEnableThinking,
              'Budget:',
              preflightThinkingBudget,
            );

            // Log reasoning content for debugging
            (async () => {
              try {
                const reasoning = await result.reasoning;
                if (
                  reasoning &&
                  Array.isArray(reasoning) &&
                  reasoning.length > 0
                ) {
                  console.log(
                    '[THINKING] Reasoning received:',
                    reasoning.length,
                    'parts',
                  );
                }
              } catch {
                // Reasoning not available - this is normal for non-thinking responses
              }
            })();

            writer.merge(
              result.toUIMessageStream({
                sendReasoning: true,
              }),
            );
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

        // Mark stream as errored (fire and forget)
        markStreamErrored({
          streamId,
          error: error instanceof Error ? error.message : 'Stream error',
        }).catch((err) => {
          console.error('[Stream] Failed to mark stream as errored:', err);
        });

        if (streamBufferInitialized) {
          streamBuffer
            .markErrored(
              error instanceof Error ? error.message : 'Stream error',
            )
            .catch((err) => {
              console.error('[Stream] Failed to mark buffer as errored:', err);
            });
        }

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
          model: (await import('@ai-sdk/anthropic')).anthropic(
            'claude-haiku-4-5-20251001',
          ),
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

    // AI SDK 5: Resumable streams use incompatible text/v1 protocol.
    // Deep research saves its own messages and the resumable stream handler
    // locks the ReadableStream (incompatible with AI SDK 5 UIMessage protocol).
    // Standard mode also bypasses resumable streams for the same protocol reason.
    console.log('Using direct UI message stream response (AI SDK 5)');
    return createUIMessageStreamResponse({
      stream: responseStream,
      headers: personaFallbackApplied
        ? {
            'x-eos-edge-case': 'PERSONA_FALLBACK_TO_DEFAULT',
          }
        : undefined,
    });
  } catch (error) {
    console.error('[Chat API] Unhandled error in POST route:', error);
    return handleApiError(error);
  }
}

export const GET = withErrorHandler(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const chatId = searchParams.get('chatId');
  const fromSeq = searchParams.get('fromSeq');

  if (!chatId) {
    return new Response(JSON.stringify({ error: 'Chat ID is required' }), { 
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const session = await auth();

  if (!session?.user) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), { 
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  let chat: Chat | null = null;
  let retryCount = 0;
  const maxRetries = 3;

  // Retry logic for getting chat
  while (!chat && retryCount < maxRetries) {
    try {
      chat = await getChatById({ id: chatId });
      if (!chat && retryCount < maxRetries - 1) {
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
        return new Response(JSON.stringify({ error: 'Chat not found or temporarily unavailable' }), { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
  }

  if (!chat) {
    return new Response(JSON.stringify({ error: 'Chat not found' }), { 
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Allow admin users to access any chat
  const isAdminUser = isAdminEmail(session.user.email);

  if (
    chat.visibility === 'private' &&
    chat.userId !== session.user.id &&
    !isAdminUser
  ) {
    return new Response(JSON.stringify({ error: 'You do not have permission to access this chat' }), { 
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Import required functions for stream recovery
  const { getActiveStreamByChatId } = await import('@/lib/db/queries');
  const { getStreamBufferState, getBufferedChunks } = await import(
    '@/lib/stream/buffer-service'
  );

  // Check for active stream in database
  const activeStream = await getActiveStreamByChatId({ chatId });

  if (!activeStream) {
    // No active stream - return 204 to indicate no recovery needed
    console.log(`[Stream Recovery] No active stream for chat ${chatId}`);
    return new Response(null, { status: 204 });
  }

  console.log(`[Stream Recovery] Found active stream: ${activeStream.id}`, {
    status: activeStream.status,
    lastActiveAt: activeStream.lastActiveAt,
    messageId: activeStream.messageId,
    composerDocumentId: activeStream.composerDocumentId,
  });

  // Check if stream is stale (no activity in last 60 seconds)
  const staleThreshold = 60 * 1000; // 60 seconds
  const isStale =
    Date.now() - new Date(activeStream.lastActiveAt).getTime() > staleThreshold;

  if (isStale) {
    console.log(
      `[Stream Recovery] Stream ${activeStream.id} is stale, marking as interrupted`,
    );
    const { markStreamInterrupted } = await import('@/lib/db/queries');
    await markStreamInterrupted({ streamId: activeStream.id });

    // Return stream state with interrupted status
    return Response.json(
      {
        streamId: activeStream.id,
        status: 'interrupted',
        messageId: activeStream.messageId,
        composerDocumentId: activeStream.composerDocumentId,
        metadata: activeStream.metadata,
        chunks: [],
        isStale: true,
      },
      { status: 200 },
    );
  }

  // Get buffered chunks from Redis
  const startSeq = fromSeq ? Number.parseInt(fromSeq, 10) : 0;
  const bufferState = await getStreamBufferState(activeStream.id);
  const chunks = await getBufferedChunks(activeStream.id, startSeq);

  console.log(
    `[Stream Recovery] Retrieved ${chunks.length} chunks from seq ${startSeq}`,
  );

  // If there's a composer document, fetch partial content from Redis
  let composerPartialContent: string | null = null;
  let composerMetadata: { kind?: string; title?: string } = {};

  if (activeStream.composerDocumentId) {
    try {
      const { ComposerContentBuffer } = await import(
        '@/lib/stream/buffer-service'
      );
      const composerBuffer = new ComposerContentBuffer(
        activeStream.composerDocumentId,
      );
      composerPartialContent = await composerBuffer.getPartialContent();

      // Try to get composer kind/title from the document in database
      const { getDocumentById } = await import('@/lib/db/queries');
      const document = await getDocumentById({
        id: activeStream.composerDocumentId,
      });
      if (document) {
        composerMetadata = {
          kind: document.kind,
          title: document.title,
        };
      }

      console.log(
        `[Stream Recovery] Composer content: ${composerPartialContent?.length || 0} chars, kind: ${composerMetadata.kind}`,
      );
    } catch (err) {
      console.error('[Stream Recovery] Failed to get composer content:', err);
    }
  }

  // Return stream state and buffered chunks for client recovery
  const baseMetadata =
    activeStream.metadata && typeof activeStream.metadata === 'object'
      ? (activeStream.metadata as Record<string, unknown>)
      : {};

  return Response.json(
    {
      streamId: activeStream.id,
      status: activeStream.status,
      messageId: activeStream.messageId,
      composerDocumentId: activeStream.composerDocumentId,
      metadata: {
        ...baseMetadata,
        composerKind: composerMetadata.kind,
        composerTitle: composerMetadata.title,
        partialContent: composerPartialContent,
      },
      bufferState,
      chunks,
      totalChunks: bufferState?.chunkCount || chunks.length,
      isActive: activeStream.status === 'active',
    },
    { status: 200 },
  );
});

export const DELETE = withErrorHandler(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return new Response(JSON.stringify({ error: 'Chat ID is required' }), { 
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const session = await auth();

  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), { 
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const chat = await getChatById({ id });

  if (!chat) {
    return new Response(JSON.stringify({ error: 'Chat not found' }), { 
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (chat.userId !== session.user.id) {
    return new Response(JSON.stringify({ error: 'You do not have permission to delete this chat' }), { 
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const deletedChat = await deleteChatById({ id });

  return Response.json(deletedChat, { status: 200 });
});
