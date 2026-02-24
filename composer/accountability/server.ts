import { createDocumentHandler } from '@/lib/composer/server';
import { generateId, streamText } from 'ai';
import { createCustomProvider } from '@/lib/ai/providers';

// Type definitions for Accountability Chart
type SeatNode = {
  id: string;
  name: string;
  holder: string;
  roles: string[];
  accent?: string;
  children: SeatNode[];
};

type AccountabilityChartData = {
  version: number;
  title: string;
  root: SeatNode;
};

export type { AccountabilityChartData, SeatNode };

// JSON schema description for the AI to follow (used in prompts, not as structured output)
const JSON_SCHEMA_INSTRUCTIONS = `
You MUST output ONLY valid JSON (no markdown, no code fences, no explanation).
The JSON must match this exact structure:

{
  "version": 1,
  "title": "string - chart title",
  "root": {
    "id": "string - unique ID like seat-1",
    "name": "string - seat name in UPPERCASE",
    "holder": "string - person name or 'Seat Holder'",
    "roles": ["string array - 2-5 key responsibilities"],
    "children": [/* array of seat objects with same structure */]
  }
}

CRITICAL RULES:
- Output ONLY the JSON object, starting with { and ending with }
- No markdown code fences (\`\`\`)
- No explanations before or after
- All seat objects must have: id, name, holder, roles (array), children (array, can be empty [])
- Use unique IDs: seat-1, seat-2, seat-3, etc.
- Seat names should be UPPERCASE (e.g., VISIONARY, INTEGRATOR, SALES)
`;

export const accountabilityDocumentHandler =
  createDocumentHandler<'accountability'>({
    kind: 'accountability',
    onCreateDocument: async ({
      title,
      dataStream,
      maxOutputTokens,
      context,
    }) => {
      const provider = createCustomProvider();
      let draftContent = '';
      let accumulatedText = '';
      
      const systemPrompt = `You are generating an EOS Accountability Chart as JSON.

${JSON_SCHEMA_INSTRUCTIONS}

EOS Structure requirements:
- Root seat: VISIONARY with strategic roles (vision, culture, big relationships, R&D)
- INTEGRATOR reports to Visionary, leads the leadership team (P&L, business plan, leadership team, integration)
- Department heads report to Integrator: SALES/MARKETING, OPERATIONS, FINANCE (each with 3-5 specific roles)
- Include 3-4 department heads for a typical EOS structure

If no specific names are provided, use "Seat Holder" for the holder field.`;

      const prompt = context && context.trim().length > 0
        ? `Create an Accountability Chart JSON titled "${title || 'Accountability Chart'}".\n\nContext (use this information to populate names and roles):\n${context}\n\nOutput ONLY the JSON:`
        : `Create an Accountability Chart JSON titled "${title || 'Accountability Chart'}" with typical EOS structure (Visionary, Integrator, 3-4 department heads).\n\nOutput ONLY the JSON:`;

      const { fullStream } = streamText({
        model: provider.languageModel('composer-model'),
        system: systemPrompt,
        prompt,
        maxOutputTokens: Math.min(8000, Math.max(1000, maxOutputTokens ?? 4000)),
      });

      for await (const delta of fullStream) {
        const { type } = delta;
        
        if (type === 'text-delta') {
          const text = delta.text;
          accumulatedText += text;
          
          // Try to parse the accumulated text as JSON
          // Clean up any markdown code fences that might slip through
          const cleanedText = accumulatedText
            .replace(/^```json\s*/i, '')
            .replace(/^```\s*/i, '')
            .replace(/\s*```$/i, '')
            .trim();
          
          // Only send if it looks like valid JSON so far
          if (cleanedText.startsWith('{')) {
            const wrapped = `AC_DATA_BEGIN\n${cleanedText}\nAC_DATA_END`;
            
            dataStream.write({
              type: 'data-composer',
              id: generateId(),
              data: { type: 'text-delta', content: wrapped },
            });
            
            draftContent = wrapped;
          }
        }
      }

      // Final cleanup and validation
      let finalText = accumulatedText
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
      
      // Try to pretty-print if valid JSON
      try {
        const parsed = JSON.parse(finalText);
        finalText = JSON.stringify(parsed, null, 2);
      } catch {
        // Keep as-is if not valid JSON
      }
      
      draftContent = `AC_DATA_BEGIN\n${finalText}\nAC_DATA_END`;
      
      // Send final content
      dataStream.write({
        type: 'data-composer',
        id: generateId(),
        data: { type: 'text-delta', content: draftContent },
      });

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
      let accumulatedText = '';
      
      // Parse existing chart content
      let existingChart: Partial<AccountabilityChartData> = {};
      const content = document.content || '';
      try {
        const jsonMatch = content.match(/AC_DATA_BEGIN\s*([\s\S]*?)\s*AC_DATA_END/);
        if (jsonMatch) {
          existingChart = JSON.parse(jsonMatch[1]);
        } else if (content.trim().startsWith('{')) {
          existingChart = JSON.parse(content);
        }
      } catch {
        // Use empty object if parsing fails
      }

      const systemPrompt = `You are editing an existing EOS Accountability Chart.

${JSON_SCHEMA_INSTRUCTIONS}

Current chart data:
${JSON.stringify(existingChart, null, 2)}

Apply the user's requested edit while preserving all other fields and structure.
Only modify what the user specifically asks to change.
Maintain all existing seat IDs unless adding/removing seats.`;

      const { fullStream } = streamText({
        model: provider.languageModel('composer-model'),
        system: systemPrompt,
        prompt: `Edit request: ${description}\n\nOutput the complete updated JSON:`,
        maxOutputTokens: Math.min(8000, Math.max(800, maxOutputTokens ?? 4000)),
      });

      for await (const delta of fullStream) {
        const { type } = delta;
        
        if (type === 'text-delta') {
          const text = delta.text;
          accumulatedText += text;
          
          // Clean up any markdown code fences
          const cleanedText = accumulatedText
            .replace(/^```json\s*/i, '')
            .replace(/^```\s*/i, '')
            .replace(/\s*```$/i, '')
            .trim();
          
          if (cleanedText.startsWith('{')) {
            const wrapped = `AC_DATA_BEGIN\n${cleanedText}\nAC_DATA_END`;
            
            dataStream.write({
              type: 'data-composer',
              id: generateId(),
              data: { type: 'text-delta', content: wrapped },
            });
            
            draftContent = wrapped;
          }
        }
      }

      // Final cleanup
      let finalText = accumulatedText
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
      
      try {
        const parsed = JSON.parse(finalText);
        finalText = JSON.stringify(parsed, null, 2);
      } catch {
        // Keep as-is
      }
      
      draftContent = `AC_DATA_BEGIN\n${finalText}\nAC_DATA_END`;
      
      dataStream.write({
        type: 'data-composer',
        id: generateId(),
        data: { type: 'text-delta', content: draftContent },
      });

      return draftContent;
    },
  });
