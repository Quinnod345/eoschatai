import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computeFileHash, computeStringHash, computeFileHashWithProgress } from '@/lib/utils/file-hash';

// Mock the Web Crypto API
const mockCrypto = {
  subtle: {
    digest: vi.fn(),
  },
};

// Mock globalThis.crypto
Object.defineProperty(globalThis, 'crypto', {
  value: mockCrypto,
  configurable: true,
});

describe('File Hash Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('computeFileHash', () => {
    it('should compute SHA-256 hash for a file', async () => {
      const mockFile = {
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
      } as unknown as File;

      // Mock the crypto.subtle.digest to return a known hash
      const mockHashBuffer = new Uint8Array([
        0x6e, 0x34, 0x0b, 0x9c, 0xff, 0xb3, 0x7a, 0x98,
        0x9c, 0xa5, 0x44, 0xe6, 0xbb, 0x78, 0x0a, 0x2c,
        0x78, 0x90, 0x1d, 0x3f, 0xb3, 0x37, 0x38, 0x76,
        0x85, 0x11, 0xa3, 0x06, 0x17, 0xaf, 0xa0, 0x1d,
      ]).buffer;

      mockCrypto.subtle.digest.mockResolvedValue(mockHashBuffer);

      const hash = await computeFileHash(mockFile);
      
      expect(mockFile.arrayBuffer).toHaveBeenCalledOnce();
      expect(mockCrypto.subtle.digest).toHaveBeenCalledWith('SHA-256', expect.any(ArrayBuffer));
      expect(hash).toBe('6e340b9cffb37a989ca544e6bb780a2c78901d3fb33738768511a30617afa01d');
    });

    it('should handle empty files', async () => {
      const mockFile = {
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
      } as unknown as File;

      const emptyHashBuffer = new Uint8Array(32).fill(0).buffer; // Mock empty hash
      mockCrypto.subtle.digest.mockResolvedValue(emptyHashBuffer);

      const hash = await computeFileHash(mockFile);
      
      expect(hash).toBe('0000000000000000000000000000000000000000000000000000000000000000');
      expect(hash).toHaveLength(64); // SHA-256 hex string is 64 chars
    });
  });

  describe('computeStringHash', () => {
    it('should compute SHA-256 hash for a string', async () => {
      const testString = 'Hello, World!';
      const mockHashBuffer = new Uint8Array([
        0xdf, 0xfd, 0x60, 0x21, 0xbb, 0x2b, 0xd5, 0xb0,
        0xaf, 0x67, 0x62, 0x90, 0x80, 0x9e, 0xc3, 0xa5,
        0x31, 0x91, 0xdd, 0x81, 0xc7, 0xf7, 0x0a, 0x4b,
        0x28, 0x68, 0x8a, 0x36, 0x21, 0x82, 0x98, 0x6f,
      ]).buffer;

      mockCrypto.subtle.digest.mockResolvedValue(mockHashBuffer);

      const hash = await computeStringHash(testString);
      
      expect(mockCrypto.subtle.digest).toHaveBeenCalledWith('SHA-256', expect.any(Uint8Array));
      expect(hash).toBe('dffd6021bb2bd5b0af676290809ec3a53191dd81c7f70a4b28688a362182986f');
    });

    it('should handle empty strings', async () => {
      const emptyString = '';
      const emptyHashBuffer = new Uint8Array(32).fill(0).buffer;
      mockCrypto.subtle.digest.mockResolvedValue(emptyHashBuffer);

      const hash = await computeStringHash(emptyString);
      
      expect(hash).toBe('0000000000000000000000000000000000000000000000000000000000000000');
    });

    it('should handle unicode strings', async () => {
      const unicodeString = '🚀 Hello 世界 🌍';
      const mockHashBuffer = new Uint8Array(32).fill(0x42).buffer; // Mock hash
      mockCrypto.subtle.digest.mockResolvedValue(mockHashBuffer);

      const hash = await computeStringHash(unicodeString);
      
      expect(hash).toHaveLength(64);
      expect(hash).toBe('4242424242424242424242424242424242424242424242424242424242424242');
    });
  });

  describe('computeFileHashWithProgress', () => {
    it('should use simple hash for small files', async () => {
      const smallFile = {
        size: 1024 * 1024 * 5, // 5MB (smaller than threshold)
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(1024 * 1024 * 5)),
      } as unknown as File;

      const mockHashBuffer = new Uint8Array(32).fill(0x11).buffer;
      mockCrypto.subtle.digest.mockResolvedValue(mockHashBuffer);

      const progressCallback = vi.fn();
      const hash = await computeFileHashWithProgress(smallFile, progressCallback);
      
      expect(hash).toHaveLength(64);
      // For small files, it should use the simple approach
      expect(smallFile.arrayBuffer).toHaveBeenCalledOnce();
    });

    it('should handle large files with progress callback', async () => {
      const largeFile = {
        size: 1024 * 1024 * 50, // 50MB (larger than threshold)
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(1024 * 1024 * 50)),
      } as unknown as File;

      const mockHashBuffer = new Uint8Array(32).fill(0x33).buffer;
      mockCrypto.subtle.digest.mockResolvedValue(mockHashBuffer);

      const progressCallback = vi.fn();
      const hash = await computeFileHashWithProgress(largeFile, progressCallback);
      
      expect(hash).toHaveLength(64);
      expect(progressCallback).toHaveBeenCalledWith(100);
    });

    it('should work without progress callback', async () => {
      const file = {
        size: 1024,
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(1024)),
      } as unknown as File;

      const mockHashBuffer = new Uint8Array(32).fill(0x55).buffer;
      mockCrypto.subtle.digest.mockResolvedValue(mockHashBuffer);

      const hash = await computeFileHashWithProgress(file);
      
      expect(hash).toHaveLength(64);
      expect(hash).toBe('5555555555555555555555555555555555555555555555555555555555555555');
    });
  });

  describe('Hash consistency', () => {
    it('should produce consistent hashes for same input', async () => {
      const content = 'consistent test content';
      const mockHashBuffer = new Uint8Array(32).fill(0x77).buffer;
      mockCrypto.subtle.digest.mockResolvedValue(mockHashBuffer);

      const hash1 = await computeStringHash(content);
      const hash2 = await computeStringHash(content);
      
      expect(hash1).toBe(hash2);
      expect(hash1).toBe('7777777777777777777777777777777777777777777777777777777777777777');
    });

    it('should produce different hashes for different inputs', async () => {
      const content1 = 'content one';
      const content2 = 'content two';
      
      // Mock different hashes for different inputs
      mockCrypto.subtle.digest
        .mockResolvedValueOnce(new Uint8Array(32).fill(0x11).buffer)
        .mockResolvedValueOnce(new Uint8Array(32).fill(0x22).buffer);

      const hash1 = await computeStringHash(content1);
      const hash2 = await computeStringHash(content2);
      
      expect(hash1).not.toBe(hash2);
      expect(hash1).toBe('1111111111111111111111111111111111111111111111111111111111111111');
      expect(hash2).toBe('2222222222222222222222222222222222222222222222222222222222222222');
    });
  });

  describe('Error handling', () => {
    it('should handle crypto.subtle.digest errors', async () => {
      const file = {
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
      } as unknown as File;

      mockCrypto.subtle.digest.mockRejectedValue(new Error('Crypto API error'));

      await expect(computeFileHash(file)).rejects.toThrow('Crypto API error');
    });

    it('should handle file.arrayBuffer errors', async () => {
      const file = {
        arrayBuffer: vi.fn().mockRejectedValue(new Error('File read error')),
      } as unknown as File;

      await expect(computeFileHash(file)).rejects.toThrow('File read error');
    });
  });
});