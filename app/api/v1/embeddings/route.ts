/**
 * EOSAI Public API - Embeddings
 *
 * Generate text embeddings for semantic search and RAG applications.
 * OpenAI-compatible endpoint.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v3';
import { embed, embedMany } from 'ai';
import { openai } from '@ai-sdk/openai';
import {
  validateApiRequest,
  addRateLimitHeaders,
  generateRequestId,
  openaiError,
} from '@/lib/api/middleware';
import { logApiKeyUsage } from '@/lib/api/keys';

// Embedding model
const embeddingModel = openai.embedding('text-embedding-3-small');
const EMBEDDING_DIMENSIONS = 1536;
const MAX_TOKENS_PER_INPUT = 8191; // OpenAI's limit for text-embedding-3-small

// Request schema (OpenAI-compatible)
const embeddingsRequestSchema = z.object({
  input: z.union([
    z.string().min(1).max(32000),
    z.array(z.string().min(1).max(32000)).min(1).max(100),
  ]),
  model: z.string().optional().default('text-embedding-3-small'),
  encoding_format: z.enum(['float', 'base64']).optional().default('float'),
});

/**
 * Estimate token count (rough approximation)
 */
function estimateTokens(text: string): number {
  // Rough estimate: ~4 chars per token for English text
  return Math.ceil(text.length / 4);
}

/**
 * POST /api/v1/embeddings
 * Generate embeddings for text input(s)
 */
export async function POST(request: NextRequest) {
  const requestId = generateRequestId();
  const startTime = Date.now();

  // Validate API key
  const validation = await validateApiRequest(request, []);
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

  // Validate request
  const parseResult = embeddingsRequestSchema.safeParse(body);
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

  const { input, model, encoding_format } = parseResult.data;

  // Only support text-embedding-3-small for now
  if (model !== 'text-embedding-3-small') {
    return openaiError(
      `Model "${model}" is not supported. Use "text-embedding-3-small".`,
      'invalid_request_error',
      'model_not_found',
      'model',
      400,
    );
  }

  try {
    const inputs = Array.isArray(input) ? input : [input];

    // Validate total input size
    const totalTokens = inputs.reduce(
      (sum, text) => sum + estimateTokens(text),
      0,
    );
    if (totalTokens > MAX_TOKENS_PER_INPUT * inputs.length) {
      return openaiError(
        'Input too large. Please reduce the size of your input.',
        'invalid_request_error',
        'context_length_exceeded',
        'input',
        400,
      );
    }

    // Generate embeddings
    let embeddings: number[][];

    if (inputs.length === 1) {
      // Single embedding
      const result = await embed({
        model: embeddingModel,
        value: inputs[0],
      });
      embeddings = [result.embedding];
    } else {
      // Batch embeddings
      const result = await embedMany({
        model: embeddingModel,
        values: inputs,
      });
      embeddings = result.embeddings;
    }

    // Format response
    const data = embeddings.map((embedding, index) => {
      let embeddingData: number[] | string = embedding;

      // Convert to base64 if requested
      if (encoding_format === 'base64') {
        const buffer = Buffer.from(new Float32Array(embedding).buffer);
        embeddingData = buffer.toString('base64');
      }

      return {
        object: 'embedding',
        index,
        embedding: embeddingData,
      };
    });

    // Calculate usage
    const promptTokens = inputs.reduce(
      (sum, text) => sum + estimateTokens(text),
      0,
    );

    // Log usage
    await logApiKeyUsage({
      apiKeyId: context.apiKey.id,
      endpoint: '/v1/embeddings',
      method: 'POST',
      promptTokens,
      totalTokens: promptTokens,
      statusCode: 200,
      responseTimeMs: Date.now() - startTime,
      model,
    });

    const response = NextResponse.json(
      {
        object: 'list',
        data,
        model,
        usage: {
          prompt_tokens: promptTokens,
          total_tokens: promptTokens,
        },
      },
      {
        headers: { 'X-Request-ID': requestId },
      },
    );

    return addRateLimitHeaders(response, context);
  } catch (error) {
    console.error('[API v1] Error generating embeddings:', error);

    await logApiKeyUsage({
      apiKeyId: context.apiKey.id,
      endpoint: '/v1/embeddings',
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
 * OPTIONS /api/v1/embeddings
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
