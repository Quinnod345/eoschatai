'use client';

import type { Attachment, UIMessage } from 'ai';
import { useChat } from '@ai-sdk/react';
import { useEffect, useState, useRef, useCallback } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { ChatHeader } from '@/components/chat-header';
import type { Vote } from '@/lib/db/schema';
import { fetcher, generateUUID } from '@/lib/utils';
import { Composer } from './composer';
import { MultimodalInput } from './multimodal-input';
import { Messages } from './messages';
import type { VisibilityType } from './visibility-selector';
import { useComposer, useComposerSelector } from '@/hooks/use-composer';
import type { ComposerKind } from './composer';
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
import { ReplyIndicator } from './reply-indicator';
import { motion, AnimatePresence } from 'framer-motion';
import { useReplyState } from '@/hooks/use-reply-state';
import { NexusResearchPlan } from './nexus-research-plan';
import { ComposerContextIndicator } from './composer-context-indicator';
import { NexusFollowUpQuestions } from './nexus-followup-questions';
import { NexusResearchDisplay } from './nexus-research-display';

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
  pendingMessage,
  onPendingMessageSent,
  meetingMetadata,
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
  pendingMessage?: string | null;
  onPendingMessageSent?: () => void;
  meetingMetadata?: any;
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

  // Add state for Nexus search progress
  const [nexusSearchData, setNexusSearchData] = useState<any>(null);
  const [nexusResearchPlan, setNexusResearchPlan] = useState<any>(null);
  const [followUpQuestions, setFollowUpQuestions] = useState<string[]>([]);
  const [nexusSearchEvents, setNexusSearchEvents] = useState<any[]>([]);
  const [nexusCitations, setNexusCitations] = useState<
    Array<{
      number: number;
      title: string;
      url: string;
    }>
  >([]);

  // Add logging for research mode changes
  useEffect(() => {
    console.log('[Chat] selectedResearchMode state changed:', {
      newMode: selectedResearchMode,
      chatId: id,
      timestamp: new Date().toISOString(),
    });
  }, [selectedResearchMode, id]);

  // Listen for mode-clear events to ensure complete state reset
  useEffect(() => {
    const handleModeClear = (event: Event) => {
      const customEvent = event as CustomEvent;
      const {
        chatId: eventChatId,
        previousMode,
        newMode,
      } = customEvent.detail || {};

      console.log('[Chat] Mode clear event received:', {
        eventChatId,
        currentChatId: id,
        previousMode,
        newMode,
        timestamp: new Date().toISOString(),
      });

      // Only process if this is for our chat
      if (eventChatId === id) {
        console.log(
          `[Chat] Processing mode clear for this chat: ${previousMode} → ${newMode}`,
        );

        // Force re-render by updating a state that doesn't affect functionality
        // This ensures any stale state is completely refreshed
        setResearchModeChanging(false);

        // Additional cleanup specific to this chat
        try {
          // Clear any component-specific state that might persist
          console.log('[Chat] Performing additional component cleanup');

          // Reset any message-specific state that might have mode-specific context
          // This is a safety measure to ensure complete clean slate
        } catch (cleanupError) {
          console.warn('[Chat] Error in additional cleanup:', cleanupError);
        }
      }
    };

    // Add the event listener
    window.addEventListener('mode-clear', handleModeClear);

    // Cleanup
    return () => {
      window.removeEventListener('mode-clear', handleModeClear);
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

      // Clear Nexus search events for new message
      setNexusSearchEvents([]);
      setNexusSearchData(null);
      setNexusResearchPlan(null);

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
        composerDocumentId:
          composer?.isVisible && composer?.documentId
            ? composer.documentId
            : undefined,
      };

      console.log('[Chat] Request body prepared with research mode:', {
        chatId: id,
        selectedResearchMode: selectedResearchMode,
        researchModeInBody: requestBody.selectedResearchMode,
        initialResearchMode: initialResearchMode,
        timestamp: new Date().toISOString(),
      });

      // Enhanced composer debugging
      console.log('[ARTIFACT DEBUG] Request body composer info:', {
        composerState: {
          isVisible: composer?.isVisible,
          documentId: composer?.documentId,
          kind: composer?.kind,
          status: composer?.status,
          title: composer?.title,
        },
        composerDocumentId: requestBody.composerDocumentId,
        wasIncluded: !!requestBody.composerDocumentId,
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

  // Track current Nexus stream ID for recovery
  const [nexusStreamId, setNexusStreamId] = useState<string | null>(null);

  // TODO: Re-implement resumable streams later
  // Check for interrupted Nexus searches on mount (disabled for now)
  useEffect(() => {
    // Clear any old stream IDs to prevent errors
    const storedStreamId = sessionStorage.getItem(`nexus-stream-${id}`);
    if (storedStreamId) {
      sessionStorage.removeItem(`nexus-stream-${id}`);
    }
  }, [id]);

  // Track processed Nexus events to avoid duplicates
  const processedEventsRef = useRef<Set<string>>(new Set());

  // Handle Nexus search events from data stream
  useEffect(() => {
    if (!data || data.length === 0) return;

    // Process only new events that haven't been processed yet
    const newEvents = data.filter((item: any) => {
      if (
        item &&
        typeof item === 'object' &&
        'type' in item &&
        item.type.startsWith('nexus-')
      ) {
        // Create a unique key for this event
        const eventKey = `${item.type}-${JSON.stringify(item)}-${data.indexOf(item)}`;
        if (!processedEventsRef.current.has(eventKey)) {
          processedEventsRef.current.add(eventKey);
          return true;
        }
      }
      return false;
    });

    // Process each new event
    newEvents.forEach((eventData: any) => {
      const eventType = eventData.type as string;
      console.log('[Chat] Nexus event received:', eventType, eventData);

      // Add all events to the events array for NexusResearchDisplay
      setNexusSearchEvents((prev) => [...prev, eventData]);

      // Handle different Nexus events
      switch (eventType) {
        case 'nexus-progress':
          setNexusSearchData(eventData);
          break;
        case 'nexus-plan-complete':
          setNexusResearchPlan(eventData.plan);
          setNexusSearchData({ ...eventData, type: 'nexus-progress' });
          break;
        case 'nexus-search-update':
          setNexusSearchData((prev: any) => ({
            ...prev,
            currentStep: eventData.currentStep,
            questionsSearched: eventData.questionsSearched,
            message: eventData.message,
          }));
          break;
        case 'nexus-search-complete':
          setNexusSearchData((prev: any) => ({
            ...prev,
            totalResults: eventData.totalResults,
          }));
          // Extract citations from complete event
          if (eventData.citations) {
            setNexusCitations(eventData.citations);
          }
          // Extract follow-up questions
          if (eventData.followUpQuestions) {
            setFollowUpQuestions(eventData.followUpQuestions);
          }
          break;
        case 'nexus-analysis-update':
          setNexusSearchData((prev: any) => ({
            ...prev,
            currentAnalysisStep: eventData.stepNumber,
          }));
          break;
        case 'nexus-synthesis-complete':
          // Store citations for display
          if (eventData.citations && Array.isArray(eventData.citations)) {
            setNexusCitations(
              eventData.citations as Array<{
                number: number;
                title: string;
                url: string;
              }>,
            );
          }
          // Auto-dismiss the progress UI after a short delay
          setTimeout(() => {
            setNexusSearchData(null);
            setNexusResearchPlan(null);
          }, 2000);
          break;
        case 'nexus-followup-questions':
          console.log(
            '[Chat] Follow-up questions received:',
            eventData.questions,
          );
          setFollowUpQuestions(eventData.questions || []);
          break;
        default:
          setNexusSearchData(eventData);
      }
    });
  }, [data, id]);

  // Process data stream for web search events
  useEffect(() => {
    if (!data) return;

    // Process each data item in the stream
    data.forEach((item: any) => {
      processDataStreamMessage(item);

      // Handle nexus complete response
      if (item.type === 'nexus-complete-response' && item.content) {
        console.log('[Chat] Nexus complete response received');

        // Find the last assistant message and update it with the complete content
        setMessages((prevMessages) => {
          const lastAssistantIndex = prevMessages.findLastIndex(
            (m) => m.role === 'assistant',
          );

          if (lastAssistantIndex !== -1) {
            const updatedMessages = [...prevMessages];
            updatedMessages[lastAssistantIndex] = {
              ...updatedMessages[lastAssistantIndex],
              parts: [{ type: 'text', text: item.content }],
            };
            return updatedMessages;
          }

          // If no assistant message exists, create one
          return [
            ...prevMessages,
            {
              id: generateUUID(),
              role: 'assistant',
              content: item.content,
              parts: [{ type: 'text', text: item.content }],
              createdAt: new Date(),
            },
          ];
        });
      }
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
    // Don't auto-resume if we're navigating to scroll to a message or if there are no messages
    if (autoResume && !scrollToMessageId && messages.length > 0) {
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
  const isComposerVisible = useComposerSelector((state) => state.isVisible);
  const { composer, setComposer } = useComposer();

  // Reference to store the timeout ID
  const responseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingMessageSentRef = useRef<boolean>(false);

  const { pinnedMessages, handlePin } = useMessageActions({ chatId: id });

  // Custom retry function that properly formats the request
  const handleRetry = useCallback(async () => {
    if (messages.length < 2) return;

    // Get the last user message
    let lastUserMessage = null;
    for (let i = messages.length - 2; i >= 0; i--) {
      if (messages[i].role === 'user') {
        lastUserMessage = messages[i];
        break;
      }
    }

    if (!lastUserMessage) return;

    // Remove the last assistant message
    const newMessages = messages.filter(
      (_, index) => index !== messages.length - 1,
    );
    setMessages(newMessages);

    // Resubmit the last user message
    await append({
      id: generateUUID(),
      role: 'user',
      content: lastUserMessage.content,
      createdAt: new Date(),
    });
  }, [messages, setMessages, append]);

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

  // Handle dashboard and new composer creation based on URL
  useEffect(() => {
    const url = new URL(window.location.href);
    const dashboard = url.searchParams.get('dashboard');
    const newKind = url.searchParams.get(
      'newComposerKind',
    ) as ComposerKind | null;
    const newTitle = url.searchParams.get('newComposerTitle');
    const existingId = url.searchParams.get('documentId');
    const existingTitle = url.searchParams.get('documentTitle');
    const existingKind = url.searchParams.get(
      'composerKind',
    ) as ComposerKind | null;

    // If creating a new composer, set up a blank composer and show the panel.
    if (newKind) {
      const newDocumentId = generateUUID();

      // For accountability charts, generate a proper title
      const generatedTitle =
        newKind === 'accountability'
          ? `${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} Accountability Chart`
          : newTitle || 'Untitled';

      setComposer((current) => ({
        ...current,
        kind: newKind,
        title: generatedTitle,
        documentId: newDocumentId,
        content: '',
        isVisible: true,
        status: 'idle',
      }));

      // Create composer via AI generation for accountability charts
      if (newKind === 'accountability') {
        // Use the composer edit API to generate initial content with AI
        fetch('/api/composer/edit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'create',
            id: newDocumentId,
            title: generatedTitle,
            kind: newKind,
          }),
        })
          .then(async (res) => {
            if (res.ok) {
              const data = await res.json();
              console.log(
                '[ARTIFACT DEBUG] AC composer created with AI:',
                data,
              );
              // Update the composer with the generated content
              setComposer((current) => ({
                ...current,
                content: data.content || '',
                title: data.title || generatedTitle,
              }));
            } else {
              console.error('[ARTIFACT DEBUG] Failed to create AC composer:', {
                status: res.status,
                statusText: res.statusText,
                text: await res.text(),
              });
            }
          })
          .catch((error) => {
            console.error(
              '[ARTIFACT DEBUG] Error creating AC composer:',
              error,
            );
          });
      } else {
        // For other types, create empty composer in database
        // Initialize with a space to ensure the editor can initialize properly
        const initialContent = ' ';
        setComposer((current) => ({
          ...current,
          content: initialContent,
        }));

        fetch(`/api/document?id=${newDocumentId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: generatedTitle,
            kind: newKind,
            content: initialContent,
          }),
        })
          .then(async (res) => {
            if (res.ok) {
              console.log(
                '[ARTIFACT DEBUG] Empty composer saved to database:',
                {
                  id: newDocumentId,
                  kind: newKind,
                  title: generatedTitle,
                },
              );
            } else {
              console.error('[ARTIFACT DEBUG] Failed to save composer:', {
                status: res.status,
                statusText: res.statusText,
                text: await res.text(),
              });
            }
          })
          .catch((error) => {
            console.error('[ARTIFACT DEBUG] Error saving composer:', error);
          });
      }

      // Remove the param so refreshes don't re-trigger
      url.searchParams.delete('newComposerKind');
      url.searchParams.delete('newComposerTitle');
      window.history.replaceState({}, '', url.toString());
    }

    // Opening an existing composer from dashboard
    if (existingId) {
      setComposer((current) => ({
        ...current,
        kind: existingKind || current.kind,
        title: existingTitle || current.title || '',
        documentId: existingId,
        isVisible: true,
        status: 'idle',
      }));
      // Do not navigate. Mirroring is handled inside the Composer component.
    }

    // Dashboard param is consumed by dashboard UI component; no-op here.
  }, [setComposer]);

  // Handle research mode changes and save to user settings
  const handleResearchModeChange = useCallback(
    (mode: ResearchMode) => {
      console.log('[Chat] handleResearchModeChange called:', {
        currentMode: selectedResearchMode,
        newMode: mode,
        chatId: id,
      });

      // Prevent unnecessary updates
      if (mode === selectedResearchMode) {
        console.log('[Chat] Research mode unchanged, skipping update', mode);
        return;
      }

      setResearchModeChanging(true);
      setSelectedResearchMode(mode);

      // Update user preference in the database
      fetch('/api/user-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedResearchMode: mode }),
      })
        .then(() => {
          console.log('[Chat] Research mode saved to database:', mode);
        })
        .catch((error) => {
          console.error('[Chat] Failed to save research mode:', error);
        })
        .finally(() => {
          setResearchModeChanging(false);
        });
    },
    [selectedResearchMode, id],
  );

  // Auto-submit pending message
  useEffect(() => {
    if (
      pendingMessage &&
      !isReadonly &&
      status === 'ready' &&
      !pendingMessageSentRef.current
    ) {
      // Mark as sent immediately to prevent duplicates
      pendingMessageSentRef.current = true;

      // Use append to send the message and get AI response
      const sendMessage = async () => {
        try {
          await append({
            role: 'user',
            content: pendingMessage,
          });
          // Clear the pending message after sending to prevent duplicates
          if (onPendingMessageSent) {
            onPendingMessageSent();
          }
        } catch (error) {
          console.error('Error sending pending message:', error);
          // Reset the flag if there was an error so it can be retried
          pendingMessageSentRef.current = false;
        }
      };

      setTimeout(sendMessage, 500);
    }
  }, [pendingMessage, isReadonly, status, append, onPendingMessageSent]);

  // Reset the sent flag when pendingMessage changes
  useEffect(() => {
    if (!pendingMessage) {
      pendingMessageSentRef.current = false;
    }
  }, [pendingMessage]);

  // Add reply state management
  const { replyState, isReplying, startReply, cancelReply, clearReply } =
    useReplyState();

  // Clear reply when input is submitted
  useEffect(() => {
    if (status === 'submitted' && isReplying) {
      clearReply();
    }
  }, [status, isReplying, clearReply]);

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

        {/* Show composer context indicator when composer is open */}
        <AnimatePresence>
          {composer?.isVisible && composer?.documentId && (
            <motion.div
              initial={{ y: -6, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -6, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 350, damping: 26 }}
            >
              <ComposerContextIndicator
                documentId={composer.documentId}
                title={composer.title || 'Untitled'}
                kind={composer.kind || 'text'}
                onClose={() =>
                  setComposer((current) => ({ ...current, isVisible: false }))
                }
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* PinnedMessagesBar is now integrated into ChatHeader via SavedContentDropdown */}

        <Messages
          chatId={id}
          status={status}
          votes={votes}
          messages={messages}
          setMessages={setMessages}
          reload={reload}
          isReadonly={isReadonly}
          isComposerVisible={isComposerVisible}
          citations={
            selectedResearchMode === 'nexus' ? nexusCitations : citations
          }
          searchProgress={searchProgress}
          meetingMetadata={meetingMetadata}
          onStartReply={startReply}
          onRetry={handleRetry}
        />

        {/* Show follow-up questions if available */}
        {followUpQuestions.length > 0 && selectedResearchMode === 'nexus' && (
          <div className="fixed bottom-4 right-4 z-30 max-w-md w-[92vw] sm:w-[420px] pointer-events-auto">
            <NexusFollowUpQuestions
              className="shadow-lg"
              questions={followUpQuestions}
              onQuestionSelect={(question) => {
                setFollowUpQuestions([]);
                setInput(question);
                setTimeout(() => {
                  handleSubmitAdapter();
                }, 100);
              }}
              onRefresh={() => {
                console.log('Refresh follow-up questions');
              }}
            />
          </div>
        )}

        {/* Show Nexus search progress if active */}
        {nexusResearchPlan?.plan && (
          <div className="absolute bottom-32 left-0 right-0 mx-auto px-4 w-full md:max-w-3xl z-20">
            <NexusResearchPlan
              plan={nexusResearchPlan.plan}
              maxLookupsAllowed={nexusResearchPlan.maxLookupsAllowed}
              onStartResearch={async ({ maxLookups }) => {
                // Start the actual research
                console.log('[Chat] Starting approved research');
                setNexusResearchPlan(null);
                setNexusSearchData({
                  type: 'nexus-search-start',
                  message: 'Starting research...',
                });

                try {
                  const response = await fetch('/api/nexus-execute', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      plan: nexusResearchPlan.plan,
                      chatId: id,
                      maxLookups,
                    }),
                  });

                  if (!response.ok) {
                    throw new Error('Failed to start research');
                  }

                  // Process the stream
                  const reader = response.body?.getReader();
                  if (reader) {
                    const decoder = new TextDecoder();
                    while (true) {
                      const { done, value } = await reader.read();
                      if (done) break;

                      const chunk = decoder.decode(value, { stream: true });
                      const lines = chunk.split('\n');

                      for (const line of lines) {
                        if (line.startsWith('data: ')) {
                          try {
                            const data = JSON.parse(line.slice(6));
                            setNexusSearchData(data);

                            // If research is complete, append the results to the conversation
                            if (
                              data.type === 'nexus-search-complete' &&
                              data.results
                            ) {
                              // The results will be handled by the existing nexus logic
                              processDataStreamMessage(data);
                            }
                          } catch (e) {
                            console.error('Failed to parse stream data:', e);
                          }
                        }
                      }
                    }
                  }
                } catch (error) {
                  console.error('[Chat] Error executing research:', error);
                  toast.error('Failed to execute research plan');
                }
              }}
              onRegenerate={async (feedback) => {
                // Regenerate the plan with feedback
                console.log(
                  '[Chat] Regenerating plan with feedback:',
                  feedback,
                );
                setNexusResearchPlan(null);
                setNexusSearchData({
                  type: 'nexus-plan-generating',
                  message: 'Regenerating plan...',
                });

                try {
                  const response = await fetch('/api/nexus-plan', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      query: messages[messages.length - 1].content,
                      model: activeModel,
                      regenerate: true,
                      feedback,
                    }),
                  });

                  const planData = await response.json();
                  if (planData.success) {
                    setNexusResearchPlan({
                      plan: planData.plan,
                      totalSearches: planData.totalSearches,
                      phases: planData.phases,
                      requiresApproval: true,
                      maxLookupsAllowed: planData.maxLookupsAllowed,
                    });
                    setNexusSearchData(null);
                  } else {
                    throw new Error(
                      planData.error || 'Failed to regenerate plan',
                    );
                  }
                } catch (error) {
                  console.error('[Chat] Error regenerating plan:', error);
                  toast.error('Failed to regenerate research plan');
                  setNexusSearchData(null);
                }
              }}
            />
          </div>
        )}

        {selectedResearchMode === 'nexus' && nexusSearchEvents.length > 0 && (
          <div className="absolute bottom-32 left-0 right-0 mx-auto px-4 w-full md:max-w-3xl z-20">
            <NexusResearchDisplay events={nexusSearchEvents} />
          </div>
        )}

        <form className="absolute bottom-0 left-0 right-0 flex flex-col mx-auto px-4 bg-transparent pb-4 md:pb-6 pt-2 gap-2 w-full md:max-w-3xl z-10">
          {/* Reply Indicator */}
          <AnimatePresence initial={false}>
            {isReplying && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ type: 'spring', stiffness: 350, damping: 26 }}
              >
                <ReplyIndicator
                  isVisible={isReplying}
                  replyingTo={replyState}
                  onCancel={cancelReply}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {!isReadonly && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 350, damping: 26 }}
            >
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
                selectedPersonaId={selectedPersonaId}
                selectedProfileId={selectedProfileId}
                session={session}
                isReadonly={isReadonly}
                selectedResearchMode={selectedResearchMode}
                onResearchModeChange={handleResearchModeChange}
                isChanging={researchModeChanging}
              />
            </motion.div>
          )}
        </form>

        <MessageLimitIndicator />
      </div>

      <Composer
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
