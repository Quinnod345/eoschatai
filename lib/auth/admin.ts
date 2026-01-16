import 'server-only';

import { auth } from '@/app/(auth)/auth';
import type { Session } from 'next-auth';

/**
 * List of admin email addresses from environment variable
 * Format: comma-separated list of emails
 * Example: ADMIN_EMAILS="admin@example.com,superuser@example.com"
 */
function getAdminEmails(): string[] {
  const adminEmails = process.env.ADMIN_EMAILS;
  if (!adminEmails) {
    return [];
  }
  return adminEmails
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email.length > 0);
}

/**
 * Check if a given email address has admin privileges
 * @param email - Email address to check
 * @returns True if the email is an admin
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const adminEmails = getAdminEmails();
  return adminEmails.includes(email.toLowerCase());
}

/**
 * Check if the current session user is an admin
 * @param session - Optional session object (will fetch if not provided)
 * @returns True if the current user is an admin
 */
export async function isCurrentUserAdmin(
  session?: Session | null,
): Promise<boolean> {
  const currentSession = session ?? (await auth());
  if (!currentSession?.user?.email) {
    return false;
  }
  return isAdminEmail(currentSession.user.email);
}

/**
 * Require admin privileges for a route handler
 * Returns an error response if not admin, or null if admin
 *
 * @example
 * ```ts
 * const session = await auth();
 * const adminError = await requireAdmin(session);
 * if (adminError) return adminError;
 * // ... admin-only logic
 * ```
 */
export async function requireAdmin(
  session?: Session | null,
): Promise<Response | null> {
  const currentSession = session ?? (await auth());

  if (!currentSession?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isAdminEmail(currentSession.user.email)) {
    return Response.json(
      { error: 'Forbidden: Admin access required' },
      { status: 403 },
    );
  }

  return null;
}

/**
 * Get admin status and session info
 * Useful for routes that need both admin status and user info
 */
export async function getAdminContext(): Promise<{
  session: Session | null;
  isAdmin: boolean;
  userId: string | null;
  email: string | null;
}> {
  const session = await auth();
  const email = session?.user?.email ?? null;
  const userId = session?.user?.id ?? null;
  const isAdmin = isAdminEmail(email);

  return {
    session,
    isAdmin,
    userId,
    email,
  };
}



