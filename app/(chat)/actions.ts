'use server';

import { generateText, type UIMessage } from 'ai';
import { cookies } from 'next/headers';
import {
  deleteMessagesByChatIdAfterTimestamp,
  getMessageById,
  updateChatVisiblityById,
} from '@/lib/db/queries';
import type { VisibilityType } from '@/components/visibility-selector';
import { createCustomProvider, DEFAULT_PROVIDER } from '@/lib/ai/providers';

export async function saveChatModelAsCookie(model: string) {
  const cookieStore = await cookies();
  cookieStore.set('chat-model', model);
}

export async function saveProviderAsCookie(provider: string) {
  const cookieStore = await cookies();
  cookieStore.set('ai-provider', provider);
}

export async function generateTitleFromUserMessage({
  message,
}: {
  message: UIMessage;
}) {
  // Get the current provider from cookies
  const cookieStore = await cookies();
  const providerFromCookie = cookieStore.get('ai-provider');
  const selectedProvider = providerFromCookie?.value || DEFAULT_PROVIDER;

  // Create the provider based on the cookie value
  const provider = createCustomProvider(selectedProvider);

  const { text: title } = await generateText({
    model: provider.languageModel('title-model'),
    system: `You generate short chat titles. Rules:
- Output ONLY the title text, nothing else
- Maximum 80 characters
- No quotes, colons, or explanations
- If the message is a simple greeting like "hi" or "hello", title it as "New Conversation"
- Summarize the user's intent or topic concisely`,
    prompt: JSON.stringify(message),
  });

  return title;
}

export async function deleteTrailingMessages({ id }: { id: string }) {
  const [message] = await getMessageById({ id });

  await deleteMessagesByChatIdAfterTimestamp({
    chatId: message.chatId,
    timestamp: message.createdAt,
  });
}

export async function updateChatVisibility({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: VisibilityType;
}) {
  await updateChatVisiblityById({ chatId, visibility });
}
