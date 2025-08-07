import type { NextRequest } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { generateResearchPlan } from '@/lib/ai/nexus-query-generator';

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    const body = await request.json();
    const { query, model, attachments, regenerate, feedback } = body;

    if (!query) {
      return new Response('Query is required', { status: 400 });
    }

    console.log('[Nexus Plan] Generating research plan:', {
      query,
      model,
      hasAttachments: !!attachments?.length,
      isRegenerate: regenerate,
      hasFeedback: !!feedback,
    });

    // Build context from query and attachments
    let enrichedQuery = query;
    if (attachments?.length > 0) {
      const fileContext = attachments
        .map((att: any) => {
          if (att.type === 'text') {
            return `File: ${att.name}\nContent: ${att.content}`;
          }
          return `File: ${att.name} (${att.type})`;
        })
        .join('\n\n');

      enrichedQuery = `${query}\n\nContext from uploaded files:\n${fileContext}`;
    }

    // Add feedback if regenerating
    if (regenerate && feedback) {
      enrichedQuery = `${enrichedQuery}\n\nUser feedback on previous plan: ${feedback}`;
    }

    // Generate the research plan using AI
    const researchPlan = await generateResearchPlan({
      userQuery: enrichedQuery,
      model: model || 'gpt-4o-mini',
      domain: null,
      userIntent: null,
    });

    // Calculate total search count
    const totalSearchCount = researchPlan.phases.reduce(
      (total, phase) => total + phase.queries.length,
      0,
    );

    // Return the plan for user review
    return Response.json({
      success: true,
      plan: {
        ...researchPlan,
        mainQuery: researchPlan.mainObjective,
        subQuestions: researchPlan.researchQuestions,
        searchQueries: researchPlan.searchQueries.map((q) => q.query),
        researchApproach: researchPlan.searchStrategy.depth,
        totalSearches: totalSearchCount,
        estimatedDuration: researchPlan.estimatedDuration,
        estimatedCredits: researchPlan.estimatedCredits,
      },
      totalSearches: totalSearchCount,
      phases: researchPlan.phases,
    });
  } catch (error) {
    console.error('[Nexus Plan] Error generating plan:', error);
    return Response.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to generate research plan',
      },
      { status: 500 },
    );
  }
}
