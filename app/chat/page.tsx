import { cookies } from 'next/headers';

import { ChatClientWrapper } from '@/components/chat-client-wrapper';
import { ComposerDashboard } from '@/components/composer-dashboard';
import { DEFAULT_CHAT_MODEL } from '@/lib/ai/models';
import { DEFAULT_PROVIDER } from '@/lib/ai/providers';
import { generateUUID } from '@/lib/utils';
import { DataStreamHandler } from '@/components/data-stream-handler';
import { auth } from '../(auth)/auth';
import ClientRedirect from '@/components/client-redirect';
import { getUserSettings } from '@/lib/db/queries';
import type { ResearchMode } from '@/components/nexus-research-selector';

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{
    documentId?: string;
    documentTitle?: string;
    userDocumentId?: string;
    dashboard?: string;
    newComposerKind?: string;
    newComposerTitle?: string;
  }>;
}) {
  const session = await auth();

  if (!session) {
    return <ClientRedirect path="/login" />;
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

  // Dashboard mode: render full dashboard view (no chat UI)
  if ((await searchParams).dashboard) {
    return (
      <div className="flex flex-col min-w-0 h-dvh bg-transparent relative">
        <div className="w-full h-full overflow-y-auto p-4">
          <ComposerDashboard />
        </div>
      </div>
    );
  }

  // If dashboard param present, just render Chat normally; the client will show dashboard UI.
  // If newComposerKind is present, we initialize a blank composer on the client via SWR store.

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
          documentContext={null}
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
        documentContext={null}
      />
      <DataStreamHandler id={id} />
    </>
  );
}
