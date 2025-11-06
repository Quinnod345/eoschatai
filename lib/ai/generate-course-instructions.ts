/**
 * Generate AI-powered persona instructions based on actual course content
 * Uses GPT-4.1 to create customized instructions from course lessons
 */

import { openai } from '@ai-sdk/openai';
import { generateText, embed } from 'ai';
import { Index } from '@upstash/vector';

interface CourseContent {
  courseName: string;
  courseDescription: string;
  lessons: Array<{
    title: string;
    content: string;
  }>;
  targetAudience: 'implementer' | 'client';
}

/**
 * Generate persona instructions using GPT-4.1 nano based on course content
 */
export async function generateCourseInstructions(
  courseContent: CourseContent,
): Promise<string> {
  try {
    console.log(
      `[Course Instructions] Generating AI instructions for "${courseContent.courseName}" (${courseContent.lessons.length} lessons)`,
    );

    // Create a summary of course content for the prompt
    const lessonSummaries = courseContent.lessons
      .slice(0, 20) // Use first 20 lessons to stay within token limits
      .map((lesson, idx) => {
        const content =
          typeof lesson.content === 'string' ? lesson.content : '';
        const preview = content.substring(0, 500);
        return `Lesson ${idx + 1}: ${lesson.title}\n${preview}${preview.length >= 500 ? '...' : ''}`;
      })
      .join('\n\n');

    const audienceContext =
      courseContent.targetAudience === 'implementer'
        ? 'EOS implementers who facilitate and coach leadership teams'
        : 'leadership teams and business owners implementing EOS';

    const prompt = `You are creating specialized AI persona instructions for a course assistant.

COURSE: "${courseContent.courseName}"
DESCRIPTION: ${courseContent.courseDescription || 'No description'}
TARGET AUDIENCE: ${audienceContext}

SAMPLE LESSONS:
${lessonSummaries}

Create detailed AI persona instructions that will guide the assistant's behavior. The instructions should:

1. Define the persona's role as a course assistant for this specific course
2. Emphasize expertise in the topics covered in the lessons
3. Set the appropriate tone for the target audience (${courseContent.targetAudience === 'implementer' ? 'professional, coaching-oriented' : 'clear, accessible, practical'})
4. Instruct the AI to reference course content when answering questions
5. Emphasize accuracy and helpfulness
6. Include EOS-specific terminology and context where relevant

FORMAT: Write clear, direct instructions as if briefing an expert assistant. Use "You are..." language.
LENGTH: 800-1200 characters (comprehensive but concise)

Generate the persona instructions now:`;

    const { text } = await generateText({
      model: openai('gpt-4.1-mini'), // Using gpt-4.1-mini for instruction generation
      prompt,
      maxTokens: 600,
      temperature: 0.7,
    });

    console.log(
      `[Course Instructions] Generated ${text.length} characters of instructions`,
    );

    return text.trim();
  } catch (error) {
    console.error(
      '[Course Instructions] Error generating instructions:',
      error,
    );

    // Fallback to template-based instructions
    const { getCourseInstructions } = await import(
      './course-persona-templates'
    );
    return getCourseInstructions(
      courseContent.courseName,
      courseContent.targetAudience,
    );
  }
}

/**
 * Generate persona instructions from RAG database using GPT-4.1
 * Queries the Upstash namespace to get actual course content, then generates instructions
 */
