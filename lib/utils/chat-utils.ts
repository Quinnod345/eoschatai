/**
 * Utility functions for chat title handling
 */

/**
 * Extracts the display title from a chat title that may contain EOS metadata
 * @param title The raw chat title from the database
 * @returns The clean title without metadata for display
 */
export function getDisplayTitle(title: string | null | undefined): string {
  // Handle null/undefined/non-string values
  if (!title || typeof title !== 'string') {
    return 'Untitled Chat';
  }

  if (title.includes('|||EOS_META:')) {
    return title.split('|||EOS_META:')[0];
  }
  return title;
}

/**
 * Extracts EOS Implementer metadata from a chat title
 * @param title The raw chat title from the database
 * @returns Parsed metadata object or null if no metadata found
 */
export function getEOSMetadata(
  title: string,
): { persona: string; profile: string | null } | null {
  if (title.includes('|||EOS_META:')) {
    try {
      const [, metadataPart] = title.split('|||EOS_META:');
      return JSON.parse(metadataPart);
    } catch (error) {
      console.error('Error parsing EOS metadata from title:', error);
      return null;
    }
  }
  return null;
}
