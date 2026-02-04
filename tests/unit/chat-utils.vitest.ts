// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getDisplayTitle, getEOSMetadata } from '@/lib/utils/chat-utils';

describe('Chat Utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock console.error to avoid noise in test output
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

    it('should handle null and undefined titles', () => {
      expect(getDisplayTitle(null)).toBe('Untitled Chat');
      expect(getDisplayTitle(undefined)).toBe('Untitled Chat');
    });

    it('should handle empty string', () => {
      const result = getDisplayTitle('');
      expect(result).toBe('Untitled Chat');
    });

    it('should handle non-string types gracefully', () => {
      // @ts-expect-error - Testing runtime behavior
      expect(getDisplayTitle(123)).toBe('Untitled Chat');
      // @ts-expect-error - Testing runtime behavior  
      expect(getDisplayTitle({})).toBe('Untitled Chat');
      // @ts-expect-error - Testing runtime behavior
      expect(getDisplayTitle([])).toBe('Untitled Chat');
    });

    it('should handle title with multiple metadata separators', () => {
      const title = 'First Part|||EOS_META:data|||More Text|||EOS_META:more';
      const result = getDisplayTitle(title);
      
      expect(result).toBe('First Part');
    });

    it('should preserve whitespace in titles', () => {
      const title = '  Whitespace Title  |||EOS_META:{"test":true}';
      const result = getDisplayTitle(title);
      
      expect(result).toBe('  Whitespace Title  ');
    });

    it('should handle special characters', () => {
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
      expect(console.error).toHaveBeenCalled();
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

  describe('Integration scenarios', () => {
    it('should handle realistic EOS implementer chat titles', () => {
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

    it('should handle edge cases in real usage', () => {
      // Empty metadata content
      const emptyMeta = 'Title|||EOS_META:';
      expect(getDisplayTitle(emptyMeta)).toBe('Title');
      expect(getEOSMetadata(emptyMeta)).toBeNull();

      // Only separator, no content
      const onlySeparator = 'Title|||EOS_META';
      expect(getDisplayTitle(onlySeparator)).toBe('Title|||EOS_META');
      expect(getEOSMetadata(onlySeparator)).toBeNull();

      // Malformed JSON
      const malformed = 'Title|||EOS_META:{"incomplete":true';
      expect(getDisplayTitle(malformed)).toBe('Title');
      expect(getEOSMetadata(malformed)).toBeNull();
    });
  });

  describe('Error resilience', () => {
    it('should not throw on various edge cases', () => {
      const edgeCases = [
        '',
        '|||',
        '|||EOS_META:',
        '|||EOS_META:null',
        '|||EOS_META:undefined', 
        '|||EOS_META:[1,2,3]',
        '|||EOS_META:"string"',
        'Normal|||EOS_META:{"valid":true}|||More text',
      ];

      edgeCases.forEach(testCase => {
        expect(() => getDisplayTitle(testCase)).not.toThrow();
        expect(() => getEOSMetadata(testCase)).not.toThrow();
      });
    });

    it('should handle JSON.parse exceptions gracefully', () => {
      // Test with various malformed JSON
      const malformedCases = [
        'Title|||EOS_META:{broken:json}',
        'Title|||EOS_META:{"unclosed":true',
        'Title|||EOS_META:}{"reversed":true{',
        'Title|||EOS_META:{"trailing":true,}',
      ];

      malformedCases.forEach(testCase => {
        expect(getEOSMetadata(testCase)).toBeNull();
        expect(console.error).toHaveBeenCalled();
      });
    });
  });
});