export async function generateInstructionsFromRAG(params: {
  namespace: string;
  courseName: string;
  courseDescription: string;
  targetAudience: 'implementer' | 'client';
}): Promise<{ instructions: string; contentFound: boolean }> {
  try {
    console.log(
      `[RAG Instructions] Generating instructions from Upstash namespace: ${params.namespace}`,
    );

    // Initialize Upstash client
    const upstashUrl = process.env.UPSTASH_USER_RAG_REST_URL;
    const upstashToken = process.env.UPSTASH_USER_RAG_REST_TOKEN;

    if (!upstashUrl || !upstashToken) {
      throw new Error('Missing Upstash environment variables');
    }

    const upstashClient = new Index({
      url: upstashUrl,
      token: upstashToken,
    });

    const namespaceClient = upstashClient.namespace(params.namespace);

    // Query the RAG database for representative course content
    // Use a diverse set of queries to get broad coverage
    const queries = [
      `${params.courseName} overview and introduction`,
      `${params.courseName} key concepts and topics`,
      `${params.courseName} learning objectives`,
    ];

    const embeddingModel = openai.embedding('text-embedding-ada-002');
    const allContent: string[] = [];

    for (const query of queries) {
      const { embedding } = await embed({
        model: embeddingModel,
        value: query,
      });

      const results = await namespaceClient.query({
        vector: embedding,
        topK: 5, // Get top 5 chunks per query
        includeMetadata: true,
        includeVectors: false,
      });

      if (results && results.length > 0) {
        results.forEach((result: any) => {
          const chunk = result.metadata?.chunk;
          if (chunk && typeof chunk === 'string') {
            allContent.push(chunk);
          }
        });
      }
    }

    console.log(
      `[RAG Instructions] Retrieved ${allContent.length} content chunks from RAG`,
    );

    if (allContent.length === 0) {
      console.error(
        '[RAG Instructions] No content found in namespace - course not synced',
      );
      throw new Error('No content found in RAG database');
    }

    // Combine and deduplicate content
    const uniqueContent = Array.from(new Set(allContent));
    const contentSample = uniqueContent
      .slice(0, 10) // Use top 10 unique chunks
      .join('\n\n---\n\n')
      .substring(0, 8000); // Limit to 8K chars for GPT prompt

    const audienceContext =
      params.targetAudience === 'implementer'
        ? 'EOS implementers who facilitate and coach leadership teams'
        : 'leadership teams and business owners implementing EOS';

    const prompt = `You are creating specialized AI persona instructions for a course assistant.

COURSE: "${params.courseName}"
DESCRIPTION: ${params.courseDescription || 'Professional training course'}
TARGET AUDIENCE: ${audienceContext}

ACTUAL COURSE CONTENT FROM THE RAG DATABASE:
${contentSample}

Based on the ACTUAL course content above, create detailed AI persona instructions that will guide the assistant's behavior. The instructions should:

1. Define the persona's role as an expert assistant for this specific course
2. Emphasize expertise in the actual topics and concepts covered (reference specific content from above)
3. Set the appropriate tone for the target audience (${params.targetAudience === 'implementer' ? 'professional, coaching-oriented, expert-level' : 'clear, accessible, practical, beginner-friendly'})
4. Instruct the AI to reference course materials when answering questions
5. Include key terminology and frameworks from the course content
6. Emphasize accuracy and provide actionable guidance

FORMAT: Write clear, direct instructions as if briefing an expert assistant. Use "You are..." language.
LENGTH: 1000-1500 characters (comprehensive and detailed)
TONE: Professional and authoritative

Generate the persona instructions now:`;

    console.log(
      '[RAG Instructions] Calling GPT-4.1 to generate instructions...',
    );

    const { text } = await generateText({
      model: openai('gpt-4o'), // Using GPT-4.1 (latest)
      prompt,
      maxTokens: 800,
      temperature: 0.7,
    });

    console.log(
      `[RAG Instructions] ✅ Generated ${text.length} characters of AI instructions from RAG content`,
    );

    return {
      instructions: text.trim(),
      contentFound: true,
    };
  } catch (error) {
    console.error('[RAG Instructions] Error generating from RAG:', error);

    // If error is due to missing content, return contentFound: false
    if (
      error instanceof Error &&
      error.message.includes('No content found in RAG')
    ) {
      return {
        instructions: '',
        contentFound: false,
      };
    }

    // For other errors, fallback to template-based instructions
    const { getCourseInstructions } = await import(
      './course-persona-templates'
    );
    return {
      instructions: getCourseInstructions(
        params.courseName,
        params.targetAudience,
      ),
      contentFound: false, // Using fallback, not RAG
    };
  }
}
