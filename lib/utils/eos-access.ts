/**
 * Check if a user should have access to the EOS Implementer persona
 * @param email - User's email address
 * @returns boolean indicating if user should have EOS access
 */
export function hasEOSAccess(email: string): boolean {
  if (!email) return false;

  // EOS Worldwide domain users
  if (email.endsWith('@eosworldwide.com')) {
    return true;
  }

  // Specific exceptions
  const exceptions = ['quinn@upaway.dev'];

  return exceptions.includes(email.toLowerCase());
}

/**
 * Get the system EOS Implementer persona ID
 * This is a constant that represents the system-level EOS persona
 */
export const SYSTEM_EOS_IMPLEMENTER_PERSONA_NAME = 'EOS Implementer';
