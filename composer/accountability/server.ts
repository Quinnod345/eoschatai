import { createDocumentHandler } from '@/lib/composer/server';
import { smoothStream, streamText } from 'ai';
import { createCustomProvider } from '@/lib/ai/providers';

export interface SeatNode {
  id: string;
  name: string;
  holder: string;
  roles: string[];
  children: SeatNode[];
  accent?: string;
}

export interface AccountabilityChartData {
  version: number;
  title?: string;
  root: SeatNode;
}

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

function defaultChart(title?: string): AccountabilityChartData {
  return {
    version: 1,
    title:
      title ||
      `${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} Accountability Chart`,
    root: {
      id: generateId(),
      name: 'VISIONARY',
      holder: 'Seat Holder',
      roles: [
        'Define the vision',
        'Build key relationships',
        'Solve big problems',
        'Create company culture',
      ],
      accent: '#3b82f6',
      children: [
        {
          id: generateId(),
          name: 'INTEGRATOR',
          holder: 'Seat Holder',
          roles: [
            'Lead the leadership team',
            'Execute the vision',
            'Hold people accountable',
            'Resolve issues',
          ],
          accent: '#3b82f6',
          children: [
            {
              id: generateId(),
              name: 'MARKETING/SALES',
              holder: 'Seat Holder',
              roles: [
                'Generate demand',
                'Convert leads to customers',
                'Retain customers',
                'Build brand',
              ],
              accent: '#3b82f6',
              children: [],
            },
            {
              id: generateId(),
              name: 'OPERATIONS',
              holder: 'Seat Holder',
              roles: [
                'Deliver the product/service',
                'Ensure quality',
                'Optimize processes',
                'Manage resources',
              ],
              accent: '#3b82f6',
              children: [],
            },
            {
              id: generateId(),
              name: 'FINANCE',
              holder: 'Seat Holder',
              roles: [
                'Manage cash flow',
                'Financial reporting',
                'Budget planning',
                'Risk management',
              ],
              accent: '#3b82f6',
              children: [],
            },
          ],
        },
      ],
    },
  };
}

export const accountabilityDocumentHandler =
  createDocumentHandler<'accountability'>({
    kind: 'accountability',
    onCreateDocument: async ({ title, dataStream, maxOutputTokens, context }) => {
      // Stream STRICT JSON for the Accountability Chart between markers (AI decides structure/content)
      const provider = createCustomProvider();
      const system = `You are generating an EOS Accountability Chart JSON. Return STRICT JSON with this shape:
{
  "version": number,
  "title": string,
  "root": {
    "id": string,
    "name": string,
    "holder": string,
    "roles": string[],
    "accent"?: string,
    "children": Array<SeatNode>
  }
}
Rules:
- Do not include any prose outside JSON.
- MANDATORY: Always include a "title" field with type string. This is REQUIRED.
- The title field MUST be included at the top level of the JSON object.
- Use the exact title provided in the prompt.
- Populate reasonable placeholders when unspecified.
- Use stable ids (random ok) for seats.
- Structure should be a valid EOS chart (Visionary, Integrator, major functions) unless the user specifies otherwise.`;

      const { fullStream } = streamText({
        model: provider.languageModel('composer-model'),
        system,
        maxOutputTokens: Math.min(12000, Math.max(1000, maxTokens ?? 6000)),
        experimental_transform: smoothStream({ chunking: 'word' }),
        prompt: `Create an Accountability Chart JSON.
CRITICAL: The JSON must include "title": "${title || 'Accountability Chart'}".
User request context (follow precisely, including any requested counts): ${context || 'N/A'}
Do not assume any number of seats; use the user's instructions. Keep JSON compact and strictly valid.`,
      });

      let draft = 'AC_DATA_BEGIN\n';
      dataStream.write({
        'type': 'data',
        'value': [{ type: 'text-delta', content: 'AC_DATA_BEGIN\n' }]
      });

      for await (const delta of fullStream) {
        if (delta.type === 'text-delta') {
          draft += delta.text;
          dataStream.write({
            'type': 'data',

            'value': [{
              type: 'text-delta',
              content: delta.text,
            }]
          });
        }
      }

      draft += '\nAC_DATA_END';
      dataStream.write({
        'type': 'data',
        'value': [{ type: 'text-delta', content: '\nAC_DATA_END' }]
      });
      return draft;
    },
    onUpdateDocument: async ({
      document,
      description,
      dataStream,
      maxOutputTokens,
    }) => {
      // Inline AI edit for Accountability JSON; model decides changes based on description.
      const provider = createCustomProvider();
      const current = document.content || '';
      const system = `You are editing an EOS Accountability Chart JSON inline.\n\nRules:\n- Preserve existing JSON structure and fields not mentioned.\n- Apply ONLY the requested change.\n- Return STRICT JSON only. No prose.\n\nEdit request: "${description}"\n\nCurrent content (may include AC_DATA markers):\n${current}`;

      const { fullStream } = streamText({
        model: provider.languageModel('composer-model'),
        system,
        maxOutputTokens: Math.min(12000, Math.max(800, maxTokens ?? 5000)),
        experimental_transform: smoothStream({ chunking: 'word' }),
        prompt: `Apply the requested edit to the Accountability Chart JSON and return only JSON.`,
      });

      let responseContent = '';
      for await (const delta of fullStream) {
        if (delta.type === 'text-delta') {
          responseContent += delta.text;
        }
      }

      if (
        responseContent.includes('AC_DATA_BEGIN') &&
        responseContent.includes('AC_DATA_END')
      ) {
        dataStream.write({
          'type': 'data',
          'value': [{ type: 'text-delta', content: responseContent }]
        });
        return responseContent;
      }

      const wrapped = `AC_DATA_BEGIN\n${responseContent}\nAC_DATA_END`;
      dataStream.write({
        'type': 'data',
        'value': [{ type: 'text-delta', content: wrapped }]
      });
      return wrapped;
    },
  });
