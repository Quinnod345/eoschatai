/**
 * EOSAI Public API - Single Conversation
 *
 * Get or delete a specific conversation.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { apiConversation, apiConversationMessage } from '@/lib/db/schema';
import { eq, and, asc } from 'drizzle-orm';
import {
  validateApiRequest,
  addRateLimitHeaders,
  generateRequestId,
  openaiError,
} from '@/lib/api/middleware';
import { logApiKeyUsage } from '@/lib/api/keys';

/**
 * GET /api/v1/conversations/:id
 * Get a conversation with its messages
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = generateRequestId();
  const startTime = Date.now();

  // Validate API key
  const validation = await validateApiRequest(request, []);
  if ('error' in validation) {
    return validation.error;
  }
  const context = validation.context;

  const { id } = await params;

  try {
    // Fetch the conversation
    const [conversation] = await db
      .select()
      .from(apiConversation)
      .where(
        and(
          eq(apiConversation.id, id),
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

    // Fetch messages
    const messages = await db
      .select()
      .from(apiConversationMessage)
      .where(eq(apiConversationMessage.conversationId, id))
      .orderBy(asc(apiConversationMessage.createdAt));

    // Log usage
    await logApiKeyUsage({
      apiKeyId: context.apiKey.id,
      endpoint: `/v1/conversations/${id}`,
      method: 'GET',
      statusCode: 200,
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
        messages: messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          token_count: m.tokenCount,
          created_at: m.createdAt.toISOString(),
        })),
      },
      {
        headers: { 'X-Request-ID': requestId },
      },
    );

    return addRateLimitHeaders(response, context);
  } catch (error) {
    console.error('[API v1] Error fetching conversation:', error);

    await logApiKeyUsage({
      apiKeyId: context.apiKey.id,
      endpoint: `/v1/conversations/${id}`,
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
 * DELETE /api/v1/conversations/:id
 * Delete a conversation and all its messages
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = generateRequestId();
  const startTime = Date.now();

  // Validate API key
  const validation = await validateApiRequest(request, ['chat']);
  if ('error' in validation) {
    return validation.error;
  }
  const context = validation.context;

  const { id } = await params;

  try {
    // Check if conversation exists and belongs to this API key
    const [conversation] = await db
      .select({ id: apiConversation.id })
      .from(apiConversation)
      .where(
        and(
          eq(apiConversation.id, id),
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

    // Delete the conversation (messages will cascade)
    await db.delete(apiConversation).where(eq(apiConversation.id, id));

    // Log usage
    await logApiKeyUsage({
      apiKeyId: context.apiKey.id,
      endpoint: `/v1/conversations/${id}`,
      method: 'DELETE',
      statusCode: 200,
      responseTimeMs: Date.now() - startTime,
    });

    const response = NextResponse.json(
      {
        id,
        object: 'conversation.deleted',
        deleted: true,
      },
      {
        headers: { 'X-Request-ID': requestId },
      },
    );

    return addRateLimitHeaders(response, context);
  } catch (error) {
    console.error('[API v1] Error deleting conversation:', error);

    await logApiKeyUsage({
      apiKeyId: context.apiKey.id,
      endpoint: `/v1/conversations/${id}`,
      method: 'DELETE',
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
 * OPTIONS /api/v1/conversations/:id
 * Handle CORS preflight
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
      'Access-Control-Max-Age': '86400',
    },
  });
}
