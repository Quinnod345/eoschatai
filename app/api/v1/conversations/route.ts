/**
 * EOSAI Public API - Conversations
 *
 * Create and list persistent conversations for multi-turn interactions.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v3';
import { db } from '@/lib/db';
import { apiConversation } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import {
  validateApiRequest,
  addRateLimitHeaders,
  generateRequestId,
  openaiError,
} from '@/lib/api/middleware';
import { logApiKeyUsage } from '@/lib/api/keys';

// Request schema for creating a conversation
const createConversationSchema = z.object({
  title: z.string().max(256).optional(),
  model: z.string().optional().default('eosai-v1'),
  system_prompt: z.string().max(4096).optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * POST /api/v1/conversations
 * Create a new conversation
 */
export async function POST(request: NextRequest) {
  const requestId = generateRequestId();
  const startTime = Date.now();

  // Validate API key
  const validation = await validateApiRequest(request, ['chat']);
  if ('error' in validation) {
    return validation.error;
  }
  const context = validation.context;

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

  // Validate request body
  const parseResult = createConversationSchema.safeParse(body);
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

  const { title, model, system_prompt, metadata } = parseResult.data;

  try {
    // Create the conversation
    const [conversation] = await db
      .insert(apiConversation)
      .values({
        apiKeyId: context.apiKey.id,
        title: title || null,
        model,
        systemPrompt: system_prompt || null,
        metadata: metadata || null,
      })
      .returning();

    // Log usage
    await logApiKeyUsage({
      apiKeyId: context.apiKey.id,
      endpoint: '/v1/conversations',
      method: 'POST',
      statusCode: 201,
      responseTimeMs: Date.now() - startTime,
    });

    const response = NextResponse.json(
      {
        id: conversation.id,
        object: 'conversation',
        title: conversation.title,
        model: conversation.model,
        system_prompt: conversation.systemPrompt,
        metadata: conversation.metadata,
        message_count: conversation.messageCount,
        total_tokens: conversation.totalTokens,
        created_at: conversation.createdAt.toISOString(),
        updated_at: conversation.updatedAt.toISOString(),
      },
      {
        status: 201,
        headers: { 'X-Request-ID': requestId },
      },
    );

    return addRateLimitHeaders(response, context);
  } catch (error) {
    console.error('[API v1] Error creating conversation:', error);

    await logApiKeyUsage({
      apiKeyId: context.apiKey.id,
      endpoint: '/v1/conversations',
      method: 'POST',
      statusCode: 500,
      responseTimeMs: Date.now() - startTime,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });

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
 * GET /api/v1/conversations
 * List conversations for the current API key
 */
export async function GET(request: NextRequest) {
  const requestId = generateRequestId();
  const startTime = Date.now();

  // Validate API key
  const validation = await validateApiRequest(request, []);
  if ('error' in validation) {
    return validation.error;
  }
  const context = validation.context;

  // Get query parameters
  const url = new URL(request.url);
  const limit = Math.min(
    parseInt(url.searchParams.get('limit') || '20', 10),
    100,
  );
  const offset = parseInt(url.searchParams.get('offset') || '0', 10);

  try {
    // Fetch conversations
    const conversations = await db
      .select()
      .from(apiConversation)
      .where(eq(apiConversation.apiKeyId, context.apiKey.id))
      .orderBy(desc(apiConversation.updatedAt))
      .limit(limit)
      .offset(offset);

    // Log usage
    await logApiKeyUsage({
      apiKeyId: context.apiKey.id,
      endpoint: '/v1/conversations',
      method: 'GET',
      statusCode: 200,
      responseTimeMs: Date.now() - startTime,
    });

    const response = NextResponse.json(
      {
        object: 'list',
        data: conversations.map((c) => ({
          id: c.id,
          object: 'conversation',
          title: c.title,
          model: c.model,
          message_count: c.messageCount,
          total_tokens: c.totalTokens,
          created_at: c.createdAt.toISOString(),
          updated_at: c.updatedAt.toISOString(),
        })),
        has_more: conversations.length === limit,
      },
      {
        headers: { 'X-Request-ID': requestId },
      },
    );

    return addRateLimitHeaders(response, context);
  } catch (error) {
    console.error('[API v1] Error listing conversations:', error);

    await logApiKeyUsage({
      apiKeyId: context.apiKey.id,
      endpoint: '/v1/conversations',
      method: 'GET',
      statusCode: 500,
      responseTimeMs: Date.now() - startTime,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });

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
 * OPTIONS /api/v1/conversations
 * Handle CORS preflight
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
      'Access-Control-Max-Age': '86400',
    },
  });
}
