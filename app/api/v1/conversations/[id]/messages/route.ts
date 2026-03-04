/**
 * EOSAI Public API - Conversation Messages
 *
 * Send messages to a conversation and get AI responses.
 * Supports streaming.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { streamText, generateText } from 'ai';
import { z } from 'zod/v3';
import { db } from '@/lib/db';
import { apiConversation, apiConversationMessage } from '@/lib/db/schema';
import { eq, and, asc, sql } from 'drizzle-orm';
import {
  validateApiRequest,
  addRateLimitHeaders,
  generateRequestId,
  openaiError,
  type ApiContext,
} from '@/lib/api/middleware';
import { logApiKeyUsage } from '@/lib/api/keys';
import { createCustomProvider } from '@/lib/ai/providers';
import { findUpstashSystemContent } from '@/lib/ai/upstash-system-rag';

export const maxDuration = 60;

// Model mapping - using correct Claude 4.5 model IDs
const MODEL_MAP: Record<
  string,
  { provider: string; model: string; enableReasoning?: boolean }
> = {
  'eosai-v1': { provider: 'anthropic', model: 'claude-sonnet-4-5-20250929' },
  'eosai-v1-fast': {
    provider: 'anthropic',
    model: 'claude-haiku-4-5-20251001',
  },
  'eosai-v1-pro': {
    provider: 'anthropic',
    model: 'claude-opus-4-5-20251101',
    enableReasoning: true, // Claude Opus 4.5 with extended thinking
  },
};

// Reasoning budget for pro model (in tokens)
const REASONING_BUDGET = 32000;

// Default system prompt
const EOS_SYSTEM_PROMPT = `You are EOSAI, an expert AI assistant specialized in the Entrepreneurial Operating System (EOS®). 

Your expertise includes:
- Vision/Traction Organizer (V/TO)
- Accountability Charts
- Scorecards and Measurables
- Rocks (90-day priorities)
- Level 10 Meetings
- IDS (Identify, Discuss, Solve)
- People Analyzer and Right People Right Seats
- Process documentation (Core Processes)
- Quarterly and Annual Planning
- EOS implementation best practices

Guidelines:
1. Provide clear, actionable advice grounded in EOS principles
2. Use proper EOS terminology and frameworks
3. Be helpful and professional
4. If asked about topics outside EOS, you can help but clarify your primary expertise
5. Reference EOS tools and concepts when relevant

You are powered by EOS Worldwide's official methodology and training materials.`;

// Request schema
const messageRequestSchema = z.object({
  content: z.string().min(1).max(32000),
  stream: z.boolean().optional().default(false),
  include_eos_context: z.boolean().optional().default(true),
  eos_namespace: z.string().optional().default('eos-implementer'),
});

/**
 * Build system prompt with EOS RAG context
 */
async function buildSystemPrompt(
  customPrompt: string | null,
  userQuery: string,
  namespace: string,
  includeContext: boolean,
): Promise<string> {
  const basePrompt = customPrompt || EOS_SYSTEM_PROMPT;

  if (!includeContext) {
    return basePrompt;
  }

  try {
    const results = await findUpstashSystemContent(
      userQuery,
      namespace,
      5,
      0.6,
    );

    if (results.length === 0) {
      return basePrompt;
    }

    const contextText = results
      .map((item, index) => `[${index + 1}] ${item.title}\n${item.content}`)
      .join('\n\n---\n\n');

    return `${basePrompt}

## EOS KNOWLEDGE BASE CONTEXT
The following relevant EOS content has been retrieved to help answer this query:

${contextText}

Use this context to provide accurate, EOS-specific guidance. Cite specific concepts when relevant.`;
  } catch (error) {
    console.error('[API v1] Error fetching EOS context:', error);
    return basePrompt;
  }
}

