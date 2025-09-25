import type { UserType } from '@/app/(auth)/auth';
import type { ChatModel } from './models';
import { PLAN_VERSION } from '@/lib/entitlements/constants';

interface Entitlements {
  maxMessagesPerDay: number;
  availableChatModelIds: Array<ChatModel['id']>;
}

export const entitlementsByUserType: Record<UserType, Entitlements> = {
  /*
   * For users without an account
   */
  guest: {
    maxMessagesPerDay: 20,
    availableChatModelIds: ['chat-model'],
  },

  /*
   * For users with an account
   */
  regular: {
    maxMessagesPerDay: 10000, // Effectively unlimited for all users
    availableChatModelIds: ['chat-model'],
  },
};

// List of all possible AI tool entitlements
export const getAIToolsEntitlements = (isPaid = false) => {
  // Base tools available to all users
  const baseTools = ['rag'];

  // Premium tools only available to paid users
  const premiumTools = ['image'];

  return isPaid ? [...baseTools, ...premiumTools] : baseTools;
};

export const getActiveTools = (customerId?: string) => {
  // All users get access to all tools
  return [
    ...getAIToolsEntitlements(false),
    'calendar', // Calendar is now available to all users
  ];
};

export const userMayUseChat = (userId?: string) => {
  // Everyone can use the chat
  return true;
};
