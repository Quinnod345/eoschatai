/**
 * Deep Research API Route
 *
 * Standalone endpoint for deep research mode. Accepts the user query,
 * orchestrates multi-phase research, and streams progress events + final report
 * back to the client using the AI SDK's UIMessageStream protocol.
 *
 * POST /api/chat/deep-research
 * Body: { id: string, query: string }
 *
 * This route is called by the main chat route when nexus mode is detected,
 * OR directly by the client for dedicated deep research sessions.
 */

import {
  createUIMessageStream,
  createUIMessageStreamResponse,
} from 'ai';
import { auth } from '@/app/(auth)/auth';
import { generateUUID } from '@/lib/utils';
import { runDeepResearch } from '@/lib/ai/deep-research/orchestrator';
import type { DeepResearchWriter } from '@/lib/ai/deep-research/orchestrator';
import type { DeepResearchConfig } from '@/lib/ai/deep-research/types';
import { DEFAULT_DEEP_RESEARCH_CONFIG } from '@/lib/ai/deep-research/types';

export const maxDuration = 300; // 5 minutes max for deep research

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  let body: { id: string; query: string; config?: Partial<DeepResearchConfig> };
  try {
    body = await request.json();
  } catch {
    return new Response('Invalid request body', { status: 400 });
  }

  const { query, config: configOverrides } = body;

  if (!query || typeof query !== 'string') {
    return new Response('Missing or invalid query', { status: 400 });
  }

  const config: DeepResearchConfig = {
    ...DEFAULT_DEEP_RESEARCH_CONFIG,
    ...configOverrides,
  };

  console.log('[DeepResearch API] Starting deep research:', {
    userId: session.user.id,
    queryLength: query.length,
    config: {
      concurrency: config.concurrency,
      maxTotalQueries: config.maxTotalQueries,
      maxFollowUpIterations: config.maxFollowUpIterations,
    },
  });

  const responseStream = createUIMessageStream({
    execute: async ({ writer }) => {
      // Create the deep research writer adapter that bridges
      // the orchestrator's output to the AI SDK stream format
      const deepResearchWriter: DeepResearchWriter = {
        writeProgress(event) {
          writer.write({
            type: 'data-custom',
            id: generateUUID(),
            transient: true,
            data: event,
          } as any);
        },

        writeText(text) {
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
      };

      // Run the deep research orchestrator
      await runDeepResearch(query, deepResearchWriter, config);
    },
  });

  return createUIMessageStreamResponse({ stream: responseStream });
}
