/**
 * EOSAI Public API - Models
 *
 * List available models for the EOSAI API.
 * OpenAI-compatible endpoint.
 */

import { type NextRequest, NextResponse } from 'next/server';
import {
  validateApiRequest,
  addRateLimitHeaders,
  generateRequestId,
} from '@/lib/api/middleware';
import { logApiKeyUsage } from '@/lib/api/keys';

// Available models with their metadata
const MODELS = [
  {
    id: 'eosai-v1',
    object: 'model',
    created: 1706140800, // 2024-01-25
    owned_by: 'eosai',
    description: 'Default EOSAI model - Best balance of speed and quality for EOS guidance',
    context_window: 200000,
    max_output_tokens: 4096,
    capabilities: ['chat', 'eos_rag'],
  },
  {
    id: 'eosai-v1-fast',
    object: 'model',
    created: 1706140800,
    owned_by: 'eosai',
    description: 'Fast EOSAI model - Optimized for quick responses',
    context_window: 200000,
    max_output_tokens: 4096,
    capabilities: ['chat', 'eos_rag'],
  },
  {
    id: 'eosai-v1-pro',
    object: 'model',
    created: 1706140800,
    owned_by: 'eosai',
    description: 'Pro EOSAI model - Enhanced reasoning for complex EOS scenarios',
    context_window: 200000,
    max_output_tokens: 16384,
    capabilities: ['chat', 'eos_rag', 'extended_thinking'],
  },
];

// EOS knowledge namespaces available for RAG
const EOS_NAMESPACES = [
  {
    id: 'eos-implementer',
    name: 'EOS Implementer',
    description: 'General EOS implementation knowledge',
  },
  {
    id: 'eos-implementer-quarterly-session',
    name: 'Quarterly Session',
    description: 'Quarterly planning and review session facilitation',
  },
  {
    id: 'eos-implementer-focus-day',
    name: 'Focus Day',
    description: 'Focus Day facilitation and exercises',
  },
  {
    id: 'eos-implementer-vision-day-1',
    name: 'Vision Building Day 1',
    description: 'Vision Building Day 1 facilitation',
  },
  {
    id: 'eos-implementer-vision-day-2',
    name: 'Vision Building Day 2',
    description: 'Vision Building Day 2 facilitation',
  },
];

/**
 * GET /api/v1/models
 * List available models
 */
export async function GET(request: NextRequest) {
  const requestId = generateRequestId();
  const startTime = Date.now();

  // Validate API key (but don't require specific scopes for listing models)
  const validation = await validateApiRequest(request, []);
  if ('error' in validation) {
    return validation.error;
  }
  const context = validation.context;

  // Filter models based on API key's allowed models
  const allowedModels = context.apiKey.allowedModels as string[] | null;
  const availableModels = allowedModels
    ? MODELS.filter((m) => allowedModels.includes(m.id))
    : MODELS;

  // Log usage
  await logApiKeyUsage({
    apiKeyId: context.apiKey.id,
    endpoint: '/v1/models',
    method: 'GET',
    statusCode: 200,
    responseTimeMs: Date.now() - startTime,
  });

  // Build OpenAI-compatible response with additional EOSAI metadata
  const responseBody = {
    object: 'list',
    data: availableModels,
    // EOSAI-specific: Include available knowledge namespaces
    eos_namespaces: EOS_NAMESPACES,
  };

  const response = NextResponse.json(responseBody, {
    headers: {
      'X-Request-ID': requestId,
    },
  });

  return addRateLimitHeaders(response, context);
}

/**
 * OPTIONS /api/v1/models
 * Handle CORS preflight
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
      'Access-Control-Max-Age': '86400',
    },
  });
}
