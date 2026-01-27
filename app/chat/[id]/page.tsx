import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';

import { auth } from '@/app/(auth)/auth';
import { ChatClientWrapper } from '@/components/chat-client-wrapper';
import ClientRedirect from '@/components/client-redirect';
import {
  getChatById,
  getMessagesByChatId,
  getUserSettings,
} from '@/lib/db/queries';
import { DEFAULT_CHAT_MODEL } from '@/lib/ai/models';
import { DEFAULT_PROVIDER } from '@/lib/ai/providers';
import type { ResearchMode } from '@/components/nexus-research-selector';
import type { DBMessage, Chat as ChatType } from '@/lib/db/schema';
import type { UIMessage } from 'ai';
import { Suspense } from 'react';
import { ChatLoading } from '@/components/chat-loading';
import { convertV4MessageToV5 } from '@/lib/ai/convert-messages';

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
  return (
    <Suspense fallback={<ChatLoading />}>
      <ChatPageContent {...props} />
    </Suspense>
  );
}

async function ChatPageContent(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { id } = params;

  // Function to convert DB messages to UI messages
  // AI SDK 5: Use conversion function to handle v4 → v5 format changes
  function convertToUIMessages(messages: Array<DBMessage>): Array<UIMessage> {
    return messages.map((message, index) => {
      // Convert attachments to file parts and merge with existing parts
      const attachmentParts = Array.isArray(message.attachments)
        ? message.attachments.map((att: any) => ({
            type: 'file' as const,
            url: att.url,
            mediaType: att.contentType || att.mediaType,
            name: att.name,
          }))
        : [];

      const existingParts = Array.isArray(message.parts) ? message.parts : [];

      // If message has reasoning from the database, add it as a reasoning part
      // This enables displaying Claude's extended thinking when revisiting chats
      const reasoningParts = message.reasoning
        ? [{ type: 'reasoning' as const, text: message.reasoning }]
        : [];

      // Build base message with parts (reasoning first, then existing, then attachments)
      const baseMessage = {
        id: message.id,
        parts: [...reasoningParts, ...existingParts, ...attachmentParts],
        role: message.role as UIMessage['role'],
        createdAt: message.createdAt,
      };

      // Apply v4 → v5 conversion for any legacy parts (tool-invocation, etc.)
      return convertV4MessageToV5(baseMessage as any, index) as UIMessage;
    });
  }

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
    return <ClientRedirect path="/login" />;
  }

  if (chat.visibility === 'private') {
    if (!session.user) {
      return notFound();
    }

    // Allow quinn@upaway.dev to access any chat
    const isAdminUser = session.user.email === 'quinn@upaway.dev';

    if (session.user.id !== chat.userId && !isAdminUser) {
      return notFound();
    }
  }

  // Add error handling and retry for message fetching
  let messagesFromDb: DBMessage[] = [];
  retryCount = 0;

  while (messagesFromDb.length === 0 && retryCount < maxRetries) {
    try {
      messagesFromDb = await getMessagesByChatId({ id });
      if (messagesFromDb.length === 0 && retryCount < maxRetries - 1) {
        silentLog.debug(
          `No messages found for chat ${id}, retry ${retryCount + 1}/${maxRetries}`,
        );
        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, 500));
        retryCount++;
      }
    } catch (error: unknown) {
      silentLog.error(`Error fetching messages for chat ${id}`, error);
      retryCount++;
      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  // Check for active streams in the database for auto-resume
  let shouldAutoResume = false;
  try {
    const { getActiveStreamByChatId } = await import('@/lib/db/queries');
    const activeStream = await getActiveStreamByChatId({ chatId: id });

    if (activeStream) {
      // Check if stream is still recent (not stale)
      const staleThreshold = 60 * 1000; // 60 seconds
      const isStale =
        Date.now() - new Date(activeStream.lastActiveAt).getTime() >
        staleThreshold;

      if (!isStale && activeStream.status === 'active') {
        shouldAutoResume = true;
        console.log(
          '[ExistingChat] Found active stream, enabling auto-resume:',
          {
            streamId: activeStream.id,
            status: activeStream.status,
            lastActiveAt: activeStream.lastActiveAt,
          },
        );
      } else if (!isStale && activeStream.status === 'interrupted') {
        // Also enable auto-resume for interrupted streams to recover content
        // Apply stale check to avoid recovering very old interrupted streams
        shouldAutoResume = true;
        console.log(
          '[ExistingChat] Found interrupted stream, enabling auto-resume:',
          {
            streamId: activeStream.id,
            status: activeStream.status,
            lastActiveAt: activeStream.lastActiveAt,
          },
        );
      }
    }
  } catch (streamError) {
    console.error(
      '[ExistingChat] Error checking for active stream:',
      streamError,
    );
    // Continue without auto-resume on error
  }

  const cookieStore = await cookies();
  const chatModelFromCookie = cookieStore.get('chat-model');
  const providerFromCookie = cookieStore.get('ai-provider');

  // Get user settings to retrieve research mode preferences only
  // For existing chats, persona/profile come ONLY from the chat record
  let userResearchMode: ResearchMode = 'off';
  try {
    const userSettings = await getUserSettings({ userId: session.user.id });
    console.log('[ExistingChat] User settings fetched:', {
      userId: session.user.id,
      selectedResearchMode: userSettings?.selectedResearchMode,
    });

    if (userSettings?.selectedResearchMode) {
      const rawMode = userSettings.selectedResearchMode;
      // Ensure we only accept valid research modes
      userResearchMode = rawMode === 'nexus' ? 'nexus' : 'off';
      console.log('[ExistingChat] Research mode set:', {
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

  // For existing chats, ONLY use the chat's persona/profile (not userSettings)
  // This ensures that when a user clears the persona, it stays cleared
  const initialPersonaId = chat.personaId || undefined;
  const initialProfileId = chat.profileId || undefined;

  console.log('[ExistingChat] Persona/profile from chat record:', {
    chatId: id,
    chatPersonaId: chat.personaId,
    chatProfileId: chat.profileId,
    initialPersonaId,
    initialProfileId,
  });

  console.log('[ExistingChat] Final persona/profile/research config:', {
    chatId: id,
    initialPersonaId,
    initialProfileId,
    userResearchMode,
  });

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
