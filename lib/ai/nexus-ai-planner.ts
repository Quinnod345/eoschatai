import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';

// Schema for a research question
const ResearchQuestionSchema = z.object({
  question: z.string().describe('The specific question to research'),
  context: z
    .string()
    .describe('Why this question is important for the overall query'),
  searchQuery: z.string().describe('The optimized search query for Firecrawl'),
});

// Schema for a research step
const ResearchStepSchema = z.object({
  stepNumber: z.number(),
  stepTitle: z
    .string()
    .describe('Clear title describing what this step investigates'),
  objective: z.string().describe('What we aim to learn in this step'),
  questions: z.array(ResearchQuestionSchema).min(1).max(3),
});

// Schema for the complete research plan
const ResearchPlanSchema = z.object({
  mainObjective: z.string().describe('The primary goal of this research'),
  steps: z.array(ResearchStepSchema).min(2).max(5),
  expectedOutcome: z
    .string()
    .describe('What the user will learn from this research'),
});

export type ResearchPlan = z.infer<typeof ResearchPlanSchema>;
export type ResearchStep = z.infer<typeof ResearchStepSchema>;
export type ResearchQuestion = z.infer<typeof ResearchQuestionSchema>;

/**
 * Generate a dynamic research plan based on the user's query
 */
export async function generateResearchPlan(
  userQuery: string,
): Promise<ResearchPlan> {
  try {
    console.log('[Nexus AI Planner] Generating research plan for:', userQuery);

    const systemPrompt = `You are an expert research planner. Create a comprehensive research plan that:
1. Breaks down complex queries into logical research steps
2. Each step should build upon previous steps
3. Questions should be specific and searchable
4. Search queries should be optimized for web search

Guidelines:
- Create 2-5 research steps based on query complexity
- Each step should have 1-3 specific questions
- Questions should progressively deepen understanding
- Search queries should be natural and specific
- Consider different angles: basics, implementation, best practices, challenges, examples

IMPORTANT: The response must have this exact structure:
{
  "mainObjective": "The primary goal",
  "steps": [array of step objects],
  "expectedOutcome": "What the user will learn"
}
Do NOT put expectedOutcome inside any step object.`;

    const result = await generateObject({
      model: openai('gpt-4o-mini'),
      schema: ResearchPlanSchema,
      system: systemPrompt,
      prompt: `Create a detailed research plan for: "${userQuery}"`,
      temperature: 0.7,
    });

    console.log(
      '[Nexus AI Planner] Generated plan with',
      result.object.steps.length,
      'steps',
    );
    return result.object;
  } catch (error) {
    console.error('[Nexus AI Planner] Error generating plan:', error);
    // Return a simple fallback plan
    return {
      mainObjective: `Research: ${userQuery}`,
      steps: [
        {
          stepNumber: 1,
          stepTitle: 'Understanding the Basics',
          objective: 'Learn fundamental concepts and definitions',
          questions: [
            {
              question: `What is ${userQuery}?`,
              context: 'Understanding the basic definition and concepts',
              searchQuery: userQuery,
            },
          ],
        },
        {
          stepNumber: 2,
          stepTitle: 'Practical Applications',
          objective: 'Explore how to apply this knowledge',
          questions: [
            {
              question: `How to implement ${userQuery}?`,
              context: 'Finding practical implementation guidance',
              searchQuery: `${userQuery} implementation guide examples`,
            },
          ],
        },
      ],
      expectedOutcome: `Comprehensive understanding of ${userQuery}`,
    };
  }
}
