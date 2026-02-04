import { describe, it, expect } from 'vitest';
import {
  preserveFormatting,
  getEditDiff,
  autoFormat,
  validateMessage,
  getEditSuggestions,
} from '@/lib/utils/edit-helpers';

describe('Edit Helpers', () => {
  describe('preserveFormatting', () => {
    it('should preserve code blocks when editing', () => {
      const original = 'Here is some code:\n```javascript\nconst x = 1;\n```\nThat was code.';
      const edited = 'Here is modified code:\n```python\nprint("hello")\n```\nThat was Python code.';
      
      const result = preserveFormatting(original, edited);
      
      expect(result).toBe('Here is modified code:\n```javascript\nconst x = 1;\n```\nThat was Python code.');
    });

    it('should handle multiple code blocks', () => {
      const original = 'Code 1:\n```js\ncode1\n```\nCode 2:\n```css\ncode2\n```\nDone.';
      const edited = 'Code 1:\n```python\nnew1\n```\nCode 2:\n```html\nnew2\n```\nDone.';
      
      const result = preserveFormatting(original, edited);
      
      expect(result).toBe('Code 1:\n```js\ncode1\n```\nCode 2:\n```css\ncode2\n```\nDone.');
    });

    it('should return edited text when no code blocks in original', () => {
      const original = 'No code here';
      const edited = 'Still no code here';
      
      const result = preserveFormatting(original, edited);
      
      expect(result).toBe(edited);
    });

    it('should return edited text when code block count differs', () => {
      const original = 'One block:\n```js\ncode\n```\nDone.';
      const edited = 'Two blocks:\n```js\ncode1\n```\nand\n```py\ncode2\n```\nDone.';
      
      const result = preserveFormatting(original, edited);
      
      expect(result).toBe(edited);
    });
  });

  describe('getEditDiff', () => {
    it('should detect added and removed words', () => {
      const original = 'The quick brown fox';
      const edited = 'The slow brown wolf runs';
      
      const diff = getEditDiff(original, edited);
      
      expect(diff.added).toEqual(['slow', 'wolf', 'runs']);
      expect(diff.removed).toEqual(['quick', 'fox']);
      expect(diff.changed).toBe(1); // |4 - 5| = 1
    });

    it('should handle identical strings', () => {
      const text = 'Same text here';
      const diff = getEditDiff(text, text);
      
      expect(diff.added).toEqual([]);
      expect(diff.removed).toEqual([]);
      expect(diff.changed).toBe(0);
    });

    it('should handle empty strings', () => {
      const diff1 = getEditDiff('', 'new text');
      expect(diff1.added).toEqual(['new', 'text']);
      expect(diff1.removed).toEqual([]);
      expect(diff1.changed).toBe(2);

      const diff2 = getEditDiff('old text', '');
      expect(diff2.added).toEqual([]);
      expect(diff2.removed).toEqual(['old', 'text']);
      expect(diff2.changed).toBe(2);
    });
  });

  describe('autoFormat', () => {
    it('should fix common spacing issues', () => {
      const text = 'hello    world.next   sentence,with   punctuation.';
      const result = autoFormat(text);
      
      expect(result).toBe('Hello world. Next sentence, with punctuation.');
    });

    it('should fix common typos', () => {
      const text = 'teh quick adn definately good example wiht recieve';
      const result = autoFormat(text);
      
      expect(result).toBe('The quick and definitely good example with receive.');
    });

    it('should capitalize first letter of sentences', () => {
      const text = 'first sentence. second sentence! third sentence?';
      const result = autoFormat(text);
      
      expect(result).toBe('First sentence. Second sentence! Third sentence?');
    });

    it('should handle empty strings', () => {
      expect(autoFormat('')).toBe('');
      expect(autoFormat('   ')).toBe('');
    });

    it('should fix punctuation spacing', () => {
      const text = 'hello ,world ;test :colon !exclaim ?question';
      const result = autoFormat(text);
      
      expect(result).toBe('Hello, world; test: colon! Exclaim? Question');
    });
  });

  describe('validateMessage', () => {
    it('should validate normal messages', () => {
      const result = validateMessage('This is a normal message.');
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should reject empty messages', () => {
      const result1 = validateMessage('');
      const result2 = validateMessage('   ');
      
      expect(result1.isValid).toBe(false);
      expect(result1.errors).toContain('Message cannot be empty');
      
      expect(result2.isValid).toBe(false);
      expect(result2.errors).toContain('Message cannot be empty');
    });

    it('should reject messages that are too long', () => {
      const longMessage = 'x'.repeat(4097);
      const result = validateMessage(longMessage);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Message is too long (max 4096 characters)');
    });

    it('should detect unclosed code blocks', () => {
      const message = 'Here is code:\n```javascript\nconst x = 1;';
      const result = validateMessage(message);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Unclosed code block detected');
    });

    it('should allow properly closed code blocks', () => {
      const message = 'Here is code:\n```javascript\nconst x = 1;\n```\nDone.';
      const result = validateMessage(message);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should detect unmatched brackets', () => {
      const testCases = [
        'This has unmatched (parentheses',
        'This has unmatched [brackets',  
        'This has unmatched {braces',
        'This has wrong order )}',
      ];

      testCases.forEach(testCase => {
        const result = validateMessage(testCase);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Unmatched brackets detected');
      });
    });

    it('should allow properly matched brackets', () => {
      const message = 'This has (parentheses), [brackets], and {braces} properly matched.';
      const result = validateMessage(message);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });

  describe('getEditSuggestions', () => {
    it('should suggest breaking long sentences', () => {
      const longSentence = 'This is an extremely long sentence with many words that goes on and on and on and should probably be broken into multiple smaller sentences for better readability and comprehension by the reader who might get lost in such a long sentence structure.';
      
      const suggestions = getEditSuggestions(longSentence);
      const claritySuggestions = suggestions.filter(s => s.type === 'clarity');
      
      expect(claritySuggestions.some(s => s.suggestion.includes('shorter sentences'))).toBe(true);
    });

    it('should detect passive voice patterns', () => {
      const passiveText = 'The report was written by the team. The results were analyzed by experts.';
      
      const suggestions = getEditSuggestions(passiveText);
      const passiveSuggestions = suggestions.filter(s => s.suggestion.includes('active voice'));
      
      expect(passiveSuggestions.length).toBeGreaterThan(0);
    });

    it('should detect repeated words', () => {
      const text = 'This example shows example of repeated example words example in text example.';
      
      const suggestions = getEditSuggestions(text);
      const repetitionSuggestions = suggestions.filter(s => s.suggestion.includes('synonyms'));
      
      expect(repetitionSuggestions.some(s => s.text === 'example')).toBe(true);
    });

    it('should return empty array for good text', () => {
      const goodText = 'This is a well-written, clear, and concise message.';
      
      const suggestions = getEditSuggestions(goodText);
      
      expect(suggestions).toHaveLength(0);
    });

    it('should have appropriate confidence scores', () => {
      const text = 'This extremely long sentence should probably be broken down because it was written by someone.';
      
      const suggestions = getEditSuggestions(text);
      
      suggestions.forEach(suggestion => {
        expect(suggestion.confidence).toBeGreaterThan(0);
        expect(suggestion.confidence).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('Integration scenarios', () => {
    it('should handle a complete editing workflow', () => {
      const original = 'teh quick brown fox jumps.this needs formatting,adn it has typos.';
      
      // Auto-format first
      const formatted = autoFormat(original);
      expect(formatted).toContain('The quick brown fox');
      expect(formatted).toContain('This needs');
      expect(formatted).toContain('and it has');
      
      // Validate the formatted message
      const validation = validateMessage(formatted);
      expect(validation.isValid).toBe(true);
      
      // Get suggestions for improvements
      const suggestions = getEditSuggestions(formatted);
      expect(suggestions).toBeInstanceOf(Array);
      
      // Check diff between original and formatted
      const diff = getEditDiff(original, formatted);
      expect(diff.added.length + diff.removed.length).toBeGreaterThan(0);
    });

    it('should handle code-heavy messages correctly', () => {
      const codeMessage = `Here's the function:
      
\`\`\`javascript
function test() {
  console.log("hello");
}
\`\`\`

That's all.`;

      const validation = validateMessage(codeMessage);
      expect(validation.isValid).toBe(true);

      const suggestions = getEditSuggestions(codeMessage);
      // Should not suggest breaking code blocks
      expect(suggestions.length).toBe(0);
    });

    it('should preserve formatting while fixing typos', () => {
      const original = `Code example:

\`\`\`js
function test() {
  return "hello";
}
\`\`\`

teh code above is good.`;

      const edited = `Code example:

\`\`\`python
def test():
  return "hello"
\`\`\`

The code above is good.`;

      const preserved = preserveFormatting(original, edited);
      
      // Should preserve original code block
      expect(preserved).toContain('function test()');
      expect(preserved).toContain('return "hello";');
      expect(preserved).not.toContain('def test():');
      
      // Should keep text changes
      expect(preserved).toContain('The code above is good.');
    });
  });
});