import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getDisplayTitle, getEOSMetadata } from '@/lib/utils/chat-utils';

describe('Chat Utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear console.error mock if it exists
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('getDisplayTitle', () => {
    it('should return clean title without EOS metadata', () => {
      const title = 'Weekly Team Meeting|||EOS_META:{"persona":"eos-implementer","profile":"123"}';
      const result = getDisplayTitle(title);
      expect(result).toBe('Weekly Team Meeting');
    });

    it('should return title as-is if no metadata present', () => {
      const title = 'Regular Chat Title';
      const result = getDisplayTitle(title);
      expect(result).toBe('Regular Chat Title');
    });

    it('should handle null title', () => {
      const result = getDisplayTitle(null);
      expect(result).toBe('Untitled Chat');
    });

    it('should handle undefined title', () => {
      const result = getDisplayTitle(undefined);
      expect(result).toBe('Untitled Chat');
    });

    it('should handle empty string', () => {
      const result = getDisplayTitle('');
      expect(result).toBe('Untitled Chat');
    });

    it('should handle non-string types', () => {
      // @ts-expect-error - Testing runtime behavior with wrong types
      const result1 = getDisplayTitle(123);
      // @ts-expect-error - Testing runtime behavior with wrong types
      const result2 = getDisplayTitle({});
      // @ts-expect-error - Testing runtime behavior with wrong types
      const result3 = getDisplayTitle([]);

      expect(result1).toBe('Untitled Chat');
      expect(result2).toBe('Untitled Chat');
      expect(result3).toBe('Untitled Chat');
    });

    it('should handle title with multiple metadata separators', () => {
      const title = 'First Part|||EOS_META:data|||More|||EOS_META:more';
      const result = getDisplayTitle(title);
      expect(result).toBe('First Part');
    });

    it('should handle whitespace in titles', () => {
      const title = '  Whitespace Title  |||EOS_META:{"test":true}';
      const result = getDisplayTitle(title);
      expect(result).toBe('  Whitespace Title  ');
    });

    it('should handle special characters in titles', () => {
      const title = 'Title with émojis 🚀 and spéçial çhars|||EOS_META:{}';
      const result = getDisplayTitle(title);
      expect(result).toBe('Title with émojis 🚀 and spéçial çhars');
    });
  });

  describe('getEOSMetadata', () => {
    it('should parse valid EOS metadata', () => {
      const title = 'Chat Title|||EOS_META:{"persona":"eos-implementer","profile":"prof123"}';
      const result = getEOSMetadata(title);
      
      expect(result).toEqual({
        persona: 'eos-implementer',
        profile: 'prof123',
      });
    });

    it('should handle metadata with null profile', () => {
      const title = 'Chat Title|||EOS_META:{"persona":"eos-implementer","profile":null}';
      const result = getEOSMetadata(title);
      
      expect(result).toEqual({
        persona: 'eos-implementer',
        profile: null,
      });
    });

    it('should return null for title without metadata', () => {
      const title = 'Regular Chat Title';
      const result = getEOSMetadata(title);
      expect(result).toBeNull();
    });

    it('should handle invalid JSON in metadata', () => {
      const title = 'Chat Title|||EOS_META:{invalid json}';
      const result = getEOSMetadata(title);
      
      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalledWith(
        'Error parsing EOS metadata from title:',
        expect.any(Error)
      );
    });

    it('should handle empty metadata', () => {
      const title = 'Chat Title|||EOS_META:{}';
      const result = getEOSMetadata(title);
      expect(result).toEqual({});
    });

    it('should handle metadata with extra fields', () => {
      const title = 'Chat Title|||EOS_META:{"persona":"eos","profile":"123","extra":"data","nested":{"key":"value"}}';
      const result = getEOSMetadata(title);
      
      expect(result).toEqual({
        persona: 'eos',
        profile: '123',
        extra: 'data',
        nested: { key: 'value' },
      });
    });

    it('should handle malformed metadata separator', () => {
      const title = 'Chat Title|||EOS_META:';
      const result = getEOSMetadata(title);
      
      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalledWith(
        'Error parsing EOS metadata from title:',
        expect.any(Error)
      );
    });

    it('should handle multiple metadata separators (uses first one)', () => {
      const title = 'Title|||EOS_META:{"first":true}|||EOS_META:{"second":true}';
      const result = getEOSMetadata(title);
      
      expect(result).toEqual({ first: true });
    });

    it('should handle complex nested metadata', () => {
      const complexMetadata = {
        persona: 'eos-implementer',
        profile: 'profile-456',
        settings: {
          autoSave: true,
          theme: 'dark',
          features: ['feature1', 'feature2'],
        },
        timestamp: 1640995200000,
      };
      
      const title = `Complex Chat|||EOS_META:${JSON.stringify(complexMetadata)}`;
      const result = getEOSMetadata(title);
      
      expect(result).toEqual(complexMetadata);
    });

    it('should handle metadata with unicode characters', () => {
      const title = 'Chat Title|||EOS_META:{"persona":"eos-implementer","description":"Meeting about 🚀 implementation"}';
      const result = getEOSMetadata(title);
      
      expect(result).toEqual({
        persona: 'eos-implementer',
        description: 'Meeting about 🚀 implementation',
      });
    });
  });

  describe('Error handling', () => {
    it('should handle JSON.parse throwing unexpected errors', () => {
      // Mock JSON.parse to throw a custom error
      const originalParse = JSON.parse;
      JSON.parse = vi.fn().mockImplementation(() => {
        throw new Error('Custom JSON parse error');
      });

      const title = 'Chat Title|||EOS_META:{"valid":"json"}';
      const result = getEOSMetadata(title);
      
      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalledWith(
        'Error parsing EOS metadata from title:',
        expect.any(Error)
      );

      // Restore original JSON.parse
      JSON.parse = originalParse;
    });
  });

  describe('Integration scenarios', () => {
    it('should work correctly with realistic EOS implementer chat titles', () => {
      const scenarios = [
        {
          title: 'EOS L10 Session Planning|||EOS_META:{"persona":"eos-implementer","profile":"l10-facilitator"}',
          expectedDisplay: 'EOS L10 Session Planning',
          expectedMeta: { persona: 'eos-implementer', profile: 'l10-facilitator' },
        },
        {
          title: 'Quarterly Review Discussion|||EOS_META:{"persona":"eos-implementer","profile":null}',
          expectedDisplay: 'Quarterly Review Discussion',
          expectedMeta: { persona: 'eos-implementer', profile: null },
        },
        {
          title: 'Regular Team Chat',
          expectedDisplay: 'Regular Team Chat',
          expectedMeta: null,
        },
      ];

      scenarios.forEach(({ title, expectedDisplay, expectedMeta }) => {
        expect(getDisplayTitle(title)).toBe(expectedDisplay);
        expect(getEOSMetadata(title)).toEqual(expectedMeta);
      });
    });
  });
});