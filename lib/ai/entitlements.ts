import type { UserType } from '@/app/(auth)/auth';
import type { ChatModel } from './models';

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
    availableChatModelIds: ['chat-model', 'chat-model-reasoning'],
  },

  /*
   * For users with an account
   */
  regular: {
    maxMessagesPerDay: 100,
    availableChatModelIds: ['chat-model', 'chat-model-reasoning'],
  },

  /*
   * TODO: For users with an account and a paid membership
   */
};

// List of all possible AI tool entitlements
export const getAIToolsEntitlements = (isPaid: boolean = false) => {
  // Base tools available to all users
  const baseTools = ['rag'];

  // Premium tools only available to paid users
  const premiumTools = ['image'];

  return isPaid ? [...baseTools, ...premiumTools] : baseTools;
};

export const getActiveTools = (customerId?: string) => {
  // All users get access to base tools and calendar tools
  return [...getAIToolsEntitlements(!!customerId), 'calendar'];
};

export const userMayUseChat = (userId?: string) => {
  // Everyone can use the chat
  return true;
};
