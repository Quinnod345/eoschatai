import { cookies } from 'next/headers';

import { ChatClientWrapper } from '@/components/chat-client-wrapper';
import { DEFAULT_CHAT_MODEL } from '@/lib/ai/models';
import { DEFAULT_PROVIDER } from '@/lib/ai/providers';
import { generateUUID } from '@/lib/utils';
import { DataStreamHandler } from '@/components/data-stream-handler';
import { auth } from '../(auth)/auth';
import { redirect } from 'next/navigation';
import { getUserSettings } from '@/lib/db/queries';
import type { ResearchMode } from '@/components/nexus-research-selector';

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{
    documentId?: string;
    documentTitle?: string;
    userDocumentId?: string;
  }>;
}) {
  const session = await auth();

  if (!session) {
    redirect('/login');
  }

  const id = generateUUID();

  // Await searchParams as required by Next.js 15
  const params = await searchParams;

  // Get user settings to retrieve research mode preference
  let userResearchMode: ResearchMode = 'off';
  try {
    const userSettings = await getUserSettings({ userId: session.user.id });
    console.log('[NewChat] User settings fetched:', {
      userId: session.user.id,
      selectedResearchMode: userSettings?.selectedResearchMode,
      allSettings: userSettings,
    });

    if (userSettings?.selectedResearchMode) {
      const rawMode = userSettings.selectedResearchMode;
      // Ensure we only accept valid research modes
      userResearchMode = rawMode === 'nexus' ? 'nexus' : 'off';
      console.log('[NewChat] Research mode set:', {
        rawMode,
        validatedMode: userResearchMode,
      });
    }
  } catch (error) {
    console.error(
      '[NewChat] Error fetching user settings for research mode:',
      error,
    );
  }

  // Handle document context if provided - we'll pass this as a prop to trigger auto-submission
  let documentContext: {
    type: 'ai-document' | 'user-document';
    id: string;
    title: string;
    message: string;
  } | null = null;

  if (params.documentId && params.documentTitle) {
    // AI-generated document
    documentContext = {
      type: 'ai-document' as const,
      id: params.documentId,
      title: params.documentTitle,
      message: `I'd like to discuss the document "${params.documentTitle}". Please help me understand and work with this document.`,
    };
  } else if (params.userDocumentId && params.documentTitle) {
    // User-uploaded document
    documentContext = {
      type: 'user-document' as const,
      id: params.userDocumentId,
      title: params.documentTitle,
      message: `I'd like to discuss the document "${params.documentTitle}". This is a document I uploaded. Please help me understand and work with this document.`,
    };
  }

  const cookieStore = await cookies();
  const modelIdFromCookie = cookieStore.get('chat-model');
  const providerFromCookie = cookieStore.get('ai-provider');

  if (!modelIdFromCookie || !providerFromCookie) {
    return (
      <>
        <ChatClientWrapper
          key={id}
          id={id}
          initialMessages={[]}
          initialChatModel={DEFAULT_CHAT_MODEL}
          initialProvider={DEFAULT_PROVIDER}
          initialVisibilityType="private"
          isReadonly={false}
          session={session}
          autoResume={false}
          initialPersonaId={undefined}
          initialProfileId={undefined}
          initialResearchMode={userResearchMode}
          documentContext={documentContext}
        />
        <DataStreamHandler id={id} />
      </>
    );
  }

  return (
    <>
      <ChatClientWrapper
        key={id}
        id={id}
        initialMessages={[]}
        initialChatModel={modelIdFromCookie.value}
        initialProvider={providerFromCookie.value}
        initialVisibilityType="private"
        isReadonly={false}
        session={session}
        autoResume={false}
        initialPersonaId={undefined}
        initialProfileId={undefined}
        initialResearchMode={userResearchMode}
        documentContext={documentContext}
      />
      <DataStreamHandler id={id} />
    </>
  );
}
