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
    maxTokens,
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

CONTEXT:
${companyCtx}

${userRag}

${kbRagSection}`;
    } catch (err) {
      // Fallback to minimal EOS composer context if any retrieval fails
      systemContext = `${composerPrompt}

STRICT OUTPUT INSTRUCTIONS:
- Generate only the document content in Markdown.
- No meta commentary or assistant statements.`;
    }

    const provider = createCustomProvider();
    const { fullStream } = streamText({
      model: provider.languageModel('composer-model'),
      // Include systemContext and user-provided chat context
      system: systemContext,
      maxTokens: Math.min(12000, Math.max(1000, maxTokens ?? 6000)),
      experimental_transform: smoothStream({ chunking: 'word' }),
      // Use title plus context (if provided) to guide content generation
      prompt:
        context && context.trim().length > 0
          ? `${title}\n\nContext:\n${context}`
          : title,
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
        const { textDelta } = delta;
        const cleaned = scrubMeta(textDelta);
        if (cleaned.length === 0) continue;

        draftContent += cleaned;

        dataStream.writeData({
          type: 'text-delta',
          content: cleaned,
        });
      }
    }

    return draftContent;
  },
  onUpdateDocument: async ({
    document,
    description,
    dataStream,
    maxTokens,
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
      maxTokens: Math.min(12000, Math.max(800, maxTokens ?? 5000)),
      experimental_transform: smoothStream({ chunking: 'word' }),
      prompt: `Please apply the requested edit: ${description}`,
      experimental_providerMetadata: {
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
        const { textDelta } = delta;
        const cleaned = scrubMeta(textDelta);
        if (cleaned.length === 0) continue;

        draftContent += cleaned;
        dataStream.writeData({
          type: 'text-delta',
          content: cleaned,
        });
      }
    }

    return draftContent;
  },
});
