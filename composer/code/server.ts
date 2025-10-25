import { z } from 'zod';
import { streamObject } from 'ai';
import { createCustomProvider } from '@/lib/ai/providers';
import { codePrompt, inlineEditPrompt } from '@/lib/ai/prompts';
import { createDocumentHandler } from '@/lib/composer/server';

export const codeDocumentHandler = createDocumentHandler<'code'>({
  kind: 'code',
  onCreateDocument: async ({ title, dataStream, maxTokens, context }) => {
    let draftContent = '';

    const provider = createCustomProvider();
    const { fullStream } = streamObject({
      model: provider.languageModel('composer-model'),
      system: `${codePrompt}

CRITICAL: If conversation context is provided, use it to understand what code the user wants and include relevant details from the conversation.`,
      maxTokens: Math.min(12000, Math.max(1000, maxTokens ?? 6000)),
      prompt:
        context && context.trim().length > 0
          ? `${title}\n\nConversation Context:\n${context}`
          : title,
      schema: z.object({
        code: z.string(),
      }),
    });

    for await (const delta of fullStream) {
      const { type } = delta;

      if (type === 'object') {
        const { object } = delta;
        const { code } = object;

        if (code) {
          dataStream.writeData({
            type: 'code-delta',
            content: code ?? '',
          });

          draftContent = code;
        }
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
    const { fullStream } = streamObject({
      model: provider.languageModel('composer-model'),
      system: inlineEditPrompt(document.content || '', description, 'code'),
      maxTokens: Math.min(12000, Math.max(800, maxTokens ?? 5000)),
      prompt: `Please apply the requested edit: ${description}`,
      schema: z.object({
        code: z.string(),
      }),
    });

    for await (const delta of fullStream) {
      const { type } = delta;

      if (type === 'object') {
        const { object } = delta;
        const { code } = object;

        if (code) {
          dataStream.writeData({
            type: 'code-delta',
            content: code ?? '',
          });

          draftContent = code;
        }
      }
    }

    return draftContent;
  },
});
