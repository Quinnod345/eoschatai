/**
 * Utility functions for the multimodal input component
 */

/**
 * Escape HTML characters to prevent XSS
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Highlight the matching prefix in a suggestion string
 */
export function highlightPrefix(suggestion: string, prefix: string): string {
  if (!prefix) return escapeHtml(suggestion);
  const i = suggestion.toLowerCase().indexOf(prefix.toLowerCase());
  if (i !== 0) return escapeHtml(suggestion);
  const head = escapeHtml(suggestion.slice(0, prefix.length));
  const tail = escapeHtml(suggestion.slice(prefix.length));
  return `<span class="predictive-highlight">${head}</span>${tail}`;
}

/**
 * Generate a simple UUID for unique identifiers
 */
export function generateUUID(): string {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
}


