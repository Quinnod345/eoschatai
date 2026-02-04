import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computeFileHash, computeStringHash, computeFileHashWithProgress } from '@/lib/utils/file-hash';

// Mock the Web Crypto API
const mockDigest = vi.fn();
const mockCrypto = {
  subtle: {
    digest: mockDigest,
  },
};

// Set up global crypto mock
Object.defineProperty(globalThis, 'crypto', {
  value: mockCrypto,
  configurable: true,
});

describe('File Hash Utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock behavior - return a simple hash buffer
    mockDigest.mockResolvedValue(
      new Uint8Array([0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef]).buffer
    );
  });

  describe('computeFileHash', () => {
    it('should compute hash for a file', async () => {
      const mockFile = {
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
      } as unknown as File;

      const hash = await computeFileHash(mockFile);
      
      expect(mockFile.arrayBuffer).toHaveBeenCalledOnce();
      expect(mockDigest).toHaveBeenCalledWith('SHA-256', expect.any(ArrayBuffer));
      expect(hash).toBe('0123456789abcdef');
      expect(hash).toMatch(/^[0-9a-f]+$/);
      expect(hash.length).toBe(16); // 8 bytes * 2 hex chars per byte
    });

    it('should handle file reading errors', async () => {
      const mockFile = {
        arrayBuffer: vi.fn().mockRejectedValue(new Error('File read error')),
      } as unknown as File;

      await expect(computeFileHash(mockFile)).rejects.toThrow('File read error');
    });

    it('should handle crypto errors', async () => {
      const mockFile = {
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
      } as unknown as File;

      mockDigest.mockRejectedValue(new Error('Crypto error'));

      await expect(computeFileHash(mockFile)).rejects.toThrow('Crypto error');
    });
  });

  describe('computeStringHash', () => {
    it('should compute hash for a string', async () => {
      const testString = 'Hello, World!';
      
      const hash = await computeStringHash(testString);
      
      expect(mockDigest).toHaveBeenCalledWith('SHA-256', expect.any(Uint8Array));
      expect(hash).toBe('0123456789abcdef');
      expect(hash).toMatch(/^[0-9a-f]+$/);
    });

    it('should handle empty strings', async () => {
      const hash = await computeStringHash('');
      
      expect(hash).toBe('0123456789abcdef');
      expect(mockDigest).toHaveBeenCalled();
    });

    it('should handle unicode strings', async () => {
      const unicodeString = '🚀 Hello 世界';
      
      const hash = await computeStringHash(unicodeString);
      
      expect(hash).toBe('0123456789abcdef');
      expect(mockDigest).toHaveBeenCalledWith('SHA-256', expect.any(Uint8Array));
    });
  });

  describe('computeFileHashWithProgress', () => {
    it('should compute hash with progress for small files', async () => {
      const smallFile = {
        size: 1024 * 1024 * 5, // 5MB (small)
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(1024 * 1024 * 5)),
      } as unknown as File;

      const progressCallback = vi.fn();
      const hash = await computeFileHashWithProgress(smallFile, progressCallback);
      
      expect(hash).toBe('0123456789abcdef');
      expect(smallFile.arrayBuffer).toHaveBeenCalled();
    });

    it('should handle large files with progress', async () => {
      const largeFile = {
        size: 1024 * 1024 * 50, // 50MB (large)
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(1024 * 1024 * 50)),
      } as unknown as File;

      const progressCallback = vi.fn();
      const hash = await computeFileHashWithProgress(largeFile, progressCallback);
      
      expect(hash).toBe('0123456789abcdef');
      expect(progressCallback).toHaveBeenCalledWith(100);
    });

    it('should work without progress callback', async () => {
      const file = {
        size: 1024,
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(1024)),
      } as unknown as File;

      const hash = await computeFileHashWithProgress(file);
      
      expect(hash).toBe('0123456789abcdef');
    });
  });

  describe('Hash consistency', () => {
    it('should produce consistent hashes', async () => {
      const content = 'test content';
      
      const hash1 = await computeStringHash(content);
      const hash2 = await computeStringHash(content);
      
      expect(hash1).toBe(hash2);
    });

    it('should produce proper hex format', async () => {
      // Mock with different bytes to test hex conversion
      mockDigest.mockResolvedValue(
        new Uint8Array([0xff, 0x00, 0xab, 0x12, 0x34, 0xcd]).buffer
      );

      const hash = await computeStringHash('test');
      
      expect(hash).toBe('ff00ab1234cd');
      expect(hash).toMatch(/^[0-9a-f]+$/);
    });
  });

  describe('Error handling', () => {
    it('should handle various crypto API errors', async () => {
      const testFile = {
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
      } as unknown as File;

      mockDigest.mockRejectedValue(new Error('Digest failed'));

      await expect(computeFileHash(testFile)).rejects.toThrow('Digest failed');
    });

    it('should handle TextEncoder errors', async () => {
      // Mock TextEncoder to throw
      const originalTextEncoder = global.TextEncoder;
      global.TextEncoder = class {
        encode() {
          throw new Error('Encoding failed');
        }
      } as any;

      await expect(computeStringHash('test')).rejects.toThrow('Encoding failed');

      // Restore
      global.TextEncoder = originalTextEncoder;
    });
  });
});