import { smoothStream, streamText } from 'ai';
import { createCustomProvider } from '@/lib/ai/providers';
import { createDocumentHandler } from '@/lib/composer/server';
import {
  inlineEditPrompt,
  composerPrompt,
  userRagContextPrompt,
  ragContextPrompt,
  companyContextPrompt,
} from '@/lib/ai/prompts';
import { findRelevantContent } from '@/lib/ai/embeddings';

export const textDocumentHandler = createDocumentHandler<'text'>({
  kind: 'text',
  onCreateDocument: async ({
    title,
    dataStream,
    session,
    maxOutputTokens,
    context,
  }) => {
    let draftContent = '';

    // Build rich EOS-aware context for artifact generation (content-only output)
    let systemContext = '';
    try {
      const userId = session?.user?.id || '';

      const [userRag, companyCtx, kbRag] = await Promise.all([
        userId ? userRagContextPrompt(userId, title) : Promise.resolve(''),
        userId ? companyContextPrompt(userId) : Promise.resolve(''),
        findRelevantContent(title, 5).catch(() => []),
      ]);

      const kbRagSection =
        Array.isArray(kbRag) && kbRag.length > 0 ? ragContextPrompt(kbRag) : '';

      systemContext = `${composerPrompt}

STRICT OUTPUT INSTRUCTIONS:
- You are generating the final document content only.
- Do NOT include meta commentary, assistant chatter, or statements like "I'll create a document" or "I'll add this".
- Do NOT repeat the user's request.
- Return pure Markdown suitable for saving directly to the document (no code fences unless it is a code block, no system messages).

🔥 CRITICAL CONTENT USAGE INSTRUCTIONS:
- If conversation context is provided below, you MUST extract and use the relevant information to populate the document.
- When the user says "put all these questions into a document" or similar, extract the ACTUAL questions/content from the conversation.
- If the conversation contains web search results (from searchWeb tool), you MUST use that content in the document.
- Extract and synthesize the actual information - don't just reference that information exists.
- Structure the document with clear headings, bullet points, and well-organized information.
- Include specific details, facts, and data from the conversation and search results.
- DO NOT write meta-messages like "I've created a document" or "Here's what I found" - write the actual content directly.
- If the conversation shows questions being asked and answered, include those ACTUAL questions and answers in the document.

CONTEXT:
${companyCtx}

${userRag}

${kbRagSection}`;
    } catch (err) {
      // Fallback to minimal EOS composer context if any retrieval fails
      systemContext = `${composerPrompt}

STRICT OUTPUT INSTRUCTIONS:
- Generate only the document content in Markdown.
- No meta commentary or assistant statements.
- If conversation context or web search results are available, USE them to populate the document with actual content.
- Extract real questions, answers, data, and information from the context provided.`;
    }

    const provider = createCustomProvider();
    const { fullStream } = streamText({
      model: provider.languageModel('composer-model'),
      // Include systemContext and user-provided chat context
      system: systemContext,
      maxOutputTokens: Math.min(12000, Math.max(1000, maxTokens ?? 6000)),
      experimental_transform: smoothStream({ chunking: 'word' }),
      // Use title plus context (if provided) to guide content generation
      prompt:
        context && context.trim().length > 0
          ? `Create a document titled "${title}".

CRITICAL: Use the conversation context below to populate the document with ACTUAL content. Don't just create a template or outline - extract and include the real information, questions, answers, and data from the conversation.

Conversation Context:
${context}

Generate the document content now (pure Markdown, no meta-commentary):`
          : `Create a document titled "${title}" (pure Markdown, no meta-commentary):`,
    });

    const scrubMeta = (text: string) =>
      text
        // Remove common meta lines the model might emit
        .replace(/\bI(?:’|')ll create a document[^\n]*\n?/gi, '')
        .replace(/\bI will create a document[^\n]*\n?/gi, '')
        .replace(/\bI(?:’|')ll add[^\n]*\n?/gi, '')
        .replace(/\bLet me (?:create|write|add)[^\n]*\n?/gi, '');

    for await (const delta of fullStream) {
      const { type } = delta;

      if (type === 'text-delta') {
        const { text: textDelta } = delta;
        const cleaned = scrubMeta(textDelta);
        if (cleaned.length === 0) continue;

        draftContent += cleaned;

        dataStream.write({
          'type': 'data',

          'value': [{
            type: 'text-delta',
            content: cleaned,
          }]
        });
      }
    }

    return draftContent;
  },
  onUpdateDocument: async ({
    document,
    description,
    dataStream,
    maxOutputTokens,
  }) => {
    let draftContent = '';

    const provider = createCustomProvider();
    const { fullStream } = streamText({
      model: provider.languageModel('composer-model'),
      system: `${composerPrompt}

STRICT OUTPUT INSTRUCTIONS:
- Apply the edit and return only the updated document content.
- Do NOT include meta commentary or assistant statements.

${inlineEditPrompt(document.content || '', description, 'text')}`,
      maxOutputTokens: Math.min(12000, Math.max(800, maxTokens ?? 5000)),
      experimental_transform: smoothStream({ chunking: 'word' }),
      prompt: `Please apply the requested edit: ${description}`,
      providerOptions: {
        openai: {
          prediction: {
            type: 'content',
            content: document.content,
          },
        },
      },
    });

    const scrubMeta = (text: string) =>
      text
        .replace(/\bI(?:’|')ll create a document[^\n]*\n?/gi, '')
        .replace(/\bI will create a document[^\n]*\n?/gi, '')
        .replace(/\bI(?:’|')ll add[^\n]*\n?/gi, '')
        .replace(/\bLet me (?:create|write|add)[^\n]*\n?/gi, '');

    for await (const delta of fullStream) {
      const { type } = delta;

      if (type === 'text-delta') {
        const { text: textDelta } = delta;
        const cleaned = scrubMeta(textDelta);
        if (cleaned.length === 0) continue;

        draftContent += cleaned;
        dataStream.write({
          'type': 'data',

          'value': [{
            type: 'text-delta',
            content: cleaned,
          }]
        });
      }
    }

    return draftContent;
  },
});
