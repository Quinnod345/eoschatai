import { createCustomProvider } from '@/lib/ai/providers';
import { sheetPrompt, inlineEditPrompt } from '@/lib/ai/prompts';
import { createDocumentHandler } from '@/lib/composer/server';
import { generateId, streamObject } from 'ai';
import { z } from 'zod/v3';

export const sheetDocumentHandler = createDocumentHandler<'sheet'>({
  kind: 'sheet',
  onCreateDocument: async ({ title, dataStream, maxOutputTokens, context }) => {
    let draftContent = '';

    const provider = createCustomProvider();
    const { fullStream } = streamObject({
      model: provider.languageModel('composer-model'),
      system: `${sheetPrompt}

CRITICAL: If conversation context is provided, extract relevant data from it to populate the spreadsheet. Don't create sample data - use actual information from the conversation.`,
      maxOutputTokens: Math.min(12000, Math.max(1000, maxOutputTokens ?? 6000)),
      prompt:
        context && context.trim().length > 0
          ? `${title}\n\nConversation Context (extract data from this):\n${context}`
          : title,
      schema: z.object({
        csv: z.string().describe('CSV data'),
      }),
    });

    for await (const delta of fullStream) {
      const { type } = delta;

      if (type === 'object') {
        const { object } = delta;
        const { csv } = object;

        if (csv) {
          dataStream.write({
            type: 'data-composer',
            id: generateId(),
            data: {
              type: 'sheet-delta',
              content: csv,
            }
          });

          draftContent = csv;
        }
      }
    }

    dataStream.write({
      type: 'data-composer',
      id: generateId(),
      data: {
        type: 'sheet-delta',
        content: draftContent,
      }
    });

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
    const { fullStream } = streamObject({
      model: provider.languageModel('composer-model'),
      system: inlineEditPrompt(document.content || '', description, 'sheet'),
      maxOutputTokens: Math.min(12000, Math.max(800, maxOutputTokens ?? 5000)),
      prompt: `Please apply the requested edit: ${description}`,
      schema: z.object({
        csv: z.string(),
      }),
    });

    for await (const delta of fullStream) {
      const { type } = delta;

      if (type === 'object') {
        const { object } = delta;
        const { csv } = object;

        if (csv) {
          dataStream.write({
            type: 'data-composer',
            id: generateId(),
            data: {
              type: 'sheet-delta',
              content: csv,
            }
          });

          draftContent = csv;
        }
      }
    }

    return draftContent;
  },
});
