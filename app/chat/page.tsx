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
    withPersona?: string;
    courseActivated?: string;
    courseName?: string;
    error?: string;
    errorMessage?: string;
    courseId?: string;
  }>;
}) {
  // Fetch session, cookies, and searchParams all in parallel — none depend on each other
  const [session, cookieStore, params] = await Promise.all([
    auth(),
    cookies(),
    searchParams,
  ]);

  if (!session) {
    return <ClientRedirect path="/login" />;
  }

  const id = generateUUID();

  // Dashboard mode: render full dashboard view (no chat UI)
  if (params.dashboard) {
    return (
      <div className="flex flex-col min-w-0 h-dvh bg-transparent relative">
        <div className="w-full h-full overflow-y-auto p-4">
          <ComposerDashboard />
        </div>
      </div>
    );
  }

  // Get user settings (needs session.user.id — must be sequential after auth)
  let userResearchMode: ResearchMode = 'off';
  let initialPersonaId: string | undefined;
  let initialProfileId: string | undefined;

  try {
    const userSettings = await getUserSettings({ userId: session.user.id });

    // PRIORITY 1: Course activation
    if (params.personaId && params.courseActivated === 'true') {
      initialPersonaId = params.personaId;
    }
    // PRIORITY 2: Explicit "start new chat with this persona"
    else if (params.personaId && params.withPersona === 'true') {
      initialPersonaId = params.personaId;
    }
    // PRIORITY 3: New chats always start fresh with EOS AI (no saved persona)
    else {
      initialPersonaId = undefined;
    }

    if (userSettings?.selectedProfileId) {
      initialProfileId = userSettings.selectedProfileId;
    }

    // Always start new chats in standard mode (research mode is session-only)
    userResearchMode = 'off';
  } catch {
    // Fall through with defaults on error
  }

  const modelIdFromCookie = cookieStore.get('chat-model');
  const providerFromCookie = cookieStore.get('ai-provider');

  const courseActivationParams =
    params.courseActivated || params.error || params.courseName
      ? {
          courseActivated: params.courseActivated === 'true',
          courseName: params.courseName,
          error: params.error,
          errorMessage: params.errorMessage,
          courseId: params.courseId,
        }
      : undefined;

  return (
    <>
      <ChatClientWrapper
        key={id}
        id={id}
        initialMessages={[]}
        initialChatModel={modelIdFromCookie?.value ?? DEFAULT_CHAT_MODEL}
        initialProvider={providerFromCookie?.value ?? DEFAULT_PROVIDER}
        initialVisibilityType="private"
        isReadonly={false}
        session={session}
        autoResume={false}
        initialPersonaId={initialPersonaId}
        courseActivationParams={courseActivationParams}
        initialProfileId={initialProfileId}
        initialResearchMode={userResearchMode}
        documentContext={null}
      />
      <DataStreamHandler id={id} />
    </>
  );
}
