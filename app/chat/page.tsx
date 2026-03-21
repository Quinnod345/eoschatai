import { cookies } from 'next/headers';

import { ChatClientWrapper } from '@/components/chat-client-wrapper';
import dynamic from 'next/dynamic';
import { DEFAULT_CHAT_MODEL } from '@/lib/ai/models';

const ComposerDashboard = dynamic(() =>
  import('@/components/composer-dashboard').then((m) => ({
    default: m.ComposerDashboard,
  })),
);
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
    personaId?: string;
    withPersona?: string; // Flag for "start new chat with this persona" feature
    courseActivated?: string;
    courseName?: string;
    error?: string;
    errorMessage?: string;
    courseId?: string;
  }>;
}) {
  const session = await auth();

  if (!session) {
    return <ClientRedirect path="/login" />;
  }

  const id = generateUUID();

  // Await searchParams as required by Next.js 15
  const params = await searchParams;

  // Get user settings to retrieve persona, profile, and research mode preferences
  let userResearchMode: ResearchMode = 'off';
  let initialPersonaId: string | undefined;
  let initialProfileId: string | undefined;
  
  try {
    const userSettings = await getUserSettings({ userId: session.user.id });
    console.log('[NewChat] User settings fetched:', {
      userId: session.user.id,
      selectedPersonaId: userSettings?.selectedPersonaId,
      selectedProfileId: userSettings?.selectedProfileId,
      selectedResearchMode: userSettings?.selectedResearchMode,
    });

    // PRIORITY 1: Course activation (courseActivated=true)
    if (params.personaId && params.courseActivated === 'true') {
      initialPersonaId = params.personaId;
      console.log('[NewChat] Persona ID set from course activation:', initialPersonaId);
    }
    // PRIORITY 2: Explicit "start new chat with this persona" (withPersona=true flag)
    else if (params.personaId && params.withPersona === 'true') {
      initialPersonaId = params.personaId;
      console.log('[NewChat] Persona ID set from explicit "new chat with persona" action:', initialPersonaId);
    }
    // PRIORITY 3: Default to undefined (will use default EOS AI in client)
    // DO NOT use saved persona preference - each new chat starts fresh with EOS AI
    else {
      initialPersonaId = undefined;
      console.log('[NewChat] New chat - defaulting to EOS AI');
    }
    
    if (userSettings?.selectedProfileId) {
      initialProfileId = userSettings.selectedProfileId;
      console.log('[NewChat] Profile ID set from user settings:', initialProfileId);
    }

    if (userSettings?.selectedResearchMode) {
      // Do not restore research mode from DB — it's a session-only choice.
      // Always start new chats in standard mode.
      userResearchMode = 'off';
    }
  } catch (error) {
    console.error(
      '[NewChat] Error fetching user settings for persona/profile/research mode:',
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
          initialPersonaId={initialPersonaId}
          courseActivationParams={
            params.courseActivated || params.error || params.courseName
              ? {
                  courseActivated: params.courseActivated === 'true',
                  courseName: params.courseName,
                  error: params.error,
                  errorMessage: params.errorMessage,
                  courseId: params.courseId,
                }
              : undefined
          }
          initialProfileId={initialProfileId}
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
        initialPersonaId={initialPersonaId}
        courseActivationParams={
          params.courseActivated || params.error || params.courseName
            ? {
                courseActivated: params.courseActivated === 'true',
                courseName: params.courseName,
                error: params.error,
                errorMessage: params.errorMessage,
                courseId: params.courseId,
              }
            : undefined
        }
        initialProfileId={initialProfileId}
        initialResearchMode={userResearchMode}
        documentContext={null}
      />
      <DataStreamHandler id={id} />
    </>
  );
}
