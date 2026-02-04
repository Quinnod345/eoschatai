// @ts-nocheck
import { describe, it, expect, vi } from 'vitest';
import {
  countTokens,
  estimateTokenBudget,
  fitsWithinBudget,
  truncateToFit,
  countMultiple,
  countTotal,
} from '@/lib/ai/token-counter';

// Mock tiktoken to avoid dependency issues in tests
vi.mock('tiktoken', () => ({
  encoding_for_model: vi.fn(() => ({
    encode: vi.fn((text: string) => Array(Math.ceil(text.length / 4)).fill(1)),
    free: vi.fn(),
  })),
}));

describe('Token Counter', () => {
  describe('countTokens', () => {
    it('should count tokens approximately', () => {
      const text = 'Hello, world!';
      const result = countTokens(text);
      
      // With our mock, it should be roughly text.length / 4
      expect(result).toBeGreaterThan(0);
      expect(typeof result).toBe('number');
    });

    it('should return 0 for empty text', () => {
      expect(countTokens('')).toBe(0);
      expect(countTokens(null as any)).toBe(0);
      expect(countTokens(undefined as any)).toBe(0);
    });

    it('should handle different models', () => {
      const text = 'Test text';
      const result1 = countTokens(text, 'gpt-4');
      const result2 = countTokens(text, 'claude-sonnet');
      
      expect(result1).toBeGreaterThan(0);
      expect(result2).toBeGreaterThan(0);
    });
  });

  describe('estimateTokenBudget', () => {
    it('should return budget for GPT-4', () => {
      const budget = estimateTokenBudget('gpt-4');
      
      expect(budget).toEqual({
        maxOutputTokens: 128000,
        systemPromptBudget: 12000,
        messageBudget: 8000,
        responseBudget: 4096,
      });
    });

    it('should return budget for Claude', () => {
      const budget = estimateTokenBudget('claude-sonnet');
      
      expect(budget).toEqual({
        maxOutputTokens: 200000,
        systemPromptBudget: 16000,
        messageBudget: 12000,
        responseBudget: 64000,
      });
    });

    it('should fallback to Claude for unknown models', () => {
      const budget = estimateTokenBudget('unknown-model');
      
      expect(budget.maxOutputTokens).toBe(200000);
      expect(budget.systemPromptBudget).toBe(16000);
    });
  });

  describe('fitsWithinBudget', () => {
    it('should check if text fits within budget', () => {
      const text = 'Short text';
      const result = fitsWithinBudget(text, 100);
      
      expect(result.fits).toBe(true);
      expect(result.tokens).toBeGreaterThan(0);
      expect(result.remaining).toBeGreaterThan(0);
    });

    it('should detect when text exceeds budget', () => {
      const text = 'Long text that exceeds the very small budget';
      const result = fitsWithinBudget(text, 5);
      
      expect(result.fits).toBe(false);
      expect(result.remaining).toBeLessThan(0);
    });
  });

  describe('truncateToFit', () => {
    it('should return original text if it fits', () => {
      const text = 'Short text';
      const result = truncateToFit(text, 100);
      
      expect(result).toBe(text);
    });

    it('should truncate text if it exceeds budget', () => {
      const text = 'This is a very long text that needs to be truncated because it exceeds the budget';
      const result = truncateToFit(text, 10);
      
      expect(result.length).toBeLessThan(text.length);
      expect(result).toContain('truncated to fit token budget');
    });
  });

  describe('countMultiple', () => {
    it('should count tokens for multiple texts', () => {
      const texts = ['First text', 'Second text', 'Third'];
      const results = countMultiple(texts);
      
      expect(results).toHaveLength(3);
      expect(results.every(r => r > 0)).toBe(true);
    });

    it('should handle empty array', () => {
      expect(countMultiple([])).toEqual([]);
    });
  });

  describe('countTotal', () => {
    it('should sum token counts', () => {
      const texts = ['First', 'Second', 'Third'];
      const total = countTotal(texts);
      
      expect(total).toBeGreaterThan(0);
      expect(typeof total).toBe('number');
    });

    it('should return 0 for empty array', () => {
      expect(countTotal([])).toBe(0);
    });
  });
});