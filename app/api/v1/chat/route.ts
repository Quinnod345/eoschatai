/**
 * EOSAI Public API - Chat Completions
 *
 * OpenAI-compatible chat completions endpoint powered by EOS methodology.
 * This endpoint uses the system RAG (EOS knowledge base) but does NOT
 * include user-specific data (memories, user documents, etc.)
 */

import { NextRequest, NextResponse } from 'next/server';
import { streamText, generateText } from 'ai';
import { z } from 'zod/v3';
import {
  validateApiRequest,
  apiError,
  addRateLimitHeaders,
  generateRequestId,
  openaiError,
  type ApiContext,
} from '@/lib/api/middleware';
import { logApiKeyUsage } from '@/lib/api/keys';
import { createCustomProvider } from '@/lib/ai/providers';
import { findUpstashSystemContent } from '@/lib/ai/upstash-system-rag';

export const maxDuration = 60;

// Request body schema (OpenAI-compatible)
const chatRequestSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(['system', 'user', 'assistant']),
      content: z.string(),
    })
  ).min(1),
  model: z.string().optional().default('eosai-v1'),
  stream: z.boolean().optional().default(false),
  temperature: z.number().min(0).max(2).optional().default(0.7),
  max_tokens: z.number().min(1).max(16384).optional().default(4096),
  top_p: z.number().min(0).max(1).optional(),
  frequency_penalty: z.number().min(-2).max(2).optional(),
  presence_penalty: z.number().min(-2).max(2).optional(),
  stop: z.union([z.string(), z.array(z.string())]).optional(),
  // EOSAI-specific options
  include_eos_context: z.boolean().optional().default(true),
  eos_namespace: z.string().optional().default('eos-implementer'),
});

type ChatRequest = z.infer<typeof chatRequestSchema>;

// Map our model names to actual provider models
const MODEL_MAP: Record<string, { provider: string; model: string }> = {
  'eosai-v1': { provider: 'anthropic', model: 'claude-sonnet' },
  'eosai-v1-fast': { provider: 'anthropic', model: 'claude-haiku' },
  'eosai-v1-pro': { provider: 'anthropic', model: 'claude-sonnet' },
};

// EOS System prompt for public API (no user-specific context)
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

/**
 * Build system prompt with EOS RAG context
 */
async function buildSystemPrompt(
  userQuery: string,
  namespace: string,
  includeContext: boolean
): Promise<string> {
  if (!includeContext) {
    return EOS_SYSTEM_PROMPT;
  }

  try {
    // Search for relevant EOS content
    const results = await findUpstashSystemContent(userQuery, namespace, 5, 0.6);

    if (results.length === 0) {
      return EOS_SYSTEM_PROMPT;
    }

    // Build context from search results
    const contextText = results
      .map((item, index) => `[${index + 1}] ${item.title}\n${item.content}`)
      .join('\n\n---\n\n');

    return `${EOS_SYSTEM_PROMPT}

## EOS KNOWLEDGE BASE CONTEXT
The following relevant EOS content has been retrieved to help answer this query:

${contextText}

Use this context to provide accurate, EOS-specific guidance. Cite specific concepts when relevant.`;
  } catch (error) {
    console.error('[API v1] Error fetching EOS context:', error);
    return EOS_SYSTEM_PROMPT;
  }
}

/**
 * POST /api/v1/chat
 * Create a chat completion
 */
