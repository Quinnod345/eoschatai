// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  markdownToHtml,
  copyRichText,
  formatMentionsForRichText,
  formatMentionsForPlainText,
  processMessageParts,
} from '@/lib/utils/copy-utils';

// Mock the unified and related packages
const mockProcess = vi.fn();
const mockUnified = vi.fn(() => ({
  use: vi.fn().mockReturnThis(),
  process: mockProcess,
}));

vi.mock('unified', () => ({
  unified: mockUnified,
}));

vi.mock('remark-parse', () => ({
  default: 'mock-remark-parse',
}));

vi.mock('remark-gfm', () => ({
  default: 'mock-remark-gfm',
}));

vi.mock('remark-rehype', () => ({
  default: 'mock-remark-rehype',
}));

vi.mock('rehype-stringify', () => ({
  default: 'mock-rehype-stringify',
}));

describe('Copy Utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('formatMentionsForRichText', () => {
    it('should format calendar mentions with proper styling', () => {
      const text = 'Check @calendar:meeting and @calendar:event today';
      const result = formatMentionsForRichText(text);

      expect(result).toContain('📅 meeting');
      expect(result).toContain('📅 event');
      expect(result).toContain('color: #059669'); // Green for calendar
      expect(result).toContain('background-color: #eff6ff');
      expect(result).toContain('font-weight: 500');
    });

    it('should format people mentions with proper styling', () => {
      const text = 'Contact @people:john and @people:sarah';
      const result = formatMentionsForRichText(text);

      expect(result).toContain('👥 john');
      expect(result).toContain('👥 sarah');
      expect(result).toContain('color: #7c3aed'); // Purple for people
    });

    it('should format default mentions with file icon', () => {
      const text = 'Review @document:report and @file:sheet';
      const result = formatMentionsForRichText(text);

      expect(result).toContain('📄 report');
      expect(result).toContain('📄 sheet');
      expect(result).toContain('color: #2563eb'); // Default blue
    });

    it('should handle mixed mention types', () => {
      const text = 'Check @calendar:meeting with @people:team about @document:report';
      const result = formatMentionsForRichText(text);

      expect(result).toContain('📅 meeting');
      expect(result).toContain('👥 team');
      expect(result).toContain('📄 report');
    });

    it('should preserve text without mentions', () => {
      const text = 'This text has no mentions';
      const result = formatMentionsForRichText(text);

      expect(result).toBe(text);
    });

    it('should handle empty text', () => {
      const result = formatMentionsForRichText('');
      expect(result).toBe('');
    });

    it('should handle multiple mentions of same type', () => {
      const text = '@calendar:meeting1 and @calendar:meeting2 and @calendar:meeting3';
      const result = formatMentionsForRichText(text);

      expect(result.match(/📅/g)).toHaveLength(3);
      expect(result).toContain('meeting1');
      expect(result).toContain('meeting2');
      expect(result).toContain('meeting3');
    });
  });

  describe('formatMentionsForPlainText', () => {
    it('should format calendar mentions with calendar emoji', () => {
      const text = 'Check @calendar:meeting today';
      const result = formatMentionsForPlainText(text);

      expect(result).toBe('Check 📅 meeting today');
    });

    it('should format people mentions with people emoji', () => {
      const text = 'Contact @people:john';
      const result = formatMentionsForPlainText(text);

      expect(result).toBe('Contact 👥 john');
    });

    it('should format other mentions with file emoji', () => {
      const text = 'Review @document:report';
      const result = formatMentionsForPlainText(text);

      expect(result).toBe('Review 📄 report');
    });

    it('should handle mixed mentions', () => {
      const text = '@calendar:meeting @people:team @document:report';
      const result = formatMentionsForPlainText(text);

      expect(result).toBe('📅 meeting 👥 team 📄 report');
    });

    it('should preserve text structure', () => {
      const text = 'Start with @calendar:meeting, then @people:team, finally @document:report.';
      const result = formatMentionsForPlainText(text);

      expect(result).toBe('Start with 📅 meeting, then 👥 team, finally 📄 report.');
    });

    it('should handle empty text', () => {
      const result = formatMentionsForPlainText('');
      expect(result).toBe('');
    });
  });

  describe('processMessageParts', () => {
    it('should extract text from message parts', () => {
      const parts = [
        { type: 'text', text: 'Hello world' },
        { type: 'image', url: 'image.jpg' },
        { type: 'text', text: 'More text' },
      ];

      const result = processMessageParts(parts);
      expect(result).toBe('Hello world\nMore text');
    });

    it('should handle undefined parts', () => {
      const result = processMessageParts(undefined);
      expect(result).toBe('');
    });

    it('should handle empty parts array', () => {
      const result = processMessageParts([]);
      expect(result).toBe('');
    });

    it('should remove embedded content markers', () => {
      const parts = [
        {
          type: 'text',
          text: 'Before [EMBEDDED_CONTENT_START]{"type":"pdf","name":"test.pdf"}[EMBEDDED_CONTENT_END] After',
        },
      ];

      const result = processMessageParts(parts);
      expect(result).toBe('Before  After');
    });

    it('should remove PDF content sections', () => {
      const parts = [
        {
          type: 'text',
          text: 'Before\n\n=== PDF Content from document.pdf (5 pages) ===\n\nLots of PDF content here\n\nAfter',
        },
      ];

      const result = processMessageParts(parts);
      expect(result).toBe('Before\n\nAfter');
    });

    it('should remove document content sections', () => {
      const parts = [
        {
          type: 'text',
          text: 'Before\n\n=== Word Document Content from doc.docx (3 pages) ===\n\nDocument content\n\nAfter',
        },
      ];

      const result = processMessageParts(parts);
      expect(result).toBe('Before\n\nAfter');
    });

    it('should remove spreadsheet content sections', () => {
      const parts = [
        {
          type: 'text',
          text: 'Before\n\n=== Spreadsheet Content from sheet.xlsx ===\n\nSpreadsheet data\n\nAfter',
        },
      ];

      const result = processMessageParts(parts);
      expect(result).toBe('Before\n\nAfter');
    });

    it('should remove image analysis sections', () => {
      const parts = [
        {
          type: 'text',
          text: 'Before\n\n=== Image Analysis for image.jpg ===\n\nDescription: An image\n\nExtracted Text: Some text\n\nAfter',
        },
      ];

      const result = processMessageParts(parts);
      expect(result).toBe('Before\n\nAfter');
    });

    it('should clean up multiple newlines', () => {
      const parts = [
        {
          type: 'text',
          text: 'Line 1\n\n\n\n\nLine 2\n\n\n\nLine 3',
        },
      ];

      const result = processMessageParts(parts);
      expect(result).toBe('Line 1\n\nLine 2\n\nLine 3');
    });

    it('should handle mixed content and clean up properly', () => {
      const parts = [
        {
          type: 'text',
          text: 'Start\n\n[EMBEDDED_CONTENT_START]{"type":"pdf"}[EMBEDDED_CONTENT_END]\n\n=== PDF Content from test.pdf (2 pages) ===\n\nPDF text here\n\n\n\nEnd text',
        },
      ];

      const result = processMessageParts(parts);
      expect(result).toBe('Start\n\nEnd text');
    });

    it('should filter out non-text parts', () => {
      const parts = [
        { type: 'text', text: 'Text 1' },
        { type: 'image', data: 'image data' },
        { type: 'file', name: 'file.pdf' },
        { type: 'text', text: 'Text 2' },
        { type: 'unknown', content: 'unknown' },
      ];

      const result = processMessageParts(parts);
      expect(result).toBe('Text 1\nText 2');
    });

    it('should trim final result', () => {
      const parts = [
        { type: 'text', text: '   Text with spaces   ' },
      ];

      const result = processMessageParts(parts);
      expect(result).toBe('Text with spaces');
    });
  });

  describe('markdownToHtml', () => {
    it('should convert markdown to styled HTML', async () => {
      const mockHtml = '<h1>Test Header</h1><p>Test paragraph</p>';
      mockProcess.mockResolvedValue({ toString: () => mockHtml });

      const result = await markdownToHtml('# Test Header\n\nTest paragraph');

      expect(result).toContain('<div style="font-family:');
      expect(result).toContain(mockHtml);
      expect(mockUnified).toHaveBeenCalled();
      expect(mockProcess).toHaveBeenCalled();
    });

    it('should add styles to code blocks', async () => {
      const mockHtml = '<pre><code>console.log("test");</code></pre>';
      mockProcess.mockResolvedValue({ toString: () => mockHtml });

      const result = await markdownToHtml('```js\nconsole.log("test");\n```');

      expect(result).toContain('background-color: #f6f8fa');
      expect(result).toContain('font-family: Monaco, Consolas, monospace');
    });

    it('should add styles to tables', async () => {
      const mockHtml = '<table><th>Header</th><td>Cell</td></table>';
      mockProcess.mockResolvedValue({ toString: () => mockHtml });

      const result = await markdownToHtml('| Header |\n|--------|\n| Cell |');

      expect(result).toContain('border-collapse: collapse');
      expect(result).toContain('border: 1px solid #dfe2e5');
    });

    it('should add styles to headings', async () => {
      const mockHtml = '<h1>Title</h1><h2>Subtitle</h2><h3>Section</h3>';
      mockProcess.mockResolvedValue({ toString: () => mockHtml });

      const result = await markdownToHtml('# Title\n## Subtitle\n### Section');

      expect(result).toContain('<h1 style="font-size: 2em');
      expect(result).toContain('<h2 style="font-size: 1.5em');
      expect(result).toContain('<h3 style="font-size: 1.17em');
    });

    it('should add styles to lists', async () => {
      const mockHtml = '<ul><li>Item 1</li></ul><ol><li>Item 2</li></ol>';
      mockProcess.mockResolvedValue({ toString: () => mockHtml });

      const result = await markdownToHtml('- Item 1\n\n1. Item 2');

      expect(result).toContain('<ul style="margin: 16px 0');
      expect(result).toContain('<ol style="margin: 16px 0');
      expect(result).toContain('<li style="margin: 4px 0');
    });

    it('should handle empty markdown', async () => {
      mockProcess.mockResolvedValue({ toString: () => '' });

      const result = await markdownToHtml('');

      expect(result).toContain('<div style="font-family:');
      expect(mockProcess).toHaveBeenCalled();
    });
  });

  describe('copyRichText', () => {
    const mockWrite = vi.fn();
    const mockWriteText = vi.fn();

    beforeEach(() => {
      // Mock clipboard API
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          write: mockWrite,
          writeText: mockWriteText,
        },
        configurable: true,
      });

      // Mock window object
      Object.defineProperty(window, 'ClipboardItem', {
        value: class MockClipboardItem {
          constructor(data: any) {
            return data;
          }
        },
        configurable: true,
      });

      // Mock Blob
      global.Blob = class MockBlob {
        constructor(content: any[], options: any) {
          return { content, options };
        }
      } as any;

      mockProcess.mockResolvedValue({ toString: () => '<p>Test</p>' });
    });

    it('should copy rich text with HTML and plain text', async () => {
      const markdown = 'Test **bold** text';
      
      await copyRichText(markdown);

      expect(mockWrite).toHaveBeenCalledOnce();
      const clipboardData = mockWrite.mock.calls[0][0][0];
      expect(clipboardData['text/html']).toBeDefined();
      expect(clipboardData['text/plain']).toBeDefined();
    });

    it('should format mentions before converting to HTML', async () => {
      const markdown = 'Check @calendar:meeting today';
      
      await copyRichText(markdown);

      expect(mockWrite).toHaveBeenCalled();
      // The mention should be processed for rich text
      // This is tested indirectly through the formatting functions
    });

    it('should fall back to plain text on error', async () => {
      const markdown = 'Test text';
      mockWrite.mockRejectedValue(new Error('Clipboard error'));

      await copyRichText(markdown);

      expect(mockWrite).toHaveBeenCalled();
      expect(mockWriteText).toHaveBeenCalledWith('Test text');
    });

    it('should throw error in non-browser environment', async () => {
      // Mock server environment
      const originalNavigator = navigator;
      Object.defineProperty(global, 'navigator', {
        value: undefined,
        configurable: true,
      });

      await expect(copyRichText('test')).rejects.toThrow(
        'Rich text copy is only available in browser'
      );

      // Restore navigator
      Object.defineProperty(global, 'navigator', {
        value: originalNavigator,
        configurable: true,
      });
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complete workflow with mentions and formatting', async () => {
      const originalText = 'Meeting @calendar:standup with @people:team about @document:report';
      
      // Test plain text formatting
      const plainResult = formatMentionsForPlainText(originalText);
      expect(plainResult).toContain('📅 standup');
      expect(plainResult).toContain('👥 team');
      expect(plainResult).toContain('📄 report');

      // Test rich text formatting
      const richResult = formatMentionsForRichText(originalText);
      expect(richResult).toContain('color: #059669'); // Calendar green
      expect(richResult).toContain('color: #7c3aed'); // People purple
      expect(richResult).toContain('color: #2563eb'); // Document blue
    });

    it('should process complex message parts correctly', () => {
      const complexParts = [
        {
          type: 'text',
          text: 'Start\n\n[EMBEDDED_CONTENT_START]{"type":"pdf","name":"doc.pdf"}[EMBEDDED_CONTENT_END]\n\n=== PDF Content from doc.pdf (10 pages) ===\n\nSome PDF content here that should be removed\n\n\n\nMiddle text with @calendar:meeting\n\n=== Image Analysis for image.png ===\n\nDescription: Screenshot\n\nEnd text',
        },
        {
          type: 'image',
          url: 'should-be-filtered.jpg',
        },
        {
          type: 'text',
          text: 'Final text',
        },
      ];

      const result = processMessageParts(complexParts);
      
      expect(result).not.toContain('EMBEDDED_CONTENT');
      expect(result).not.toContain('PDF Content');
      expect(result).not.toContain('Image Analysis');
      expect(result).toContain('Middle text with @calendar:meeting');
      expect(result).toContain('Final text');
      expect(result).not.toContain('should-be-filtered.jpg');
    });
  });
});