import { generateId, streamObject } from 'ai';
import { z } from 'zod/v3';
import { createCustomProvider } from '@/lib/ai/providers';
import { createDocumentHandler } from '@/lib/composer/server';

// Zod schema for VTO Rock
const vtoRockSchema = z.object({
  title: z.string().describe('Specific outcome (clear, action-oriented)'),
  metric: z.string().describe('Measurable target (e.g., "MQLs/week to 100")'),
  owner: z.string().describe('Single owner (role or name)'),
  dueDate: z.string().describe('Time-bound date (e.g., "March 31, 2026")'),
});

// Zod schema for VTO
// NOTE: Anthropic API only supports minItems of 0 or 1, so we use descriptions to guide output
const vtoSchema = z.object({
  coreValues: z.array(z.string()).describe('Company core values (provide 3-5 values)'),
  coreFocus: z.object({
    purpose: z.string().describe('Company purpose/cause/passion'),
    niche: z.string().describe('Company niche'),
  }),
  tenYearTarget: z.string().describe('10-year BHAG target'),
  marketingStrategy: z.object({
    targetMarket: z.string().describe('Target market description'),
    threeUniques: z.array(z.string()).describe('Exactly three unique differentiators'),
    provenProcess: z.string().describe('Proven process name'),
    guarantee: z.string().describe('Company guarantee'),
  }),
  threeYearPicture: z.object({
    futureDate: z.string().describe('Date 3 years from now'),
    revenue: z.string().describe('Revenue target'),
    profit: z.string().describe('Profit target'),
    bullets: z.array(z.string()).describe('What it looks like bullets (provide 3-10 items)'),
  }),
  oneYearPlan: z.object({
    futureDate: z.string().describe('Date 1 year from now'),
    revenue: z.string().describe('Revenue target'),
    profit: z.string().describe('Profit target'),
    goals: z.array(z.string()).describe('Goals for the year (provide 3-7 goals)'),
  }),
  rocks: z.object({
    futureDate: z.string().describe('Quarter (e.g., "Q1 2026")'),
    revenue: z.string().optional().describe('Optional revenue for quarter'),
    profit: z.string().optional().describe('Optional profit for quarter'),
    rocks: z.array(vtoRockSchema).describe('Quarterly rocks with SMART format (provide 3-7 rocks)'),
  }),
  issuesList: z.array(z.string()).describe('Long-term issues list (provide 3-10 issues)'),
});

export type VtoData = z.infer<typeof vtoSchema>;

export const vtoDocumentHandler = createDocumentHandler<'vto'>({
  kind: 'vto',
  onCreateDocument: async ({ title, dataStream, maxOutputTokens, context }) => {
    const provider = createCustomProvider();
    let draftContent = '';
    
    const systemPrompt = `You are generating a Vision/Traction Organizer (V/TO) for an EOS implementation.

If conversation context is provided, extract relevant company information (core values, goals, rocks, etc.) from it to populate the V/TO. Don't use generic placeholders if real data is available.

Guidelines:
- Core Values: 3-5 meaningful values that define the company culture
- Core Focus: Clear purpose and specific niche
- 10-Year Target: Ambitious but achievable long-term goal
- Marketing Strategy: Specific target market, 3 unique differentiators, named process, clear guarantee
- 3-Year Picture: Concrete vision with measurable metrics
- 1-Year Plan: Specific goals aligned with 3-year picture
- Rocks: SMART quarterly priorities (Specific, Measurable, Achievable, Relevant, Time-bound)
- Issues List: Real business challenges to address`;

    const prompt = context && context.trim().length > 0
      ? `Create a V/TO for: ${title}\n\nCompany Context (use this information):\n${context}`
      : `Create a V/TO for: ${title}. Use realistic placeholder values.`;

    const { fullStream } = streamObject({
      model: provider.languageModel('composer-model'),
      schema: vtoSchema,
      system: systemPrompt,
      prompt,
      maxOutputTokens: Math.min(8000, Math.max(1000, maxOutputTokens ?? 4000)),
    });

    for await (const delta of fullStream) {
      const { type } = delta;
      
      if (type === 'object') {
        const { object } = delta;
        
        if (object) {
          // Convert partial object to JSON and send the FULL content with markers
          const json = JSON.stringify(object, null, 2);
          const wrapped = `VTO_DATA_BEGIN\n${json}\nVTO_DATA_END`;
          
          dataStream.write({
            type: 'data-composer',
            id: generateId(),
            data: { type: 'text-delta', content: wrapped },
          });
          
          draftContent = wrapped;
        }
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
    const provider = createCustomProvider();
    let draftContent = '';
    
    // Parse existing VTO content
    let existingVto: Partial<VtoData> = {};
    const content = document.content || '';
    try {
      const jsonMatch = content.match(/VTO_DATA_BEGIN\s*([\s\S]*?)\s*VTO_DATA_END/);
      if (jsonMatch) {
        existingVto = JSON.parse(jsonMatch[1]);
      } else if (content.trim().startsWith('{')) {
        existingVto = JSON.parse(content);
      }
    } catch {
      // Use empty object if parsing fails
    }

    const systemPrompt = `You are editing an existing Vision/Traction Organizer (V/TO).

Current VTO data:
${JSON.stringify(existingVto, null, 2)}

Apply the user's requested edit while preserving all other fields.
Only modify what the user specifically asks to change.`;

    const { fullStream } = streamObject({
      model: provider.languageModel('composer-model'),
      schema: vtoSchema,
      system: systemPrompt,
      prompt: `Edit request: ${description}`,
      maxOutputTokens: Math.min(8000, Math.max(800, maxOutputTokens ?? 4000)),
    });

    for await (const delta of fullStream) {
      const { type } = delta;
      
      if (type === 'object') {
        const { object } = delta;
        
        if (object) {
          const json = JSON.stringify(object, null, 2);
          const wrapped = `VTO_DATA_BEGIN\n${json}\nVTO_DATA_END`;
          
          dataStream.write({
            type: 'data-composer',
            id: generateId(),
            data: { type: 'text-delta', content: wrapped },
          });
          
          draftContent = wrapped;
        }
      }
    }

    return draftContent;
  },
});
