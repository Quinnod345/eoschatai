'use client';

import type { Attachment, UIMessage } from 'ai';
import { useChat } from '@ai-sdk/react';
import { useEffect, useState, useRef, useCallback } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { ChatHeader } from '@/components/chat-header';
import type { Vote } from '@/lib/db/schema';
import { fetcher, generateUUID } from '@/lib/utils';
import { Artifact } from './artifact';
import { MultimodalInput } from './multimodal-input';
import { Messages } from './messages';
import type { VisibilityType } from './visibility-selector';
import { useArtifactSelector } from '@/hooks/use-artifact';
import { unstable_serialize } from 'swr/infinite';
import { getChatHistoryPaginationKey } from './sidebar-history';
import { toast } from './toast';
import type { Session } from 'next-auth';
import { useSearchParams, useRouter } from 'next/navigation';
import { useChatVisibility } from '@/hooks/use-chat-visibility';
import { DEFAULT_PROVIDER } from '@/lib/ai/providers';

export function Chat({
  id,
  initialMessages,
  initialChatModel,
  initialProvider = DEFAULT_PROVIDER,
  initialVisibilityType,
  isReadonly,
  session,
  autoResume,
}: {
  id: string;
  initialMessages: Array<UIMessage>;
  initialChatModel: string;
  initialProvider?: string;
  initialVisibilityType: VisibilityType;
  isReadonly: boolean;
  session: Session;
  autoResume: boolean;
}) {
  const { mutate } = useSWRConfig();
  const router = useRouter();
  const previousProviderRef = useRef(initialProvider);

  // Log provider for debugging
  useEffect(() => {
    console.log('Chat component - Current provider:', initialProvider);

    // If provider changed, reload the page to apply the new provider
    if (previousProviderRef.current !== initialProvider) {
      console.log('Provider changed, reloading chat...');
      previousProviderRef.current = initialProvider;

      // Show a toast to indicate provider change
      toast({
        type: 'success',
        description: `Using ${initialProvider === 'xai' ? 'Grok' : 'OpenAI'} for chat`,
      });

      // Check if this is an initial load or a refresh triggered by provider-selector
      // If there's a cookie change timestamp that's recent, don't reload again
      const recentProviderChange = sessionStorage.getItem(
        'provider_change_timestamp',
      );
      const now = Date.now();

      if (
        recentProviderChange &&
        now - Number.parseInt(recentProviderChange) < 2000
      ) {
        console.log(
          'Recent provider change detected, avoiding duplicate reload',
        );
        // Clear the timestamp since we've handled it
        sessionStorage.removeItem('provider_change_timestamp');
      } else {
        // Force a refresh of the page to ensure we're using the new provider
        router.refresh();
      }
    }
  }, [initialProvider, router]);

  const { visibilityType } = useChatVisibility({
    chatId: id,
    initialVisibilityType,
  });

  const {
    messages,
    setMessages,
    handleSubmit,
    input,
    setInput,
    append,
    status,
    stop,
    reload,
    experimental_resume,
  } = useChat({
    id,
    initialMessages,
    experimental_throttle: 100,
    sendExtraMessageFields: true,
    generateId: generateUUID,
    experimental_prepareRequestBody: (body) => ({
      id,
      message: body.messages.at(-1),
      selectedChatModel: initialChatModel,
      selectedProvider: initialProvider,
      selectedVisibilityType: visibilityType,
    }),
    onFinish: () => {
      mutate(unstable_serialize(getChatHistoryPaginationKey));
      // Clear any timeout we might have set
      if (responseTimeoutRef.current) {
        clearTimeout(responseTimeoutRef.current);
        responseTimeoutRef.current = null;
      }
    },
    onError: (error) => {
      // Clear any timeout we might have set
      if (responseTimeoutRef.current) {
        clearTimeout(responseTimeoutRef.current);
        responseTimeoutRef.current = null;
      }

      console.error('Chat error:', error);
      toast({
        type: 'error',
        description: error.message,
      });
    },
  });

  useEffect(() => {
    if (autoResume) {
      experimental_resume();
    }

    // note: this hook has no dependencies since it only needs to run once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const searchParams = useSearchParams();
  const query = searchParams.get('query');

  const [hasAppendedQuery, setHasAppendedQuery] = useState(false);

  useEffect(() => {
    if (query && !hasAppendedQuery) {
      append({
        role: 'user',
        content: query,
      });

      setHasAppendedQuery(true);
      window.history.replaceState({}, '', `/chat/${id}`);
    }
  }, [query, append, hasAppendedQuery, id]);

  const { data: votes } = useSWR<Array<Vote>>(
    messages.length >= 2 ? `/api/vote?chatId=${id}` : null,
    fetcher,
  );

  const [attachments, setAttachments] = useState<Array<Attachment>>([]);
  const isArtifactVisible = useArtifactSelector((state) => state.isVisible);

  // Reference to store the timeout ID
  const responseTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Custom submit handler with timeout
  const handleSubmitWithTimeout = (e: React.FormEvent<HTMLFormElement>) => {
    // Set a timeout to detect hanging responses
    responseTimeoutRef.current = setTimeout(() => {
      console.error('Response timeout detected on client side');
      // If we're still in loading state after timeout, show error and force stop
      if (status === 'streaming') {
        toast({
          type: 'error',
          description:
            'The response is taking too long. You may need to stop and try again.',
        });
      }
    }, 25000); // 25 second timeout

    // Call the original submit handler
    handleSubmit(e);
  };

  // Create an adapter function for the multimodal input component
  const handleSubmitAdapter = useCallback(
    (
      event?: { preventDefault?: () => void } | undefined,
      chatRequestOptions?: any,
    ) => {
      if (event?.preventDefault) {
        event.preventDefault();
      }
      // Call our custom handler if the event exists
      if (event) {
        handleSubmit(event, chatRequestOptions);

        // Set the timeout
        responseTimeoutRef.current = setTimeout(() => {
          console.error('Response timeout detected on client side');
          if (status === 'streaming') {
            toast({
              type: 'error',
              description:
                'The response is taking too long. You may need to stop and try again.',
            });
          }
        }, 25000);
      }
    },
    [handleSubmit, status],
  );

  return (
    <>
      <div className="flex flex-col min-w-0 h-dvh bg-transparent relative">
        <ChatHeader
          chatId={id}
          selectedModelId={initialChatModel}
          selectedProviderId={initialProvider}
          selectedVisibilityType={initialVisibilityType}
          isReadonly={isReadonly}
          session={session}
        />

        <Messages
          chatId={id}
          status={status}
          votes={votes}
          messages={messages}
          setMessages={setMessages}
          reload={reload}
          isReadonly={isReadonly}
          isArtifactVisible={isArtifactVisible}
        />

        <form className="absolute bottom-0 left-0 right-0 flex mx-auto px-4 bg-transparent pb-4 md:pb-6 pt-2 gap-2 w-full md:max-w-3xl z-10">
          {!isReadonly && (
            <MultimodalInput
              chatId={id}
              input={input}
              setInput={setInput}
              handleSubmit={handleSubmitAdapter}
              status={status}
              stop={stop}
              attachments={attachments}
              setAttachments={setAttachments}
              messages={messages}
              setMessages={setMessages}
              append={append}
              selectedVisibilityType={visibilityType}
              selectedModelId={initialChatModel}
              selectedProviderId={initialProvider}
              session={session}
              isReadonly={isReadonly}
            />
          )}
        </form>
      </div>

      <Artifact
        chatId={id}
        input={input}
        setInput={setInput}
        handleSubmit={handleSubmit}
        status={status}
        stop={stop}
        attachments={attachments}
        setAttachments={setAttachments}
        append={append}
        messages={messages}
        setMessages={setMessages}
        reload={reload}
        votes={votes}
        isReadonly={isReadonly}
        selectedVisibilityType={visibilityType}
      />
    </>
  );
}
