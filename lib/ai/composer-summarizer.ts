import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import type { Document } from '@/lib/db/schema';

/**
 * Generate a comprehensive summary of a composer document
 * @param document - Document to summarize
 * @returns Summary text
 */
export async function summarizeComposer(document: Document): Promise<string> {
  if (!document.content || document.content.length === 0) {
    return '';
  }

  // Check if document needs summarization (> 5000 chars)
  if (document.content.length < 5000) {
    console.log(
      `Composer Summarizer: Document "${document.title}" is small (${document.content.length} chars), skipping summarization`,
    );
    return '';
  }

  console.log(
    `Composer Summarizer: Summarizing "${document.title}" (${document.content.length} chars)`,
  );

  try {
    const kindInstructions = getInstructionsForKind(document.kind);

    const summary = await generateText({
      model: anthropic('claude-3-5-haiku-20241022'),
      prompt: `${kindInstructions}

Document Title: ${document.title}

Content:
${document.content}

Generate a comprehensive summary that preserves all key information while being more concise.`,
      maxOutputTokens: 800,
      temperature: 0.3,
    });

    console.log(
      `Composer Summarizer: Generated summary (${summary.text.length} chars, ${((summary.text.length / document.content.length) * 100).toFixed(1)}% of original)`,
    );

    return summary.text;
  } catch (error) {
    console.error(
      `Composer Summarizer: Error summarizing document "${document.title}":`,
      error,
    );
    return '';
  }
}

/**
 * Get summarization instructions based on document kind
 * @param kind - Document kind
 * @returns Summarization instructions
 */
function getInstructionsForKind(kind: string): string {
  const instructions: Record<string, string> = {
    vto: `Summarize this Vision/Traction Organizer including:
- Core Values (list all)
- Core Focus (Purpose/Cause/Passion + Niche)
- 10-Year Target (specific goal)
- Marketing Strategy (Target Market, 3 Uniques, Proven Process, Guarantee)
- 3-Year Picture (key elements)
- 1-Year Plan (main objectives)
- Quarterly Rocks (if present)
- Issues List highlights (if present)

Preserve ALL specific details, names, numbers, and goals. Be comprehensive but concise.`,

    accountability: `Summarize this Accountability Chart including:
- Organization structure (major seats and reporting relationships)
- Key roles and responsibilities for each seat
- Seat owners/names (if specified)
- Critical functions and accountabilities

Preserve all seat names, roles, and the organizational hierarchy. Be specific about responsibilities.`,

    sheet: `Summarize this Scorecard/Spreadsheet including:
- All measurables being tracked
- Goals/targets for each metric
- Owners of each measurable (if specified)
- Key performance indicators
- Any trends or patterns noted

Preserve all metric names, goals, and ownership information. Include all numbers and targets.`,

    text: `Provide a comprehensive summary of this text document that:
- Captures all main topics and themes
- Preserves key facts, numbers, and specific details
- Maintains important names and references
- Includes critical decisions or recommendations
- Retains action items or next steps

Be thorough while reducing length. Don't lose important information.`,

    code: `Summarize this code including:
- What the code does (main purpose and functionality)
- Key functions, classes, or components
- Input/output specifications
- Important logic or algorithms
- Dependencies or requirements

Describe functionality clearly. Preserve function/class names and purposes.`,

    chart: `Describe this chart/visualization including:
- Type of chart and what it visualizes
- Data being displayed
- Key insights or trends shown
- Axis labels and units
- Important patterns or outliers

Be specific about the data and insights the chart conveys.`,
  };

  return (
    instructions[kind] ||
    instructions.text ||
    'Provide a comprehensive summary preserving all key information.'
  );
}

/**
 * Batch summarize multiple composers
 * @param documents - Array of documents to summarize
 * @returns Map of document IDs to summaries
 */
export async function summarizeMultipleComposers(
  documents: Document[],
): Promise<Map<string, string>> {
  const summaries = new Map<string, string>();

  console.log(
    `Composer Summarizer: Batch summarizing ${documents.length} documents`,
  );

  for (const doc of documents) {
    const summary = await summarizeComposer(doc);
    if (summary) {
      summaries.set(doc.id, summary);
    }
  }

  console.log(
    `Composer Summarizer: Generated ${summaries.size} summaries`,
  );

  return summaries;
}

/**
 * Check if a composer needs summarization
 * @param document - Document to check
 * @returns Whether summarization is needed
 */
export function needsSummarization(document: Document): boolean {
  // Skip summarization for small documents
  if (!document.content || document.content.length < 5000) {
    return false;
  }

  // Skip for certain kinds that don't benefit from summarization
  const skipKinds = ['image'];
  if (skipKinds.includes(document.kind)) {
    return false;
  }

  return true;
}

