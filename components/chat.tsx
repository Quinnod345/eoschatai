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
import { toast } from '@/lib/toast-system';
import type { Session } from 'next-auth';
import { useSearchParams, useRouter } from 'next/navigation';
import { useChatVisibility } from '@/hooks/use-chat-visibility';
import { DEFAULT_PROVIDER } from '@/lib/ai/providers';
import { MessageLimitIndicator } from './message-limit-indicator';
import { useMessageActions } from '@/hooks/use-message-actions';
import type { ResearchMode } from './nexus-research-selector';
import { useWebSearchProgress } from '@/hooks/use-web-search-progress';

export function Chat({
  id,
  initialMessages,
  initialChatModel,
  initialProvider = DEFAULT_PROVIDER,
  initialVisibilityType,
  isReadonly,
  session,
  autoResume,
  initialPersonaId,
  initialProfileId,
  documentContext,
  initialResearchMode = 'off',
}: {
  id: string;
  initialMessages: Array<UIMessage>;
  initialChatModel: string;
  initialProvider?: string;
  initialVisibilityType: VisibilityType;
  isReadonly: boolean;
  session: Session;
  autoResume: boolean;
  initialPersonaId?: string;
  initialProfileId?: string;
  documentContext?: {
    type: 'ai-document' | 'user-document';
    id: string;
    title: string;
    message: string;
  } | null;
  initialResearchMode?: ResearchMode;
}) {
  const { mutate } = useSWRConfig();
  const router = useRouter();
  const [activeProvider, setActiveProvider] = useState(initialProvider);
  const [activeModel, setActiveModel] = useState(initialChatModel);
  const [selectedPersonaId, setSelectedPersonaId] = useState<
    string | undefined
  >(initialPersonaId);
  const [selectedProfileId, setSelectedProfileId] = useState<
    string | undefined
  >(initialProfileId);

  // Add research mode state with proper validation
  const [selectedResearchMode, setSelectedResearchMode] =
    useState<ResearchMode>(() => {
      // Validate and sanitize initial research mode
      const validMode = initialResearchMode === 'nexus' ? 'nexus' : 'off';
      console.log('[Chat] Initializing research mode:', {
        initialResearchMode,
        validatedMode: validMode,
        chatId: id,
      });
      return validMode;
    });

  // Add loading state for research mode changes
  const [researchModeChanging, setResearchModeChanging] = useState(false);

  // Add logging for research mode changes
  useEffect(() => {
    console.log('[Chat] selectedResearchMode state changed:', {
      newMode: selectedResearchMode,
      chatId: id,
      timestamp: new Date().toISOString(),
    });
  }, [selectedResearchMode, id]);

  // Listen for nexus-clear events to ensure complete state reset
  useEffect(() => {
    const handleNexusClear = (event: Event) => {
      const customEvent = event as CustomEvent;
      const {
        chatId: eventChatId,
        previousMode,
        newMode,
      } = customEvent.detail || {};

      console.log('[Chat] Nexus clear event received:', {
        eventChatId,
        currentChatId: id,
        previousMode,
        newMode,
        timestamp: new Date().toISOString(),
      });

      // Only process if this is for our chat
      if (eventChatId === id) {
        console.log('[Chat] Processing nexus clear for this chat');

        // Force re-render by updating a state that doesn't affect functionality
        // This ensures any stale state is completely refreshed
        setResearchModeChanging(false);

        // Additional cleanup specific to this chat
        try {
          // Clear any component-specific state that might persist
          console.log('[Chat] Performing additional component cleanup');

          // Reset any message-specific state that might have nexus context
          // This is a safety measure to ensure complete clean slate
        } catch (cleanupError) {
          console.warn('[Chat] Error in additional cleanup:', cleanupError);
        }
      }
    };

    // Add the event listener
    window.addEventListener('nexus-clear', handleNexusClear);

    // Cleanup
    return () => {
      window.removeEventListener('nexus-clear', handleNexusClear);
    };
  }, [id]);

  // Add web search progress tracking
  const { searchProgress, citations, processDataStreamMessage } =
    useWebSearchProgress();

  // Log initial state
  useEffect(() => {
    console.log('PERSONA_CLIENT: Chat component initialized', {
      chatId: id,
      initialPersonaId: initialPersonaId,
      initialProfileId: initialProfileId,
      selectedPersonaId: selectedPersonaId,
      selectedProfileId: selectedProfileId,
      hasInitialMessages: hasInitialMessages,
      isEOSImplementer:
        initialPersonaId === '00000000-0000-0000-0000-000000000001',
      timestamp: new Date().toISOString(),
    });
  }, []);

  // Log persona state changes
  useEffect(() => {
    console.log('PERSONA_CLIENT: selectedPersonaId state changed', {
      chatId: id,
      previousPersonaId: 'tracked_separately',
      newPersonaId: selectedPersonaId,
      isEOSImplementer:
        selectedPersonaId === '00000000-0000-0000-0000-000000000001',
      timestamp: new Date().toISOString(),
    });
  }, [selectedPersonaId]);

  // Log profile state changes
  useEffect(() => {
    console.log('PROFILE_CLIENT: selectedProfileId state changed', {
      chatId: id,
      previousProfileId: 'tracked_separately',
      newProfileId: selectedProfileId,
      timestamp: new Date().toISOString(),
    });
  }, [selectedProfileId]);

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
    data,
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

      console.log('PERSONA_CLIENT: Preparing request body', {
        chatId: id,
        provider: activeProvider,
        model: activeModel,
        selectedPersonaId: selectedPersonaId,
        selectedProfileId: selectedProfileId,
        hasPersona: !!selectedPersonaId,
        hasProfile: !!selectedProfileId,
        timestamp: new Date().toISOString(),
      });

      // Throw an error if we're in the middle of a provider transition
      if (providerTransitioning) {
        console.warn('Provider transition in progress, blocking API request');
        throw new Error(
          'Provider is currently changing. Please try again in a moment.',
        );
      }

      const requestBody = {
        id,
        message: body.messages.at(-1),
        selectedChatModel: activeModel,
        selectedProvider: activeProvider, // Use the current active provider
        selectedVisibilityType: visibilityType,
        selectedPersonaId: selectedPersonaId,
        selectedProfileId: selectedProfileId,
        selectedResearchMode: selectedResearchMode,
      };

      console.log('[Chat] Request body prepared with research mode:', {
        chatId: id,
        selectedResearchMode: selectedResearchMode,
        researchModeInBody: requestBody.selectedResearchMode,
        initialResearchMode: initialResearchMode,
        timestamp: new Date().toISOString(),
      });

      console.log('PERSONA_CLIENT: Full request body:', {
        chatId: id,
        requestBody: requestBody,
        personaIncluded: !!requestBody.selectedPersonaId,
        profileIncluded: !!requestBody.selectedProfileId,
      });

      return requestBody;
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
        toast.error(
          'Provider is changing. Please wait a moment before trying again.',
        );
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

          toast.error(`Error with OpenAI. Please try again.`);

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
                content: `Provider error detected. Using OpenAI. Please try again.`,
                createdAt: new Date(),
              },
            ]);
          }, 1000);

          return;
        } else if (recentlyFalledBack) {
          console.warn(
            'Already attempted a fallback recently, not trying again to prevent loops',
          );
          toast.error(
            'Multiple provider errors detected. Please try refreshing the page.',
          );

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
      toast.error(error.message);
    },
  });

  // Process data stream for web search events
  useEffect(() => {
    if (!data) return;

    // Process each data item in the stream
    data.forEach((item: any) => {
      processDataStreamMessage(item);
    });
  }, [data, processDataStreamMessage]);

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
        toast.success(`Switching to OpenAI...`);

        try {
          // First, unload the current provider (allow time for cleanup)
          console.log(`Unloading provider: ${activeProvider}`);

          // Force garbage collection delay to ensure the old provider is unloaded
          // This artificial delay helps prevent the "multiple providers selected" error
          await new Promise((resolve) => setTimeout(resolve, 500));

          // Now set the new provider
          setActiveProvider(newProvider);

          toast.success(`Using OpenAI for chat`);

          // Wait a bit longer to ensure the new provider is fully initialized
          await new Promise((resolve) => setTimeout(resolve, 300));
        } catch (error) {
          console.error('Error during provider transition:', error);
          toast.error('Error switching providers. Please try again.');
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

      toast.success(`Using OpenAI for chat`);
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

        toast.success(`Switched to model: ${newModel}`);
      }
    };

    // Add the event listener
    window.addEventListener('modelChanged', handleModelChange as EventListener);

    // Check if there's a model in sessionStorage that differs from our current state
    const storedModel = sessionStorage.getItem('current_model');
    if (storedModel && storedModel !== activeModel) {
      console.log(`Found model in sessionStorage: ${storedModel}`);
      setActiveModel(storedModel);

      toast.success(`Using model: ${storedModel}`);
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
            content: `Provider switched to OpenAI. Your next message will use the new provider.`,
            createdAt: new Date(),
          },
        ]);
      }

      // For medium-length conversations, suggest starting a new chat
      if (messages.length > 2 && messages.length <= 6) {
        toast.success(
          `For best results with OpenAI, consider starting a new chat.`,
        );
      }

      // For longer conversations, strongly recommend starting a new chat
      if (messages.length > 6) {
        toast.error(
          'Switching providers in long conversations may cause errors. Please start a new chat.',
        );

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
        toast.success(
          `Model changed to ${activeModel}. For best results, please start a new chat.`,
        );
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
    // Don't auto-resume if we're navigating to scroll to a message
    if (autoResume && !scrollToMessageId) {
      experimental_resume();
    }

    // note: this hook has no dependencies since it only needs to run once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const searchParams = useSearchParams();
  const query = searchParams.get('query');
  const scrollToMessageId = searchParams.get('scrollTo');

  const [hasAppendedQuery, setHasAppendedQuery] = useState(false);
  const [hasScrolledToMessage, setHasScrolledToMessage] = useState(false);

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

  // Handle scrollTo query parameter
  useEffect(() => {
    if (scrollToMessageId && !hasScrolledToMessage && messages.length > 0) {
      // Try multiple times with increasing delays to ensure message is rendered
      let attempts = 0;
      const maxAttempts = 5;

      const tryScroll = () => {
        const messageElement = document.querySelector(
          `[data-testid="message-${scrollToMessageId}"]`,
        );

        if (messageElement) {
          // Success - scroll to the message
          messageElement.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });
          // Add a highlight effect
          messageElement.classList.add('bg-eos-orange/20', 'transition-colors');
          setTimeout(() => {
            messageElement.classList.remove('bg-eos-orange/20');
          }, 2000);
          setHasScrolledToMessage(true);
          // Clean up the URL
          window.history.replaceState({}, '', `/chat/${id}`);
        } else if (attempts < maxAttempts) {
          // Try again with a longer delay
          attempts++;
          setTimeout(tryScroll, 200 * attempts);
        }
      };

      // Start trying after a short initial delay
      setTimeout(tryScroll, 300);
    }
  }, [scrollToMessageId, hasScrolledToMessage, messages.length, id]);

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

  const { pinnedMessages, handlePin } = useMessageActions({ chatId: id });

  const handleScrollToMessage = (messageId: string) => {
    const messageElement = document.querySelector(
      `[data-testid="message-${messageId}"]`,
    );
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Add a highlight effect
      messageElement.classList.add('bg-eos-orange/10');
      setTimeout(() => {
        messageElement.classList.remove('bg-eos-orange/10');
      }, 2000);
    }
  };

  // Handle persona changes
  const handlePersonaChange = useCallback(
    async (personaId: string | null) => {
      console.log('PERSONA_CLIENT: handlePersonaChange called', {
        chatId: id,
        currentPersonaId: selectedPersonaId,
        newPersonaId: personaId,
        hasInitialMessages,
        isNewChat: !hasInitialMessages,
        timestamp: new Date().toISOString(),
      });

      // Update state immediately for instant UI feedback
      setSelectedPersonaId(personaId || undefined);
      console.log('PERSONA_CLIENT: State updated immediately', {
        chatId: id,
        newSelectedPersonaId: personaId || undefined,
      });

      // Clear profile selection when persona changes
      if (personaId !== selectedPersonaId) {
        setSelectedProfileId(undefined);
        console.log(
          'PERSONA_CLIENT: Cleared profile selection due to persona change',
        );
      }

      // Store in localStorage only when user explicitly selects a persona
      // This will be used for future new chats, but current new chats start with default
      if (personaId) {
        localStorage.setItem('selectedPersonaId', personaId);
        console.log(
          'PERSONA_CLIENT: Stored persona in localStorage for future new chats',
          {
            personaId: personaId,
          },
        );
      } else {
        localStorage.removeItem('selectedPersonaId');
        console.log(
          'PERSONA_CLIENT: Removed persona from localStorage - future new chats will use default',
        );
      }

      // For existing chats (with messages), update the chat record immediately
      if (hasInitialMessages) {
        console.log(
          'PERSONA_CLIENT: Existing chat detected, updating database',
          {
            chatId: id,
            personaId: personaId,
          },
        );

        try {
          console.log(
            'PERSONA_CLIENT: Making API request to update existing chat',
            {
              chatId: id,
              url: `/api/chat/${id}`,
              personaId: personaId,
            },
          );

          const response = await fetch(`/api/chat/${id}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              personaId: personaId,
              profileId: null, // Clear profile when persona changes
            }),
          });

          console.log('PERSONA_CLIENT: API response received', {
            chatId: id,
            status: response.status,
            statusText: response.statusText,
            ok: response.ok,
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error('PERSONA_CLIENT: API request failed', {
              chatId: id,
              status: response.status,
              statusText: response.statusText,
              errorText: errorText,
            });
            throw new Error(
              `HTTP error! status: ${response.status}, message: ${errorText}`,
            );
          }

          const responseData = await response.json();
          console.log('PERSONA_CLIENT: API request successful', {
            chatId: id,
            responseData: responseData,
            updatedPersonaId: responseData.personaId,
          });

          console.log(
            'PERSONA_CLIENT: Existing chat persona updated successfully',
            {
              chatId: id,
              personaId: personaId,
            },
          );
        } catch (error) {
          console.error(
            'PERSONA_CLIENT: Error updating existing chat persona:',
            {
              chatId: id,
              error: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : undefined,
              personaId: personaId,
              initialPersonaId: initialPersonaId,
            },
          );

          // Revert the state if the API call failed
          console.log('PERSONA_CLIENT: Reverting state due to error', {
            chatId: id,
            revertingTo: initialPersonaId,
          });
          setSelectedPersonaId(initialPersonaId);
          return; // Exit early on error
        }
      } else {
        console.log(
          'PERSONA_CLIENT: New chat detected, persona will be applied when first message is sent',
          {
            chatId: id,
            personaId: personaId,
            storedInLocalStorage: true,
          },
        );
      }

      // Dispatch a custom event to notify other components
      console.log('PERSONA_CLIENT: Dispatching personaChanged event', {
        chatId: id,
        personaId: personaId,
        isNewChat: !hasInitialMessages,
      });
      window.dispatchEvent(
        new CustomEvent('personaChanged', {
          detail: { personaId },
        }),
      );

      console.log('PERSONA_CLIENT: Persona change completed successfully', {
        chatId: id,
        personaId: personaId,
        method: hasInitialMessages ? 'database_update' : 'localStorage_storage',
      });
    },
    [id, initialPersonaId, selectedPersonaId, hasInitialMessages],
  );

  // Handle profile changes
  const handleProfileChange = useCallback(
    async (profileId: string | null) => {
      console.log('PROFILE_CLIENT: handleProfileChange called', {
        chatId: id,
        currentProfileId: selectedProfileId,
        newProfileId: profileId,
        hasInitialMessages,
        isNewChat: !hasInitialMessages,
        timestamp: new Date().toISOString(),
      });

      // Update state immediately for instant UI feedback
      setSelectedProfileId(profileId || undefined);
      console.log('PROFILE_CLIENT: State updated immediately', {
        chatId: id,
        newSelectedProfileId: profileId || undefined,
      });

      // Store in localStorage for future new chats
      if (profileId) {
        localStorage.setItem('selectedProfileId', profileId);
        console.log(
          'PROFILE_CLIENT: Stored profile in localStorage for future new chats',
          {
            profileId: profileId,
          },
        );
      } else {
        localStorage.removeItem('selectedProfileId');
        console.log(
          'PROFILE_CLIENT: Removed profile from localStorage - future new chats will use default',
        );
      }

      // For existing chats (with messages), update the chat record immediately
      if (hasInitialMessages) {
        console.log(
          'PROFILE_CLIENT: Existing chat detected, updating database',
          {
            chatId: id,
            profileId: profileId,
          },
        );

        try {
          console.log(
            'PROFILE_CLIENT: Making API request to update existing chat',
            {
              chatId: id,
              url: `/api/chat/${id}`,
              profileId: profileId,
            },
          );

          const response = await fetch(`/api/chat/${id}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              profileId: profileId,
            }),
          });

          console.log('PROFILE_CLIENT: API response received', {
            chatId: id,
            status: response.status,
            statusText: response.statusText,
            ok: response.ok,
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error('PROFILE_CLIENT: API request failed', {
              chatId: id,
              status: response.status,
              statusText: response.statusText,
              errorText: errorText,
            });
            throw new Error(
              `HTTP error! status: ${response.status}, message: ${errorText}`,
            );
          }

          const responseData = await response.json();
          console.log('PROFILE_CLIENT: API request successful', {
            chatId: id,
            responseData: responseData,
            updatedProfileId: responseData.profileId,
          });

          console.log(
            'PROFILE_CLIENT: Existing chat profile updated successfully',
            {
              chatId: id,
              profileId: profileId,
            },
          );
        } catch (error) {
          console.error(
            'PROFILE_CLIENT: Error updating existing chat profile:',
            {
              chatId: id,
              error: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : undefined,
              profileId: profileId,
              initialProfileId: initialProfileId,
            },
          );

          // Revert the state if the API call failed
          console.log('PROFILE_CLIENT: Reverting state due to error', {
            chatId: id,
            revertingTo: initialProfileId,
          });
          setSelectedProfileId(initialProfileId);
          return; // Exit early on error
        }
      } else {
        console.log(
          'PROFILE_CLIENT: New chat detected, profile will be applied when first message is sent',
          {
            chatId: id,
            profileId: profileId,
            storedInLocalStorage: true,
          },
        );
      }

      // Dispatch a custom event to notify other components
      console.log('PROFILE_CLIENT: Dispatching profileChanged event', {
        chatId: id,
        profileId: profileId,
        isNewChat: !hasInitialMessages,
      });
      window.dispatchEvent(
        new CustomEvent('profileChanged', {
          detail: { profileId },
        }),
      );

      console.log('PROFILE_CLIENT: Profile change completed successfully', {
        chatId: id,
        profileId: profileId,
        method: hasInitialMessages ? 'database_update' : 'localStorage_storage',
      });
    },
    [id, initialProfileId, selectedProfileId, hasInitialMessages],
  );

  // Initialize persona for new chats - always default to Default EOS AI
  useEffect(() => {
    console.log(
      'PERSONA_CLIENT: Checking for new chat persona initialization',
      {
        chatId: id,
        initialPersonaId: initialPersonaId,
        hasInitialMessages: hasInitialMessages,
        shouldInitialize: !initialPersonaId && !hasInitialMessages,
        userEmail: session?.user?.email,
      },
    );

    if (!initialPersonaId && !hasInitialMessages) {
      console.log(
        'PERSONA_CLIENT: New chat detected, defaulting to Default EOS AI',
        {
          chatId: id,
          userEmail: session?.user?.email,
        },
      );

      // All new chats default to Default EOS AI (no persona selected)
      setSelectedPersonaId(undefined);

      // Clear any stored persona preference for new chats
      localStorage.removeItem('selectedPersonaId');

      console.log('PERSONA_CLIENT: New chat persona initialization completed', {
        chatId: id,
        defaultPersona: 'Default EOS AI (null)',
      });
    } else {
      console.log('PERSONA_CLIENT: Skipping new chat persona initialization', {
        chatId: id,
        reason: initialPersonaId
          ? 'has_initial_persona'
          : 'has_initial_messages',
      });
    }
  }, [initialPersonaId, hasInitialMessages, session?.user?.email]);

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
          toast.error(
            'Provider is currently changing. Please wait a moment before sending a message.',
          );
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
                  toast.error(
                    'The response is taking too long. Please stop and try again.',
                  );
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

  // Handle document context auto-submission
  useEffect(() => {
    if (documentContext && messages.length === 0 && status !== 'streaming') {
      // Auto-submit the document context message when the chat is empty
      const submitMessage = async () => {
        try {
          console.log(
            'Auto-submitting document context message:',
            documentContext,
          );

          // Add the message with document context
          const messageToSend = {
            role: 'user' as const,
            content: documentContext.message,
            ...(documentContext.type === 'ai-document'
              ? { documentId: documentContext.id }
              : { userDocumentId: documentContext.id }),
          };

          await append(messageToSend);
        } catch (error) {
          console.error('Error auto-submitting document context:', error);
        }
      };

      // Small delay to ensure component is fully mounted
      const timer = setTimeout(submitMessage, 100);
      return () => clearTimeout(timer);
    }
  }, [documentContext, messages.length, status, append]);

  // Handle research mode changes and save to user settings
  const handleResearchModeChange = useCallback(
    async (mode: ResearchMode) => {
      // Prevent multiple simultaneous changes
      if (researchModeChanging) {
        console.log(
          '[Chat] Research mode change already in progress, ignoring',
        );
        return;
      }

      // Prevent redundant changes
      if (mode === selectedResearchMode) {
        console.log('[Chat] Research mode is already', mode, ', ignoring');
        return;
      }

      console.log('[Chat] Research mode change requested:', {
        from: selectedResearchMode,
        to: mode,
        chatId: id,
      });

      const previousMode = selectedResearchMode;

      try {
        // Set loading state
        setResearchModeChanging(true);

        // CRITICAL: When switching from Nexus to Standard mode, clear all caches
        if (previousMode === 'nexus' && mode === 'off') {
          console.log(
            '[Chat] Switching from Nexus to Standard - clearing all caches and state',
          );

          // Clear browser storage related to research/nexus data
          try {
            // Clear any nexus-related data from localStorage
            const allKeys = Object.keys(localStorage);
            const nexusKeys = allKeys.filter(
              (key) =>
                key.toLowerCase().includes('nexus') ||
                key.toLowerCase().includes('research') ||
                key.toLowerCase().includes('search'),
            );
            nexusKeys.forEach((key) => {
              console.log('[Chat] Clearing localStorage key:', key);
              localStorage.removeItem(key);
            });

            // Clear any nexus-related data from sessionStorage
            const sessionKeys = Object.keys(sessionStorage);
            const nexusSessionKeys = sessionKeys.filter(
              (key) =>
                key.toLowerCase().includes('nexus') ||
                key.toLowerCase().includes('research') ||
                key.toLowerCase().includes('search'),
            );
            nexusSessionKeys.forEach((key) => {
              console.log('[Chat] Clearing sessionStorage key:', key);
              sessionStorage.removeItem(key);
            });

            console.log('[Chat] Browser storage cleared successfully');
          } catch (storageError) {
            console.warn(
              '[Chat] Error clearing browser storage:',
              storageError,
            );
          }

          // Clear any cached API responses or contexts
          try {
            // Force clear SWR cache for this chat
            if (typeof mutate === 'function') {
              console.log('[Chat] Clearing SWR cache');
              mutate(() => true, undefined, { revalidate: false });
            }
          } catch (cacheError) {
            console.warn('[Chat] Error clearing cache:', cacheError);
          }

          // Clear any data stream contexts
          try {
            // Dispatch custom event to clear nexus-related contexts
            console.log('[Chat] Dispatching nexus-clear event');
            window.dispatchEvent(
              new CustomEvent('nexus-clear', {
                detail: {
                  chatId: id,
                  previousMode,
                  newMode: mode,
                  timestamp: new Date().toISOString(),
                },
              }),
            );
          } catch (eventError) {
            console.warn('[Chat] Error dispatching clear event:', eventError);
          }

          console.log(
            '[Chat] All caches and state cleared for Nexus → Standard transition',
          );
        }

        // Update state immediately for UI responsiveness
        setSelectedResearchMode(mode);
        console.log('[Chat] Local state updated to:', mode);

        // Save to user settings with proper error handling
        console.log('[Chat] Saving research mode to database...');
        const response = await fetch('/api/user-settings', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            selectedResearchMode: mode,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[Chat] Failed to save research mode preference:', {
            status: response.status,
            statusText: response.statusText,
            errorText,
          });

          throw new Error(`Failed to save: ${response.status} ${errorText}`);
        }

        console.log(
          '[Chat] Research mode preference saved successfully to database',
        );

        // Show enhanced success feedback with clearing confirmation
        if (previousMode === 'nexus' && mode === 'off') {
          toast.success(
            'Switched to Standard mode - All Nexus caches cleared',
            { duration: 3000 },
          );
        } else {
          toast.success(
            `Switched to ${mode === 'off' ? 'Standard' : 'Nexus'} mode`,
          );
        }
      } catch (error) {
        console.error('[Chat] Error saving research mode preference:', error);

        // Revert state on error
        console.log('[Chat] Reverting research mode due to error');
        setSelectedResearchMode(previousMode);

        // Show user feedback
        toast.error('Failed to save research mode preference');
      } finally {
        // Always clear loading state
        setResearchModeChanging(false);
      }
    },
    [selectedResearchMode, researchModeChanging, id, mutate],
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
          selectedPersonaId={selectedPersonaId}
          selectedProfileId={selectedProfileId}
          onPersonaChange={handlePersonaChange}
          onProfileChange={handleProfileChange}
          messages={messages}
          onScrollToMessage={handleScrollToMessage}
        />

        {/* PinnedMessagesBar is now integrated into ChatHeader via SavedContentDropdown */}

        <Messages
          chatId={id}
          status={status}
          votes={votes}
          messages={messages}
          setMessages={setMessages}
          reload={reload}
          isReadonly={isReadonly}
          isArtifactVisible={isArtifactVisible}
          citations={citations}
          searchProgress={searchProgress}
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
              selectedResearchMode={selectedResearchMode}
              onResearchModeChange={handleResearchModeChange}
              isChanging={researchModeChanging}
            />
          )}
        </form>

        <MessageLimitIndicator />
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
