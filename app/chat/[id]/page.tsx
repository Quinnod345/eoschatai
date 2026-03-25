import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';

import { auth } from '@/app/(auth)/auth';
import { ChatClientWrapper } from '@/components/chat-client-wrapper';
import ClientRedirect from '@/components/client-redirect';
import {
  getChatById,
  getMessagesByChatId,
  getUserSettings,
  getActiveStreamByChatId,
} from '@/lib/db/queries';
import { DEFAULT_CHAT_MODEL } from '@/lib/ai/models';
import { DEFAULT_PROVIDER } from '@/lib/ai/providers';
import type { ResearchMode } from '@/components/nexus-research-selector';
import type { DBMessage } from '@/lib/db/schema';
import type { UIMessage } from 'ai';
import { Suspense } from 'react';
import { ChatLoading } from '@/components/chat-loading';
import { convertV4MessageToV5 } from '@/lib/ai/convert-messages';
import { isAdminEmail } from '@/lib/auth/admin';

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

  function convertToUIMessages(messages: Array<DBMessage>): Array<UIMessage> {
    return messages.map((message, index) => {
      const attachmentParts = Array.isArray(message.attachments)
        ? message.attachments.map((att: any) => ({
            type: 'file' as const,
            url: att.url,
            mediaType: att.contentType || att.mediaType,
            name: att.name,
          }))
        : [];

      const existingParts = Array.isArray(message.parts) ? message.parts : [];

      const reasoningParts = message.reasoning
        ? [{ type: 'reasoning' as const, text: message.reasoning }]
        : [];

      const baseMessage = {
        id: message.id,
        parts: [...reasoningParts, ...existingParts, ...attachmentParts],
        role: message.role as UIMessage['role'],
        createdAt: message.createdAt,
      };

      return convertV4MessageToV5(baseMessage as any, index) as UIMessage;
    });
  }

  // Phase 1: fetch chat row and session in parallel — neither depends on the other
  let [chat, session] = await Promise.all([
    getChatById({ id }),
    auth(),
  ]);

  // Single fast retry for chat (handles new-chat navigation race; saves up to 1.3s vs old 3×500ms)
  if (!chat) {
    await new Promise((r) => setTimeout(r, 200));
    chat = await getChatById({ id });
  }

  if (!chat) return notFound();

  if (!session) {
    return <ClientRedirect path="/login" />;
  }

  if (chat.visibility === 'private') {
    if (!session.user) return notFound();
    const isAdminUser = isAdminEmail(session.user.email);
    if (session.user.id !== chat.userId && !isAdminUser) return notFound();
  }

  // Phase 2: fetch messages, active stream, user settings, and cookies all in parallel
  const [messagesFromDb, activeStreamResult, userSettings, cookieStore] =
    await Promise.all([
      getMessagesByChatId({ id }).catch(() => [] as DBMessage[]),
      getActiveStreamByChatId({ chatId: id }).catch(() => null),
      getUserSettings({ userId: session.user.id }).catch(() => null),
      cookies(),
    ]);

  // Determine auto-resume — only resume very fresh (< 10s) 'active' streams
  let shouldAutoResume = false;
  if (activeStreamResult) {
    const staleThreshold = 10 * 1000;
    const isStale =
      Date.now() - new Date(activeStreamResult.lastActiveAt).getTime() >
      staleThreshold;
    if (!isStale && activeStreamResult.status === 'active') {
      shouldAutoResume = true;
    }
  }

  const chatModelFromCookie = cookieStore.get('chat-model');
  const providerFromCookie = cookieStore.get('ai-provider');

  // Research mode from user settings; persona/profile come from the chat record for existing chats
  let userResearchMode: ResearchMode = 'off';
  if (userSettings?.selectedResearchMode) {
    const rawMode = userSettings.selectedResearchMode;
    userResearchMode = rawMode === 'nexus' ? 'nexus' : 'off';
  }

  const initialPersonaId = chat.personaId || undefined;
  const initialProfileId = chat.profileId || undefined;

  return (
    <ChatClientWrapper
      id={chat.id}
      initialMessages={convertToUIMessages(messagesFromDb)}
      initialChatModel={chatModelFromCookie?.value ?? DEFAULT_CHAT_MODEL}
      initialProvider={providerFromCookie?.value ?? DEFAULT_PROVIDER}
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
