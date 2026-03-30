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
import { extractPrimaryMessageText } from '@/lib/ai/chat-route-helpers';

function normalizeTitleSource(text: string): string {
  return text
    .replace(/\[MENTIONS_META_BEGIN\][\s\S]*?\[MENTIONS_META_END\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function fallbackTitleFromText(text: string): string {
  const cleaned = normalizeTitleSource(text);

  if (!cleaned) {
    return 'Untitled Chat';
  }

  if (/^(hi|hello|hey|yo|sup|what'?s up|good (morning|afternoon|evening))[\s!.?]*$/i.test(cleaned)) {
    return 'Greeting Conversation';
  }

  const chars = Array.from(cleaned);
  const truncated = chars.slice(0, 80).join('');

  return truncated + (chars.length > 80 ? '...' : '');
}

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
  const messageText = normalizeTitleSource(extractPrimaryMessageText(message));

  if (!messageText) {
    return 'Untitled Chat';
  }

  const cookieStore = await cookies();
  const providerFromCookie = cookieStore.get('ai-provider');
  const selectedProvider = providerFromCookie?.value || DEFAULT_PROVIDER;

  const system = `You generate short chat titles. Rules:
- Output ONLY the title text, nothing else
- Maximum 80 characters
- No quotes, colons, or explanations
- Summarize the user's intent or topic concisely
- For very short inputs, still return the best possible short title based on the exact text
- If the input is only a greeting like "hi", "hello", or "hey", prefer a title like "Greeting Conversation"
- Never refuse just because the input is short`;

  // Try the user's selected provider first, then fall back to openai
  const providersToTry = selectedProvider === 'openai'
    ? ['openai']
    : [selectedProvider, 'openai'];

  for (const providerName of providersToTry) {
    try {
      const provider = createCustomProvider(providerName);
      const { text: title } = await generateText({
        model: provider.languageModel('title-model'),
        system,
        prompt: messageText,
      });
      const cleanedTitle = normalizeTitleSource(title);
      return cleanedTitle || fallbackTitleFromText(messageText);
    } catch {
      // Try next provider
    }
  }

  return fallbackTitleFromText(messageText);
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
