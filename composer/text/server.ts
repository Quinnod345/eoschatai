import { smoothStream, streamText } from 'ai';
import { createCustomProvider } from '@/lib/ai/providers';
import { createDocumentHandler } from '@/lib/composer/server';
import {
  inlineEditPrompt,
  composerPrompt,
  regularPrompt,
  userRagContextPrompt,
  ragContextPrompt,
  companyContextPrompt,
} from '@/lib/ai/prompts';
import { findRelevantContent } from '@/lib/ai/embeddings';

export const textDocumentHandler = createDocumentHandler<'text'>({
  kind: 'text',
  onCreateDocument: async ({ title, dataStream, session, maxTokens }) => {
    let draftContent = '';

    // Build rich EOS-aware context for artifact generation (no hardcoded detection)
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

      systemContext = `${regularPrompt}

${composerPrompt}

${companyCtx}

${userRag}

${kbRagSection}`;
    } catch (err) {
      // Fallback to minimal EOS composer context if any retrieval fails
      systemContext = `${regularPrompt}

${composerPrompt}`;
    }

    const provider = createCustomProvider();
    const { fullStream } = streamText({
      model: provider.languageModel('composer-model'),
      system: systemContext,
      maxTokens: Math.min(12000, Math.max(1000, maxTokens ?? 6000)),
      experimental_transform: smoothStream({ chunking: 'word' }),
      prompt: title,
    });

    for await (const delta of fullStream) {
      const { type } = delta;

      if (type === 'text-delta') {
        const { textDelta } = delta;

        draftContent += textDelta;

        dataStream.writeData({
          type: 'text-delta',
          content: textDelta,
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

    for await (const delta of fullStream) {
      const { type } = delta;

      if (type === 'text-delta') {
        const { textDelta } = delta;

        draftContent += textDelta;
        dataStream.writeData({
          type: 'text-delta',
          content: textDelta,
        });
      }
    }

    return draftContent;
  },
});
