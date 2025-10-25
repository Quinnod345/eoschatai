import { smoothStream, streamText } from 'ai';
import { createCustomProvider } from '@/lib/ai/providers';
import { createDocumentHandler } from '@/lib/composer/server';
import { inlineEditPrompt } from '@/lib/ai/prompts';

// Server-side VTO content creation and updates.
// The server streams a JSON payload between VTO_DATA_BEGIN/VTO_DATA_END markers
// so the client can parse and render a structured preview.

export const vtoDocumentHandler = createDocumentHandler<'vto'>({
  kind: 'vto',
  onCreateDocument: async ({ title, dataStream, maxTokens, context }) => {
    let draft = '';

    const provider = createCustomProvider();
    const system = `You are generating a Vision/Traction Organizer (V/TO) JSON for an EOS Worldwide template.

CRITICAL: If conversation context is provided, extract relevant company information (core values, goals, rocks, etc.) from it to populate the V/TO. Don't use generic placeholders if real data is available in the conversation.

You are generating a Vision/Traction Organizer (V/TO) JSON for an EOS Worldwide template.
Return STRICT JSON with the following shape and keys:
{
  "coreValues": string[],
  "coreFocus": { "purpose": string, "niche": string },
  "tenYearTarget": string,
  "marketingStrategy": {
    "targetMarket": string,
    "threeUniques": string[],
    "provenProcess": string,
    "guarantee": string
  },
  "threeYearPicture": {
    "futureDate": string,
    "revenue": string,
    "profit": string,
    "bullets": string[]
  },
  "oneYearPlan": {
    "futureDate": string,
    "revenue": string,
    "profit": string,
    "goals": string[]
  },
  "rocks": {
    "futureDate": string,
    "revenue"?: string,
    "profit"?: string,
    "rocks": Array<{ "title": string, "metric": string, "owner": string, "dueDate": string }>
  },
  "issuesList": string[]
}

SMART ROCKS REQUIREMENTS:
- For every rock in rocks.rocks, produce SMART fields by default:
  - title: Specific outcome (clear, action-oriented)
  - metric: Measurable statement that includes a target (e.g., "MQLs/week to 100")
  - owner: Single owner (role or name)
  - dueDate: Time-bound date (use the quarter end if not specified, formatted like "March 31, 2025" or "Q1 2025")
- Ensure at least 90% of rocks include all three: metric, owner, dueDate.

Do not include any prose outside JSON. Populate reasonable placeholders when the user doesn't specify values. Keep arrays between 3 and 10 items.`;

    const { fullStream } = streamText({
      model: provider.languageModel('composer-model'),
      system,
      maxTokens: Math.min(12000, Math.max(1000, maxTokens ?? 6000)),
      experimental_transform: smoothStream({ chunking: 'word' }),
      prompt:
        context && context.trim().length > 0
          ? `Create a V/TO for: ${title}\n\nConversation Context (extract V/TO data from this):\n${context}`
          : `Create a V/TO for: ${title}`,
    });

    // Wrap with markers so client can parse during streaming
    draft += 'VTO_DATA_BEGIN\n';
    dataStream.writeData({ type: 'text-delta', content: 'VTO_DATA_BEGIN\n' });

    for await (const delta of fullStream) {
      if (delta.type === 'text-delta') {
        draft += delta.textDelta;
        dataStream.writeData({ type: 'text-delta', content: delta.textDelta });
      }
    }

    draft += '\nVTO_DATA_END';
    dataStream.writeData({ type: 'text-delta', content: '\nVTO_DATA_END' });

    return draft;
  },
  onUpdateDocument: async ({
    document,
    description,
    dataStream,
    maxTokens,
  }) => {
    let draft = '';

    const provider = createCustomProvider();
    const system = inlineEditPrompt(document.content || '', description, 'vto');

    const { fullStream } = streamText({
      model: provider.languageModel('composer-model'),
      system,
      maxTokens: Math.min(12000, Math.max(800, maxTokens ?? 5000)),
      experimental_transform: smoothStream({ chunking: 'word' }),
      prompt: `Apply the requested edit to the VTO document.`,
    });

    // Check if the response already includes markers
    let responseContent = '';
    for await (const delta of fullStream) {
      if (delta.type === 'text-delta') {
        responseContent += delta.textDelta;
      }
    }

    // If the response already has markers, use it as-is
    if (
      responseContent.includes('VTO_DATA_BEGIN') &&
      responseContent.includes('VTO_DATA_END')
    ) {
      draft = responseContent;
      dataStream.writeData({ type: 'text-delta', content: responseContent });
    } else {
      // Otherwise, wrap the JSON with markers
      draft = `VTO_DATA_BEGIN\n${responseContent}\nVTO_DATA_END`;
      dataStream.writeData({ type: 'text-delta', content: draft });
    }

    return draft;
  },
});
