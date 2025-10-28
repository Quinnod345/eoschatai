import { Tiktoken, encoding_for_model } from 'tiktoken';

// Cache encodings to avoid recreating them
const encodingCache: Record<string, Tiktoken> = {};

/**
 * Count tokens in text using tiktoken
 * @param text - Text to count tokens in
 * @param model - Model name (default: 'gpt-4')
 * @returns Number of tokens
 */
export function countTokens(text: string, model: string = 'gpt-4'): number {
  if (!text) return 0;

  try {
    // Use cached encoding or create new one
    let enc = encodingCache[model];
    
    if (!enc) {
      // Map model names to encoding names
      const modelMap: Record<string, string> = {
        'gpt-4.1': 'gpt-4',
        'gpt-4': 'gpt-4',
        'gpt-4o': 'gpt-4',
        'gpt-4o-mini': 'gpt-4',
        'gpt-5': 'gpt-4', // o1 uses similar encoding
        'o1': 'gpt-4',
        'o1-mini': 'gpt-4',
        'o1-preview': 'gpt-4',
      };

      const encodingModel = modelMap[model] || 'gpt-4';
      enc = encoding_for_model(encodingModel as any);
      encodingCache[model] = enc;
    }

    const tokens = enc.encode(text);
    return tokens.length;
  } catch (error) {
    console.error(`Token counting error for model ${model}:`, error);
    // Fallback: Estimate ~4 characters per token
    return Math.ceil(text.length / 4);
  }
}

/**
 * Free encoding resources (call when done with a model)
 * @param model - Model to free encoding for
 */
export function freeEncoding(model: string) {
  const enc = encodingCache[model];
  if (enc) {
    enc.free();
    delete encodingCache[model];
  }
}

/**
 * Free all cached encodings
 */
export function freeAllEncodings() {
  Object.keys(encodingCache).forEach((model) => {
    encodingCache[model].free();
  });
  Object.keys(encodingCache).forEach((key) => delete encodingCache[key]);
}

/**
 * Estimate token budget for different models
 * @param model - Model name
 * @returns Token budget configuration
 */
export function estimateTokenBudget(model: string): {
  maxTokens: number;
  systemPromptBudget: number;
  messageBudget: number;
  responseBudget: number;
} {
  const budgets: Record<
    string,
    {
      max: number;
      system: number;
      message: number;
      response: number;
    }
  > = {
    'gpt-4.1': {
      max: 128000,
      system: 12000,
      message: 8000,
      response: 4096,
    },
    'gpt-4': {
      max: 128000,
      system: 12000,
      message: 8000,
      response: 4096,
    },
    'gpt-4o': {
      max: 128000,
      system: 12000,
      message: 8000,
      response: 4096,
    },
    'gpt-4o-mini': {
      max: 128000,
      system: 10000,
      message: 6000,
      response: 4096,
    },
    'gpt-5': {
      max: 200000,
      system: 16000,
      message: 12000,
      response: 32768,
    },
    'o1': {
      max: 200000,
      system: 16000,
      message: 12000,
      response: 32768,
    },
    'o1-mini': {
      max: 128000,
      system: 12000,
      message: 8000,
      response: 32768,
    },
    'o1-preview': {
      max: 128000,
      system: 12000,
      message: 8000,
      response: 32768,
    },
  };

  const config = budgets[model] || budgets['gpt-4.1'];

  return {
    maxTokens: config.max,
    systemPromptBudget: config.system,
    messageBudget: config.message,
    responseBudget: config.response,
  };
}

/**
 * Check if text fits within token budget
 * @param text - Text to check
 * @param budget - Token budget
 * @param model - Model name
 * @returns Whether text fits and actual token count
 */
export function fitsWithinBudget(
  text: string,
  budget: number,
  model: string = 'gpt-4',
): { fits: boolean; tokens: number; remaining: number } {
  const tokens = countTokens(text, model);
  const remaining = budget - tokens;

  return {
    fits: remaining >= 0,
    tokens,
    remaining,
  };
}

/**
 * Truncate text to fit within token budget
 * @param text - Text to truncate
 * @param budget - Token budget
 * @param model - Model name
 * @returns Truncated text that fits budget
 */
export function truncateToFit(
  text: string,
  budget: number,
  model: string = 'gpt-4',
): string {
  const tokens = countTokens(text, model);

  if (tokens <= budget) {
    return text;
  }

  // Estimate character ratio
  const charPerToken = text.length / tokens;
  const targetChars = Math.floor(budget * charPerToken * 0.95); // 95% safety margin

  // Truncate and add ellipsis
  const truncated = text.substring(0, targetChars);
  return truncated + '...[truncated to fit token budget]';
}

/**
 * Count tokens in multiple texts
 * @param texts - Array of texts
 * @param model - Model name
 * @returns Array of token counts
 */
export function countMultiple(
  texts: string[],
  model: string = 'gpt-4',
): number[] {
  return texts.map((text) => countTokens(text, model));
}

/**
 * Get total token count for multiple texts
 * @param texts - Array of texts
 * @param model - Model name
 * @returns Total token count
 */
export function countTotal(texts: string[], model: string = 'gpt-4'): number {
  return texts.reduce((sum, text) => sum + countTokens(text, model), 0);
}