export async function POST(request: NextRequest) {
  const requestId = generateRequestId();
  const startTime = Date.now();
  let context: ApiContext | undefined;

  try {
    // Validate API key and rate limits
    const validation = await validateApiRequest(request, ['chat']);
    if ('error' in validation) {
      return validation.error;
    }
    context = validation.context;

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
        400
      );
    }

    // Validate request body
    const parseResult = chatRequestSchema.safeParse(body);
    if (!parseResult.success) {
      const error = parseResult.error.errors[0];
      return openaiError(
        `Invalid request: ${error.message}`,
        'invalid_request_error',
        'invalid_param',
        error.path.join('.'),
        400
      );
    }

    const chatRequest = parseResult.data;

    // Check if model is allowed for this API key
    const allowedModels = context.apiKey.allowedModels as string[] | null;
    if (allowedModels && !allowedModels.includes(chatRequest.model)) {
      return openaiError(
        `Model "${chatRequest.model}" is not allowed for this API key`,
        'invalid_request_error',
        'model_not_allowed',
        'model',
        403
      );
    }

    // Get model configuration
    const modelConfig = MODEL_MAP[chatRequest.model];
    if (!modelConfig) {
      return openaiError(
        `Model "${chatRequest.model}" is not supported. Available models: ${Object.keys(MODEL_MAP).join(', ')}`,
        'invalid_request_error',
        'model_not_found',
        'model',
        400
      );
    }

    // Create provider
    const provider = createCustomProvider(modelConfig.provider);

    // Get the last user message for RAG context
    const lastUserMessage = [...chatRequest.messages]
      .reverse()
      .find((m) => m.role === 'user');
    const userQuery = lastUserMessage?.content || '';

    // Build system prompt with EOS context
    const systemPrompt = await buildSystemPrompt(
      userQuery,
      chatRequest.eos_namespace,
      chatRequest.include_eos_context
    );

    // Build messages array
    const messages = chatRequest.messages.map((m) => ({
      role: m.role as 'system' | 'user' | 'assistant',
      content: m.content,
    }));

    // Handle streaming response
    if (chatRequest.stream) {
      const result = streamText({
        model: provider.languageModel(modelConfig.model),
        system: systemPrompt,
        messages,
        temperature: chatRequest.temperature,
        stopSequences: chatRequest.stop
          ? Array.isArray(chatRequest.stop)
            ? chatRequest.stop
            : [chatRequest.stop]
          : undefined,
      });

      // Create SSE stream in OpenAI format
      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          let totalTokens = 0;

          try {
            for await (const chunk of result.textStream) {
              totalTokens += 1; // Approximate token count

              const data = {
                id: requestId,
                object: 'chat.completion.chunk',
                created: Math.floor(Date.now() / 1000),
                model: chatRequest.model,
                choices: [
                  {
                    index: 0,
                    delta: { content: chunk },
                    finish_reason: null,
                  },
                ],
              };

              controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
            }

            // Send final chunk with finish_reason
            const finalData = {
              id: requestId,
              object: 'chat.completion.chunk',
              created: Math.floor(Date.now() / 1000),
              model: chatRequest.model,
              choices: [
                {
                  index: 0,
                  delta: {},
                  finish_reason: 'stop',
                },
              ],
            };

            controller.enqueue(encoder.encode(`data: ${JSON.stringify(finalData)}\n\n`));
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();

            // Log usage after stream completes
            const responseTime = Date.now() - startTime;
            await logApiKeyUsage({
              apiKeyId: context!.apiKey.id,
              endpoint: '/v1/chat',
              method: 'POST',
              promptTokens: messages.reduce((acc, m) => acc + Math.ceil(m.content.length / 4), 0),
              completionTokens: totalTokens,
              totalTokens: messages.reduce((acc, m) => acc + Math.ceil(m.content.length / 4), 0) + totalTokens,
              statusCode: 200,
              responseTimeMs: responseTime,
              model: chatRequest.model,
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
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorData)}\n\n`));
            controller.close();
          }
        },
      });

      const response = new NextResponse(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'X-Request-ID': requestId,
        },
      });

      return addRateLimitHeaders(response, context);
    }

    // Handle non-streaming response
    const result = await generateText({
      model: provider.languageModel(modelConfig.model),
      system: systemPrompt,
      messages,
      temperature: chatRequest.temperature,
      stopSequences: chatRequest.stop
        ? Array.isArray(chatRequest.stop)
          ? chatRequest.stop
          : [chatRequest.stop]
        : undefined,
    });

    const responseTime = Date.now() - startTime;

    // Calculate token usage (approximate)
    const promptTokens = messages.reduce(
      (acc, m) => acc + Math.ceil(m.content.length / 4),
      0
    );
    const completionTokens = Math.ceil(result.text.length / 4);
    const totalTokens = promptTokens + completionTokens;

    // Log usage
    await logApiKeyUsage({
      apiKeyId: context.apiKey.id,
      endpoint: '/v1/chat',
      method: 'POST',
      promptTokens,
      completionTokens,
      totalTokens,
      statusCode: 200,
      responseTimeMs: responseTime,
      model: chatRequest.model,
    });

    // Build OpenAI-compatible response
    const responseBody = {
      id: requestId,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: chatRequest.model,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: result.text,
          },
          finish_reason: result.finishReason || 'stop',
        },
      ],
      usage: {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: totalTokens,
      },
    };

    const response = NextResponse.json(responseBody, {
      headers: {
        'X-Request-ID': requestId,
      },
    });

    return addRateLimitHeaders(response, context);
  } catch (error) {
    console.error('[API v1] Chat error:', error);

    // Log error
    if (context) {
      await logApiKeyUsage({
        apiKeyId: context.apiKey.id,
        endpoint: '/v1/chat',
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
      500
    );
  }
}

/**
 * OPTIONS /api/v1/chat
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
