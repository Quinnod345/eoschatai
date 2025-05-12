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
  const [activeProvider, setActiveProvider] = useState(initialProvider);
  const [activeModel, setActiveModel] = useState(initialChatModel);
  const previousProviderRef = useRef(initialProvider);
  const previousModelRef = useRef(initialChatModel);
  const [hasInitialMessages] = useState(initialMessages.length > 0);
  const [providerTransitioning, setProviderTransitioning] = useState(false);
  const transitionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Track performance metrics
  const responseStartTimeRef = useRef<number | null>(null);
  const responseSizeRef = useRef<number>(0);
  const messageTokenCountRef = useRef<{ [id: string]: number }>({});

  // Set up chat
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
    experimental_throttle: 0, // No throttling for better performance
    sendExtraMessageFields: true,
    generateId: generateUUID,
    experimental_prepareRequestBody: (body) => {
      // Reset performance tracking for new requests
      responseStartTimeRef.current = performance.now();
      responseSizeRef.current = 0;

      // Log the request for debugging
      console.log(
        `Preparing request with provider: ${activeProvider}, model: ${activeModel}`,
      );

      // Throw an error if we're in the middle of a provider transition
      if (providerTransitioning) {
        console.warn('Provider transition in progress, blocking API request');
        throw new Error(
          'Provider is currently changing. Please try again in a moment.',
        );
      }

      return {
        id,
        message: body.messages.at(-1),
        selectedChatModel: activeModel,
        selectedProvider: activeProvider, // Use the current active provider
        selectedVisibilityType: visibilityType,
      };
    },
    onFinish: (message) => {
      mutate(unstable_serialize(getChatHistoryPaginationKey));
      // Clear any timeout we might have set
      if (responseTimeoutRef.current) {
        clearTimeout(responseTimeoutRef.current);
        responseTimeoutRef.current = null;
      }

      // Log performance metrics
      if (responseStartTimeRef.current) {
        const responseTime = performance.now() - responseStartTimeRef.current;
        console.log(
          `Response completed in ${responseTime.toFixed(0)}ms, approximate size: ${responseSizeRef.current} chars`,
        );

        // Store estimated token count for the message
        if (message.id && message.content) {
          messageTokenCountRef.current[message.id] = Math.floor(
            message.content.length / 4,
          );
        }

        // Reset metrics
        responseStartTimeRef.current = null;
      }
    },
    onError: (error) => {
      // Clear any timeout we might have set
      if (responseTimeoutRef.current) {
        clearTimeout(responseTimeoutRef.current);
        responseTimeoutRef.current = null;
      }

      console.error('Chat error:', error);

      // Don't attempt fallbacks if we're in a provider transition
      if (providerTransitioning) {
        console.log(
          'Error during provider transition - skipping fallback logic',
        );
        toast({
          type: 'error',
          description:
            'Provider is changing. Please wait a moment before trying again.',
        });
        return;
      }

      // Check if this is a provider-related error
      const errorMsg = error?.message?.toLowerCase() || '';
      if (
        errorMsg.includes('invalid request body') ||
        errorMsg.includes('api key') ||
        errorMsg.includes('provider')
      ) {
        // Try falling back to default provider
        const fallbackProvider = DEFAULT_PROVIDER;

        // Prevent infinite loop: only fall back if not already trying to use the fallback
        // and we haven't already attempted a fallback recently
        const lastFallbackTime = sessionStorage.getItem('last_fallback_time');
        const now = Date.now();
        const recentlyFalledBack =
          lastFallbackTime &&
          now - Number.parseInt(lastFallbackTime, 10) < 10000; // Increase to 10 seconds

        if (activeProvider !== fallbackProvider && !recentlyFalledBack) {
          console.log(
            `Error with ${activeProvider}, falling back to ${fallbackProvider}`,
          );

          // Record fallback time to prevent loops
          sessionStorage.setItem('last_fallback_time', now.toString());

          // Set the transition state to prevent immediate API calls
          setProviderTransitioning(true);

          toast({
            type: 'error',
            description: `Error with ${activeProvider === 'xai' ? 'Grok' : 'OpenAI'}. Falling back to ${fallbackProvider === 'xai' ? 'Grok' : 'OpenAI'}.`,
          });

          // Switch to fallback provider
          setActiveProvider(fallbackProvider);

          // Store the fallback in session and cookies
          sessionStorage.setItem('current_provider', fallbackProvider);
          document.cookie = `ai-provider=${fallbackProvider}; path=/; max-age=${30 * 24 * 60 * 60}`;

          // Clear transition state after a delay
          setTimeout(() => {
            setProviderTransitioning(false);
            console.log(
              'Fallback transition complete - transition state cleared',
            );

            // Add a system message indicating the fallback after transitioning is complete
            setMessages((prevMessages) => [
              ...prevMessages,
              {
                id: generateUUID(),
                role: 'system',
                content: `Provider error detected. Switched to ${fallbackProvider === 'xai' ? 'Grok' : 'OpenAI'} as a fallback. Please try again.`,
                createdAt: new Date(),
              },
            ]);
          }, 1000);

          return;
        } else if (recentlyFalledBack) {
          console.warn(
            'Already attempted a fallback recently, not trying again to prevent loops',
          );
          toast({
            type: 'error',
            description: `Multiple provider errors detected. Please try refreshing the page.`,
          });

          // Reset provider transitioning if it's stuck
          if (providerTransitioning) {
            setTimeout(() => {
              setProviderTransitioning(false);
              console.log('Force clearing provider transitioning state');
            }, 500);
          }
        }
      }

      // Show general error message for other errors
      toast({
        type: 'error',
        description: error.message,
      });
    },
  });

  // Listen for provider change events
  useEffect(() => {
    const handleProviderChange = async (event: Event) => {
      const customEvent = event as CustomEvent;
      const newProvider = customEvent.detail?.provider;
      const preventReload = customEvent.detail?.preventReload;
      const forcedSwitch = customEvent.detail?.forcedSwitch;

      if (newProvider && newProvider !== activeProvider) {
        console.log(
          `Provider change event received: ${newProvider} (preventReload: ${preventReload})`,
        );

        // Set transitioning state to prevent API calls during switch
        setProviderTransitioning(true);

        // Clear any existing transition timeout
        if (transitionTimeoutRef.current) {
          clearTimeout(transitionTimeoutRef.current);
        }

        // Set a safety timeout to ensure transitioning state is cleared even in case of errors
        transitionTimeoutRef.current = setTimeout(() => {
          setProviderTransitioning(false);
          console.log('Transition state cleared by safety timeout');
        }, 3000);

        // Add a toast indicating the provider is being switched
        toast({
          type: 'success',
          description: `Switching to ${newProvider === 'xai' ? 'Grok' : 'OpenAI'}...`,
        });

        try {
          // First, unload the current provider (allow time for cleanup)
          console.log(`Unloading provider: ${activeProvider}`);

          // Force garbage collection delay to ensure the old provider is unloaded
          // This artificial delay helps prevent the "multiple providers selected" error
          await new Promise((resolve) => setTimeout(resolve, 500));

          // Now set the new provider
          setActiveProvider(newProvider);

          toast({
            type: 'success',
            description: `Using ${newProvider === 'xai' ? 'Grok' : 'OpenAI'} for chat`,
          });

          // Wait a bit longer to ensure the new provider is fully initialized
          await new Promise((resolve) => setTimeout(resolve, 300));
        } catch (error) {
          console.error('Error during provider transition:', error);
          toast({
            type: 'error',
            description: 'Error switching providers. Please try again.',
          });
        } finally {
          // Clear the safety timeout
          if (transitionTimeoutRef.current) {
            clearTimeout(transitionTimeoutRef.current);
            transitionTimeoutRef.current = null;
          }

          // Always remove the transitioning state when done
          setProviderTransitioning(false);
          console.log(
            'Provider transition complete - transitioning state cleared',
          );
        }
      }
    };

    // Add the event listener
    window.addEventListener('providerChanged', handleProviderChange);

    // Check if there's a provider in sessionStorage that differs from our current state
    const storedProvider = sessionStorage.getItem('current_provider');
    if (storedProvider && storedProvider !== activeProvider) {
      console.log(`Found provider in sessionStorage: ${storedProvider}`);
      setActiveProvider(storedProvider);

      toast({
        type: 'success',
        description: `Using ${storedProvider === 'xai' ? 'Grok' : 'OpenAI'} for chat`,
      });
    }

    // Cleanup
    return () => {
      window.removeEventListener('providerChanged', handleProviderChange);
    };
  }, [activeProvider]);

  // Listen for model change events
  useEffect(() => {
    const handleModelChange = (event: CustomEvent) => {
      const newModel = event.detail?.modelId;

      if (newModel && newModel !== activeModel) {
        console.log(`Model change event received: ${newModel}`);
        setActiveModel(newModel);

        toast({
          type: 'success',
          description: `Switched to model: ${newModel}`,
        });
      }
    };

    // Add the event listener
    window.addEventListener('modelChanged', handleModelChange as EventListener);

    // Check if there's a model in sessionStorage that differs from our current state
    const storedModel = sessionStorage.getItem('current_model');
    if (storedModel && storedModel !== activeModel) {
      console.log(`Found model in sessionStorage: ${storedModel}`);
      setActiveModel(storedModel);

      toast({
        type: 'success',
        description: `Using model: ${storedModel}`,
      });
    }

    // Cleanup
    return () => {
      window.removeEventListener(
        'modelChanged',
        handleModelChange as EventListener,
      );
    };
  }, [activeModel]);

  // When provider changes, update the chat
  useEffect(() => {
    // Skip the initial render
    if (previousProviderRef.current === activeProvider) {
      return;
    }

    console.log(
      `Provider changed from ${previousProviderRef.current} to ${activeProvider}`,
    );
    previousProviderRef.current = activeProvider;

    // If we're in the middle of a chat, notify user and prepare for a new message
    if (messages.length > 0) {
      // Don't append messages during transition (which would trigger API calls)
      // Instead add the message directly to avoid triggering an API call
      if (!providerTransitioning) {
        // For non-transitioning cases, use a controlled message addition
        setMessages((prevMessages) => [
          ...prevMessages,
          {
            id: generateUUID(),
            role: 'system',
            content: `Provider switched to ${activeProvider === 'xai' ? 'Grok' : 'OpenAI'}. Your next message will use the new provider.`,
            createdAt: new Date(),
          },
        ]);
      }

      // For medium-length conversations, suggest starting a new chat
      if (messages.length > 2 && messages.length <= 6) {
        toast({
          type: 'success',
          description: `For best results with ${activeProvider === 'xai' ? 'Grok' : 'OpenAI'}, consider starting a new chat.`,
        });
      }

      // For longer conversations, strongly recommend starting a new chat
      if (messages.length > 6) {
        toast({
          type: 'error',
          description: `Switching providers in long conversations may cause errors. Please start a new chat.`,
        });

        // Add an additional system message with clearer instructions
        if (!providerTransitioning) {
          setMessages((prevMessages) => [
            ...prevMessages,
            {
              id: generateUUID(),
              role: 'system',
              content: `WARNING: Switching AI providers in the middle of a long conversation may cause unexpected errors or inconsistent responses. For the best experience, please start a new chat when changing providers.`,
              createdAt: new Date(),
            },
          ]);
        }
      }
    }
  }, [activeProvider, messages.length, providerTransitioning]);

  // When model changes, update the chat
  useEffect(() => {
    // Skip the initial render
    if (previousModelRef.current === activeModel) {
      return;
    }

    console.log(
      `Model changed from ${previousModelRef.current} to ${activeModel}`,
    );
    previousModelRef.current = activeModel;

    // If we're in the middle of a chat, we should start a new chat for better results
    if (messages.length > 0) {
      if (messages.length > 2) {
        // For longer conversations, recommend starting a new chat
        toast({
          type: 'success',
          description: `Model changed to ${activeModel}. For best results, please start a new chat.`,
        });
      }

      // Add a system message directly instead of using append to avoid API calls
      if (!providerTransitioning) {
        setMessages((prevMessages) => [
          ...prevMessages,
          {
            id: generateUUID(),
            role: 'system',
            content: `Model switched to ${activeModel}. Your next message will use the new model.`,
            createdAt: new Date(),
          },
        ]);
      }
    }
  }, [activeModel, messages.length, providerTransitioning]);

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

  const { visibilityType } = useChatVisibility({
    chatId: id,
    initialVisibilityType,
  });

  const [attachments, setAttachments] = useState<Array<Attachment>>([]);
  const isArtifactVisible = useArtifactSelector((state) => state.isVisible);

  // Reference to store the timeout ID
  const responseTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Custom submit handler with intelligent timeout
  const handleSubmitWithTimeout = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      try {
        // Set a dynamic timeout based on message complexity with safety checks
        const messageLength = (input || '').length;
        // Longer timeout for complex requests
        const timeoutDuration = Math.min(
          35000, // Maximum 35 seconds
          Math.max(
            15000, // Minimum 15 seconds
            messageLength * 40, // 40ms per character as a rough estimate
          ),
        );

        // Only log if safe
        try {
          console.log(
            `Setting response timeout to ${timeoutDuration}ms based on message length of ${messageLength} chars`,
          );
        } catch (e) {
          // Ignore logging errors
        }

        // Set timeout with error handling
        try {
          responseTimeoutRef.current = setTimeout(() => {
            try {
              // Use log instead of error
              console.log('Response timeout detected on client side');
              // If we're still in loading state after timeout, show error and force stop
              if (status === 'streaming') {
                toast({
                  type: 'error',
                  description:
                    'The response is taking too long. Please stop and try again.',
                });
              }
            } catch (timeoutError) {
              // Prevent errors in timeout callback
            }
          }, timeoutDuration);
        } catch (timeoutSetError) {
          // Handle timeout setting errors
        }

        // Call the original submit handler with error handling
        try {
          handleSubmit(e);
        } catch (submitError) {
          console.log('Error during submission:', submitError);
        }
      } catch (error) {
        // Global error handler
        console.log('Error in handleSubmitWithTimeout:', error);
      }
    },
    [handleSubmit, input, status],
  );

  // Create an adapter function for the multimodal input component with improved error handling
  const handleSubmitAdapter = useCallback(
    (
      event?: { preventDefault?: () => void } | undefined,
      chatRequestOptions?: any,
    ) => {
      try {
        if (event?.preventDefault) {
          event.preventDefault();
        }

        // Check if provider is transitioning and block submission
        if (providerTransitioning) {
          console.log('Blocking submission during provider transition');
          toast({
            type: 'error',
            description:
              'Provider is currently changing. Please wait a moment before sending a message.',
          });
          return;
        }

        // Clear any existing timeout safely
        if (responseTimeoutRef.current) {
          try {
            clearTimeout(responseTimeoutRef.current);
          } catch (e) {
            // Ignore any errors in timeout clearing
          }
          responseTimeoutRef.current = null;
        }

        // Call our custom handler if the event exists
        if (event) {
          // Safely determine message length with fallbacks
          const messageLength = (input || '').length;

          // Longer timeout for complex requests (with safety checks)
          const timeoutDuration = Math.min(
            35000, // Maximum 35 seconds
            Math.max(
              15000, // Minimum 15 seconds
              messageLength * 40, // 40ms per character as a rough estimate
            ),
          );

          try {
            handleSubmit(event, chatRequestOptions);
          } catch (submitError) {
            console.log('Error during submit:', submitError);
            return; // Don't continue if submit failed
          }

          // Set the timeout with intelligent duration and error handling
          try {
            responseTimeoutRef.current = setTimeout(() => {
              try {
                // Log warning instead of error to avoid error reporting
                console.log('Response timeout detected on client side');

                // Only show toast if we're still in streaming state
                if (status === 'streaming') {
                  toast({
                    type: 'error',
                    description:
                      'The response is taking too long. Please stop and try again.',
                  });
                }
              } catch (timeoutError) {
                // Prevent any errors in the timeout callback from bubbling up
                console.log('Error in timeout handler:', timeoutError);
              }
            }, timeoutDuration);
          } catch (timeoutError) {
            console.log('Error setting timeout:', timeoutError);
          }
        }
      } catch (error) {
        // Global error handler to prevent uncaught exceptions
        console.log('Error in submit adapter:', error);
      }
    },
    [handleSubmit, status, providerTransitioning, input],
  );

  return (
    <>
      <div className="flex flex-col min-w-0 h-dvh bg-transparent relative">
        <ChatHeader
          chatId={id}
          selectedModelId={activeModel}
          selectedProviderId={activeProvider}
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
              selectedModelId={activeModel}
              selectedProviderId={activeProvider}
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
