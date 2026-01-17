'use client';

// Lazy-loaded DOMPurify for client-side only sanitization
let purify: typeof import('dompurify') | null = null;

export function sanitizeHtml(html: string): string {
  // Only run on client
  if (typeof window === 'undefined') {
    return html;
  }
  
  // Lazy load DOMPurify
  if (!purify) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    purify = require('dompurify');
  }
  
  const p = purify!;
  return p.default ? p.default.sanitize(html) : (p as any).sanitize(html);
}
