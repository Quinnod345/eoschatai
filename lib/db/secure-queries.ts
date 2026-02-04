import 'server-only';

import { auth } from '@/app/(auth)/auth';
import type { Session } from 'next-auth';
import { getChatById, getMessagesByChatId } from './queries';
import { isAdminEmail } from '@/lib/auth/admin';

/**
 * Secure wrapper for getChatById that includes user authorization
 * @param id Chat ID
 * @param session Optional session (will fetch if not provided)
 * @returns Chat object if user has access, null if not found or unauthorized
 */
export async function getSecureChatById(
  id: string,
  session?: Session | null
): Promise<any | null> {
  const currentSession = session ?? (await auth());
  
  if (!currentSession?.user?.id) {
    return null;
  }

  const chat = await getChatById({ id });
  
  if (!chat) {
    return null;
  }

  // Check if user owns the chat, if it's public, or if user is admin
  const isAdminUser = isAdminEmail(currentSession.user.email);
  
  if (
    chat.userId === currentSession.user.id ||
    chat.visibility === 'public' ||
    isAdminUser
  ) {
    return chat;
  }

  return null;
}

/**
 * Secure wrapper for getMessagesByChatId that includes chat access authorization
 * @param id Chat ID
 * @param session Optional session (will fetch if not provided)
 * @returns Messages array if user has access, empty array if unauthorized
 */
export async function getSecureMessagesByChatId(
  id: string,
  session?: Session | null
): Promise<any[]> {
  const currentSession = session ?? (await auth());
  
  if (!currentSession?.user?.id) {
    return [];
  }

  // First check if user has access to the chat
  const chat = await getSecureChatById(id, currentSession);
  
  if (!chat) {
    return [];
  }

  // If chat access is verified, get the messages
  return await getMessagesByChatId({ id });
}

/**
 * Verify user owns a chat or has admin access
 * @param chatId Chat ID
 * @param userId User ID to check
 * @param session Optional session (will fetch if not provided)
 * @returns true if user has access, false otherwise
 */
export async function verifyUserChatAccess(
  chatId: string,
  userId: string,
  session?: Session | null
): Promise<boolean> {
  const chat = await getSecureChatById(chatId, session);
  
  if (!chat) {
    return false;
  }

  const currentSession = session ?? (await auth());
  const isAdminUser = isAdminEmail(currentSession?.user?.email);

  return chat.userId === userId || chat.visibility === 'public' || isAdminUser;
}