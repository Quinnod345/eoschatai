/**
 * Edit helper utilities for intelligent message editing
 */

export interface EditSuggestion {
  type: 'grammar' | 'spelling' | 'clarity' | 'format';
  text: string;
  suggestion: string;
  confidence: number;
}

/**
 * Preserve code blocks and formatting when editing
 */
export function preserveFormatting(original: string, edited: string): string {
  // Extract code blocks from original
  const codeBlockRegex = /```[\s\S]*?```/g;
  const codeBlocks = original.match(codeBlockRegex) || [];

  // If no code blocks, return edited as-is
  if (codeBlocks.length === 0) return edited;

  // Check if edited text has same number of code blocks
  const editedCodeBlocks = edited.match(codeBlockRegex) || [];

  if (editedCodeBlocks.length === codeBlocks.length) {
    // Replace edited code blocks with original ones to preserve formatting
    let result = edited;
    codeBlocks.forEach((block, index) => {
      if (editedCodeBlocks[index]) {
        result = result.replace(editedCodeBlocks[index], block);
      }
    });
    return result;
  }

  return edited;
}

/**
 * Smart diff to show what changed
 */
export function getEditDiff(
  original: string,
  edited: string,
): {
  added: string[];
  removed: string[];
  changed: number;
} {
  const originalWords = original.split(/\s+/);
  const editedWords = edited.split(/\s+/);

  const added: string[] = [];
  const removed: string[] = [];

  // Simple diff - can be enhanced with better algorithm
  const originalSet = new Set(originalWords);
  const editedSet = new Set(editedWords);

  editedWords.forEach((word) => {
    if (!originalSet.has(word)) {
      added.push(word);
    }
  });

  originalWords.forEach((word) => {
    if (!editedSet.has(word)) {
      removed.push(word);
    }
  });

  const changed = Math.abs(originalWords.length - editedWords.length);

  return { added, removed, changed };
}

/**
 * Auto-format common patterns
 */
export function autoFormat(text: string): string {
  let formatted = text;

  // Fix common spacing issues
  formatted = formatted.replace(/\s+/g, ' '); // Multiple spaces to single
  formatted = formatted.replace(/\s+([,.!?;:])/g, '$1'); // Remove space before punctuation
  formatted = formatted.replace(/([,.!?;:])\s*/g, '$1 '); // Add space after punctuation
  formatted = formatted.replace(/\s+$/gm, ''); // Trim trailing spaces

  // Fix common typos
  const typoMap: Record<string, string> = {
    teh: 'the',
    adn: 'and',
    taht: 'that',
    wiht: 'with',
    recieve: 'receive',
    definately: 'definitely',
  };

  Object.entries(typoMap).forEach(([typo, correct]) => {
    const regex = new RegExp(`\\b${typo}\\b`, 'gi');
    formatted = formatted.replace(regex, correct);
  });

  // Capitalize first letter of sentences
  formatted = formatted.replace(
    /(^|[.!?]\s+)([a-z])/g,
    (match, p1, p2) => p1 + p2.toUpperCase(),
  );

  return formatted.trim();
}

/**
 * Validate message before saving
 */
export function validateMessage(text: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!text.trim()) {
    errors.push('Message cannot be empty');
  }

  if (text.length > 4096) {
    errors.push('Message is too long (max 4096 characters)');
  }

  // Check for unclosed code blocks
  const codeBlockCount = (text.match(/```/g) || []).length;
  if (codeBlockCount % 2 !== 0) {
    errors.push('Unclosed code block detected');
  }

  // Check for unmatched brackets/parentheses
  const brackets = { '(': ')', '[': ']', '{': '}' };
  const stack: string[] = [];

  for (const char of text) {
    if (Object.keys(brackets).includes(char)) {
      stack.push(char);
    } else if (Object.values(brackets).includes(char)) {
      const last = stack.pop();
      if (!last || brackets[last as keyof typeof brackets] !== char) {
        errors.push('Unmatched brackets detected');
        break;
      }
    }
  }

  if (stack.length > 0) {
    errors.push('Unmatched brackets detected');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Get smart edit suggestions based on context
 */
export function getEditSuggestions(text: string): EditSuggestion[] {
  const suggestions: EditSuggestion[] = [];

  // Check for very long sentences
  const sentences = text.split(/[.!?]+/);
  sentences.forEach((sentence) => {
    const wordCount = sentence.trim().split(/\s+/).length;
    if (wordCount > 40) {
      suggestions.push({
        type: 'clarity',
        text: sentence.trim(),
        suggestion: 'Consider breaking this into shorter sentences',
        confidence: 0.8,
      });
    }
  });

  // Check for passive voice patterns
  const passivePatterns = [
    /\b(is|are|was|were|been|being)\s+\w+ed\b/gi,
    /\b(is|are|was|were|been|being)\s+\w+en\b/gi,
  ];

  passivePatterns.forEach((pattern) => {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach((match) => {
        suggestions.push({
          type: 'clarity',
          text: match,
          suggestion: 'Consider using active voice',
          confidence: 0.6,
        });
      });
    }
  });

  // Check for repeated words
  const words = text.toLowerCase().split(/\s+/);
  const wordCounts: Record<string, number> = {};

  words.forEach((word) => {
    if (word.length > 4) {
      // Only check longer words
      wordCounts[word] = (wordCounts[word] || 0) + 1;
    }
  });

  Object.entries(wordCounts).forEach(([word, count]) => {
    if (count > 3) {
      suggestions.push({
        type: 'clarity',
        text: word,
        suggestion: `"${word}" is used ${count} times. Consider using synonyms`,
        confidence: 0.7,
      });
    }
  });

  return suggestions;
}
