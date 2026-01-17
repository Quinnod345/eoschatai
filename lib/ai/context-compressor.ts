import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import { countTokens } from './token-counter';

/**
 * Compress context text to fit within a token budget
 * Uses LLM to intelligently compress while preserving key information
 * @param text - Text to compress
 * @param maxTokens - Maximum tokens allowed
 * @param model - Model to use for compression (default: claude-3-5-haiku for speed)
 * @returns Compressed text
 */
export async function compressContext(
  text: string,
  maxTokens: number,
  model: string = 'claude-3-5-haiku-20241022',
): Promise<string> {
  if (!text || maxTokens <= 0) {
    return '';
  }

  const currentTokens = countTokens(text, model);

  // If already fits, return as-is
  if (currentTokens <= maxTokens) {
    return text;
  }

  console.log(
    `Context Compressor: Compressing ${currentTokens} tokens to fit ${maxTokens} token budget`,
  );

  try {
    // Calculate target token count (aim for 90% of budget for safety)
    const targetTokens = Math.floor(maxTokens * 0.9);

    // Use Claude 3.5 Haiku for fast, cost-effective compression
    const result = await generateText({
      model: anthropic('claude-3-5-haiku-20241022'),
      prompt: `You are compressing context to fit a token budget while preserving all key information.

ORIGINAL TEXT (${currentTokens} tokens):
${text}

TASK: Compress this to approximately ${targetTokens} tokens while:
1. Preserving ALL facts, names, numbers, and specific details
2. Removing redundancy and verbose phrasing
3. Using concise language without losing meaning
4. Maintaining the original structure and categories
5. Keeping all critical instructions and guidelines

COMPRESSED VERSION:`,
      maxOutputTokens: targetTokens,
      temperature: 0.3, // Low temperature for consistent compression
    });

    const compressed = result.text;
    const compressedTokens = countTokens(compressed, model);

    console.log(
      `Context Compressor: Compressed from ${currentTokens} to ${compressedTokens} tokens (${((compressedTokens / currentTokens) * 100).toFixed(1)}%)`,
    );

    // Verify compression was successful
    if (compressedTokens <= maxTokens) {
      return compressed;
    } else {
      console.warn(
        `Context Compressor: Compression failed to meet budget (${compressedTokens} > ${maxTokens}), attempting aggressive truncation`,
      );
      // Fallback: Aggressive truncation
      return truncateAggressively(compressed, maxTokens, model);
    }
  } catch (error) {
    console.error('Context Compressor: Error during compression:', error);
    // Fallback to simple truncation
    return truncateAggressively(text, maxTokens, model);
  }
}

/**
 * Aggressively truncate text to fit budget
 * @param text - Text to truncate
 * @param maxTokens - Maximum tokens
 * @param model - Model name
 * @returns Truncated text
 */
function truncateAggressively(
  text: string,
  maxTokens: number,
  model: string,
): string {
  const currentTokens = countTokens(text, model);

  if (currentTokens <= maxTokens) {
    return text;
  }

  // Estimate character ratio
  const charPerToken = text.length / currentTokens;
  const targetChars = Math.floor(maxTokens * charPerToken * 0.9); // 90% safety margin

  // Truncate and add notice
  const truncated = text.substring(0, targetChars);
  const notice = '\n\n[Content truncated to fit token budget]';

  return truncated + notice;
}

/**
 * Compress multiple context sections independently
 * @param contexts - Array of context objects with content
 * @param totalBudget - Total token budget for all contexts
 * @param model - Model name
 * @returns Array of compressed contexts
 */
export async function compressMultipleContexts(
  contexts: Array<{ content: string; priority: number; name: string }>,
  totalBudget: number,
  model: string = 'gpt-4o-mini',
): Promise<Array<{ content: string; originalTokens: number; compressedTokens: number; name: string }>> {
  // Calculate token allocations based on priority
  // Higher priority (lower number) gets more budget
  const totalPriorityWeight = contexts.reduce(
    (sum, ctx) => sum + (1 / ctx.priority),
    0,
  );

  const compressed = [];

  for (const ctx of contexts) {
    const priorityWeight = 1 / ctx.priority;
    const allocation = Math.floor(
      (priorityWeight / totalPriorityWeight) * totalBudget,
    );

    const originalTokens = countTokens(ctx.content, model);

    if (originalTokens <= allocation) {
      // No compression needed
      compressed.push({
        content: ctx.content,
        originalTokens,
        compressedTokens: originalTokens,
        name: ctx.name,
      });
    } else {
      // Compress to fit allocation
      const compressedContent = await compressContext(
        ctx.content,
        allocation,
        model,
      );
      const compressedTokens = countTokens(compressedContent, model);

      compressed.push({
        content: compressedContent,
        originalTokens,
        compressedTokens,
        name: ctx.name,
      });
    }
  }

  return compressed;
}

/**
 * Extract key points from text (extreme compression)
 * @param text - Text to extract from
 * @param maxPoints - Maximum number of points to extract
 * @returns Bulleted list of key points
 */
export async function extractKeyPoints(
  text: string,
  maxPoints: number = 10,
): Promise<string> {
  try {
    const result = await generateText({
      model: anthropic('claude-3-5-haiku-20241022'),
      prompt: `Extract the ${maxPoints} most important points from this text as a concise bulleted list:

${text}

KEY POINTS:`,
      maxOutputTokens: maxPoints * 30, // Roughly 30 tokens per point
      temperature: 0.3,
    });

    return result.text;
  } catch (error) {
    console.error('Context Compressor: Error extracting key points:', error);
    return '';
  }
}