/**
 * POST /api/v1/conversations/:id/messages
 * Send a message and get AI response
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = generateRequestId();
  const startTime = Date.now();
  let context: ApiContext | undefined;

  // Validate API key
  const validation = await validateApiRequest(request, ['chat']);
  if ('error' in validation) {
    return validation.error;
  }
  context = validation.context;
  const apiKeyId = context.apiKey.id;

  const { id: conversationId } = await params;

  // Parse request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return openaiError(
      'Invalid JSON in request body',
      'invalid_request_error',
      'invalid_json',
      null,
      400,
    );
  }

  // Validate request
  const parseResult = messageRequestSchema.safeParse(body);
  if (!parseResult.success) {
    const error = parseResult.error.errors[0];
    return openaiError(
      `Invalid request: ${error.message}`,
      'invalid_request_error',
      'invalid_param',
      error.path.join('.'),
      400,
    );
  }

  const { content, stream, include_eos_context, eos_namespace } =
    parseResult.data;

  try {
    // Fetch conversation and verify ownership
    const [conversation] = await db
      .select()
      .from(apiConversation)
      .where(
        and(
          eq(apiConversation.id, conversationId),
          eq(apiConversation.apiKeyId, context.apiKey.id),
        ),
      )
      .limit(1);

    if (!conversation) {
      return openaiError(
        'Conversation not found',
        'invalid_request_error',
        'not_found',
        'id',
        404,
      );
    }

    // Get model config
    const modelConfig = MODEL_MAP[conversation.model || 'eosai-v1'];
    if (!modelConfig) {
      return openaiError(
        `Model "${conversation.model}" is not supported`,
        'invalid_request_error',
        'model_not_found',
        'model',
        400,
      );
    }

    // Fetch existing messages
    const existingMessages = await db
      .select({
        role: apiConversationMessage.role,
        content: apiConversationMessage.content,
      })
      .from(apiConversationMessage)
      .where(eq(apiConversationMessage.conversationId, conversationId))
      .orderBy(asc(apiConversationMessage.createdAt));

    // Build messages array for AI
    const messages = [
      ...existingMessages.map((m) => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
      })),
      { role: 'user' as const, content },
    ];

    // Build system prompt with RAG context
    const systemPrompt = await buildSystemPrompt(
      conversation.systemPrompt,
      content,
      eos_namespace,
      include_eos_context,
    );

    // Create provider
    const provider = createCustomProvider(modelConfig.provider);

    // Save user message
    const userTokens = Math.ceil(content.length / 4);
    await db.insert(apiConversationMessage).values({
      conversationId,
      role: 'user',
      content,
      tokenCount: userTokens,
    });

    // Handle streaming response
    if (stream) {
      // Extended thinking requires temperature undefined or 1
      const temperature = modelConfig.enableReasoning ? undefined : 0.7;

      const result = streamText({
        model: provider.languageModel(modelConfig.model),
        system: systemPrompt,
        messages,
        temperature,
        // Enable extended thinking for pro model (Claude Opus 4.5)
        ...(modelConfig.enableReasoning
          ? {
              providerOptions: {
                anthropic: {
                  thinking: {
                    type: 'enabled',
                    budgetTokens: REASONING_BUDGET,
                  },
                },
              },
            }
          : {}),
      });

      const responseStream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          let fullResponse = '';
          let tokenCount = 0;

          try {
            for await (const chunk of result.textStream) {
              fullResponse += chunk;
              tokenCount++;

              const data = {
                id: requestId,
                object: 'conversation.message.chunk',
                conversation_id: conversationId,
                delta: { content: chunk },
                finish_reason: null,
              };

              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(data)}\n\n`),
              );
            }

            // Save assistant message
            await db.insert(apiConversationMessage).values({
              conversationId,
              role: 'assistant',
              content: fullResponse,
              tokenCount,
            });

            // Update conversation stats
            const totalNewTokens = userTokens + tokenCount;
            await db
              .update(apiConversation)
              .set({
                messageCount: sql`${apiConversation.messageCount} + 2`,
                totalTokens: sql`${apiConversation.totalTokens} + ${totalNewTokens}`,
                updatedAt: new Date(),
              })
              .where(eq(apiConversation.id, conversationId));

            // Send final chunk
            const finalData = {
              id: requestId,
              object: 'conversation.message.chunk',
              conversation_id: conversationId,
              delta: {},
              finish_reason: 'stop',
            };
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(finalData)}\n\n`),
            );
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();

            // Log usage
            const responseTime = Date.now() - startTime;
            await logApiKeyUsage({
              apiKeyId,
              endpoint: `/v1/conversations/${conversationId}/messages`,
              method: 'POST',
              promptTokens: userTokens,
              completionTokens: tokenCount,
              totalTokens: totalNewTokens,
              statusCode: 200,
              responseTimeMs: responseTime,
              model: conversation.model || 'eosai-v1',
            });
          } catch (error) {
            console.error('[API v1] Stream error:', error);
            const errorData = {
              error: {
                message: 'An error occurred during streaming',
                type: 'server_error',
                code: 'stream_error',
              },
            };
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(errorData)}\n\n`),
            );
            controller.close();
          }
        },
      });

      const response = new NextResponse(responseStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
          'X-Request-ID': requestId,
        },
      });

      return addRateLimitHeaders(response, context);
    }

    // Non-streaming response
    // Extended thinking requires temperature undefined or 1
    const nonStreamTemperature = modelConfig.enableReasoning ? undefined : 0.7;

    const result = await generateText({
      model: provider.languageModel(modelConfig.model),
      system: systemPrompt,
      messages,
      temperature: nonStreamTemperature,
      // Enable extended thinking for pro model (Claude Opus 4.5)
      ...(modelConfig.enableReasoning
        ? {
            providerOptions: {
              anthropic: {
                thinking: {
                  type: 'enabled',
                  budgetTokens: REASONING_BUDGET,
                },
              },
            },
          }
        : {}),
    });

    const assistantTokens = Math.ceil(result.text.length / 4);
    const totalNewTokens = userTokens + assistantTokens;

    // Save assistant message
    await db.insert(apiConversationMessage).values({
      conversationId,
      role: 'assistant',
      content: result.text,
      tokenCount: assistantTokens,
    });

    // Update conversation stats
    await db
      .update(apiConversation)
      .set({
        messageCount: sql`${apiConversation.messageCount} + 2`,
        totalTokens: sql`${apiConversation.totalTokens} + ${totalNewTokens}`,
        updatedAt: new Date(),
      })
      .where(eq(apiConversation.id, conversationId));

    // Log usage
    const responseTime = Date.now() - startTime;
    await logApiKeyUsage({
      apiKeyId,
      endpoint: `/v1/conversations/${conversationId}/messages`,
      method: 'POST',
      promptTokens: userTokens,
      completionTokens: assistantTokens,
      totalTokens: totalNewTokens,
      statusCode: 200,
      responseTimeMs: responseTime,
      model: conversation.model || 'eosai-v1',
    });

    const response = NextResponse.json(
      {
        id: requestId,
        object: 'conversation.message',
        conversation_id: conversationId,
        role: 'assistant',
        content: result.text,
        token_count: assistantTokens,
        finish_reason: result.finishReason || 'stop',
        usage: {
          prompt_tokens: userTokens,
          completion_tokens: assistantTokens,
          total_tokens: totalNewTokens,
        },
      },
      {
        headers: { 'X-Request-ID': requestId },
      },
    );

    return addRateLimitHeaders(response, context);
  } catch (error) {
    console.error('[API v1] Error in conversation message:', error);

    if (context) {
      await logApiKeyUsage({
        apiKeyId: context.apiKey.id,
        endpoint: `/v1/conversations/${conversationId}/messages`,
        method: 'POST',
        statusCode: 500,
        responseTimeMs: Date.now() - startTime,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return openaiError(
      'An internal error occurred',
      'server_error',
      'internal_error',
      null,
      500,
    );
  }
}

/**
 * OPTIONS /api/v1/conversations/:id/messages
 * Handle CORS preflight
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
      'Access-Control-Max-Age': '86400',
    },
  });
}
