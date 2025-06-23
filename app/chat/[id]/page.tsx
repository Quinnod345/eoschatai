import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';

import { auth } from '@/app/(auth)/auth';
import { ChatClientWrapper } from '@/components/chat-client-wrapper';
import {
  getChatById,
  getMessagesByChatId,
  getUserSettings,
} from '@/lib/db/queries';
import { DEFAULT_CHAT_MODEL } from '@/lib/ai/models';
import { DEFAULT_PROVIDER } from '@/lib/ai/providers';
import { getDisplayTitle, getEOSMetadata } from '@/lib/utils/chat-utils';
import type { DBMessage, Chat as ChatType } from '@/lib/db/schema';
import type { Attachment, UIMessage } from 'ai';
import type { ResearchMode } from '@/components/nexus-research-selector';

// Silent logger to prevent errors from showing on screen during development
const silentLog = {
  debug: (message: string, ...args: any[]) => {
    if (
      process.env.NODE_ENV !== 'production' &&
      process.env.SILENT_LOGS !== 'true'
    ) {
      // Use a more subtle console method that won't trigger browser error displays
      console.groupCollapsed(`[Debug] ${message}`);
      if (args.length > 0) console.debug(...args);
      console.groupEnd();
    }
  },
  error: (message: string, error?: unknown) => {
    if (
      process.env.NODE_ENV !== 'production' &&
      process.env.SILENT_LOGS !== 'true'
    ) {
      // Log errors in a way that doesn't trigger the browser's error UI
      console.groupCollapsed(`[Error] ${message}`);
      if (error) console.debug(error);
      console.groupEnd();
    }
  },
};

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { id } = params;

  // Add error handling and retry logic for getting the chat
  let chat: ChatType | null = null;
  let retryCount = 0;
  const maxRetries = 3;

  while (!chat && retryCount < maxRetries) {
    try {
      chat = await getChatById({ id });
      if (!chat) {
        silentLog.debug(
          `Chat with ID ${id} not found, retry ${retryCount + 1}/${maxRetries}`,
        );
        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, 500));
        retryCount++;
      }
    } catch (error: unknown) {
      silentLog.error(`Error fetching chat with ID ${id}`, error);
      retryCount++;
      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  if (!chat) {
    silentLog.error(
      `Chat with ID ${id} still not found after ${maxRetries} retries`,
    );
    return notFound();
  }

  const session = await auth();

  if (!session) {
    return redirect('/login');
  }

  if (chat.visibility === 'private') {
    if (!session.user) {
      return notFound();
    }

    if (session.user.id !== chat.userId) {
      return notFound();
    }
  }

  // Add error handling and retry for message fetching
  let messagesFromDb: DBMessage[] = [];
  retryCount = 0;

  while (messagesFromDb.length === 0 && retryCount < maxRetries) {
    try {
      const result = await getMessagesByChatId({
        id,
      });

      if (result && result.length > 0) {
        messagesFromDb = result;
      } else {
        silentLog.debug(
          `No messages found for chat ID ${id}, retry ${retryCount + 1}/${maxRetries}`,
        );
        await new Promise((resolve) => setTimeout(resolve, 500));
        retryCount++;
      }
    } catch (error: unknown) {
      silentLog.error(`Error fetching messages for chat ID ${id}`, error);
      retryCount++;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  // If we still don't have messages, log the issue but continue with empty array
  if (messagesFromDb.length === 0) {
    silentLog.debug(
      `Using empty message array for chat ID ${id} after ${maxRetries} retries`,
    );
  }

  function convertToUIMessages(messages: Array<DBMessage>): Array<UIMessage> {
    return messages.map((message) => ({
      id: message.id,
      parts: message.parts as UIMessage['parts'],
      role: message.role as UIMessage['role'],
      // Note: content will soon be deprecated in @ai-sdk/react
      content: '',
      createdAt: message.createdAt,
      experimental_attachments:
        (message.attachments as Array<Attachment>) ?? [],
      // Add provider information if available
      provider:
        message.provider || providerFromCookie?.value || DEFAULT_PROVIDER,
    }));
  }

  const cookieStore = await cookies();
  const chatModelFromCookie = cookieStore.get('chat-model');
  const providerFromCookie = cookieStore.get('ai-provider');

  // Get user settings to retrieve research mode preference
  let userResearchMode: ResearchMode = 'off';
  try {
    const userSettings = await getUserSettings({ userId: session.user.id });
    console.log('[ExistingChat] User settings fetched:', {
      chatId: id,
      userId: session.user.id,
      selectedResearchMode: userSettings?.selectedResearchMode,
    });

    if (userSettings?.selectedResearchMode) {
      const rawMode = userSettings.selectedResearchMode;
      // Ensure we only accept valid research modes
      userResearchMode = rawMode === 'nexus' ? 'nexus' : 'off';
      console.log('[ExistingChat] Research mode set:', {
        chatId: id,
        rawMode,
        validatedMode: userResearchMode,
      });
    }
  } catch (error) {
    console.error(
      '[ExistingChat] Error fetching user settings for research mode:',
      error,
    );
  }

  // Check if this is an EOS Implementer chat from metadata in title
  let initialPersonaId = chat.personaId || undefined;
  let initialProfileId = chat.profileId || undefined;
  const displayTitle = getDisplayTitle(chat.title);

  // Extract EOS Implementer metadata from title if present
  const eosMetadata = getEOSMetadata(chat.title);
  if (eosMetadata && eosMetadata.persona === 'eos-implementer') {
    initialPersonaId = '00000000-0000-0000-0000-000000000001';
    initialProfileId = eosMetadata.profile || undefined;

    console.log('CHAT_PAGE: Restored EOS Implementer from metadata', {
      personaId: initialPersonaId,
      profileId: initialProfileId,
      originalTitle: chat.title,
      displayTitle: displayTitle,
    });
  }

  // Check if this is a voice chat - disable auto-resume for voice chats
  const isVoiceChat =
    chat.metadata?.isVoiceChat || chat.title?.includes('🎤 Voice Chat');
  const shouldAutoResume = !isVoiceChat && messagesFromDb.length > 0;

  if (!chatModelFromCookie || !providerFromCookie) {
    return (
      <ChatClientWrapper
        id={chat.id}
        initialMessages={convertToUIMessages(messagesFromDb)}
        initialChatModel={DEFAULT_CHAT_MODEL}
        initialProvider={DEFAULT_PROVIDER}
        initialVisibilityType={chat.visibility}
        isReadonly={session?.user?.id !== chat.userId}
        session={session}
        autoResume={shouldAutoResume}
        initialPersonaId={initialPersonaId}
        initialProfileId={initialProfileId}
        initialResearchMode={userResearchMode}
      />
    );
  }

  return (
    <ChatClientWrapper
      id={chat.id}
      initialMessages={convertToUIMessages(messagesFromDb)}
      initialChatModel={chatModelFromCookie.value}
      initialProvider={providerFromCookie.value}
      initialVisibilityType={chat.visibility}
      isReadonly={session?.user?.id !== chat.userId}
      session={session}
      autoResume={shouldAutoResume}
      initialPersonaId={initialPersonaId}
      initialProfileId={initialProfileId}
      initialResearchMode={userResearchMode}
    />
  );
}
