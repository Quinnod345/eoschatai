import type { UIMessage } from 'ai';
import { PreviewMessage, ThinkingMessage } from './message';
import { memo, useEffect, useMemo, useState } from 'react';
import type { Vote } from '@/lib/db/schema';
import equal from 'fast-deep-equal';
import type { UseChatHelpers } from '@ai-sdk/react';
import { motion } from 'framer-motion';
import { useMessages } from '@/hooks/use-messages';
import { useMessageActions } from '@/hooks/use-message-actions';
import type { SearchProgress } from '@/hooks/use-web-search-progress';
import { MessageSkeleton } from './message-skeleton';
import { usePathname } from 'next/navigation';
import { ComposerDashboard } from './composer-dashboard';

interface CitationReference {
  number: number;
  title: string;
  url: string;
  snippet?: string;
}

interface MessagesProps {
  chatId: string;
  status: UseChatHelpers['status'];
  votes: Array<Vote> | undefined;
  messages: Array<UIMessage>;
  setMessages: UseChatHelpers['setMessages'];
  reload: UseChatHelpers['reload'];
  isReadonly: boolean;
  isArtifactVisible?: boolean;
  isComposerVisible?: boolean;
  citations?: CitationReference[];
  searchProgress?: SearchProgress;
  meetingMetadata?: any;
  dataStream?: any[];
  onStartReply?: (
    messageId: string,
    content: string,
    role: 'user' | 'assistant',
  ) => void;
  onRetry?: () => void;
}

function PureMessages({
  chatId,
  status,
  votes,
  messages,
  setMessages,
  reload,
  isReadonly,
  citations: propCitations,
  searchProgress,
  meetingMetadata,
  dataStream,
  onStartReply,
  onRetry,
}: MessagesProps) {
  const pathname = usePathname();

  // Extract citations from message parts if available
  const extractedCitations = useMemo(() => {
    console.log('[Citations Debug] Starting extraction', {
      propCitationsCount: propCitations?.length || 0,
      messagesCount: messages.length,
    });

    // First check if we have citations from props (during active chat)
    if (propCitations && propCitations.length > 0) {
      console.log('[Citations Debug] Using prop citations:', propCitations);
      return propCitations;
    }

    // Otherwise, extract from message parts (when returning to chat)
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.role === 'assistant' && (msg as any)?.parts) {
        // Check if any part contains citations
        const parts: any[] = Array.isArray((msg as any)?.parts)
          ? ((msg as any)?.parts as any[])
          : [];

        // Log full structure of parts to diagnose
        console.log(`[Citations Debug] Message ${i} has ${parts.length} parts`);
        parts.forEach((p, idx) => {
          console.log(`[Citations Debug] Part ${idx}:`, {
            type: p?.type,
            keys: Object.keys(p || {}),
            toolName: p?.toolName,
            toolCallId: p?.toolCallId,
            hasResult: !!p?.result,
            hasArgs: !!p?.args,
            state: p?.state,
            // Log the actual part for inspection
            fullPart: p,
          });
        });

        // First check for explicit citations part
        const citationPart = parts.find(
          (part: any) => part?.type === 'citations',
        );
        if (citationPart?.citations) {
          return citationPart?.citations;
        }

        // If no explicit citations, extract from searchWeb tool results
        // Vercel AI SDK uses 'tool-invocation' type with nested toolInvocation object
        const toolInvocationParts = parts.filter(
          (part: any) => part?.type === 'tool-invocation',
        );

        console.log(
          `[Citations Debug] Found ${toolInvocationParts.length} tool invocations`,
        );

        for (const toolPart of toolInvocationParts) {
          // The actual tool data is nested in toolPart.toolInvocation
          const invocation = toolPart?.toolInvocation;

          if (!invocation) {
            console.log('[Citations Debug] No toolInvocation nested object');
            continue;
          }

          const toolName = invocation?.toolName;
          const state = invocation?.state;
          const result = invocation?.result;

          console.log(`[Citations Debug] Tool invocation:`, {
            toolName,
            state,
            hasResults: !!result?.results,
            isArray: Array.isArray(result?.results),
            resultKeys: result ? Object.keys(result) : [],
          });

          // Extract citations from searchWeb tool results (must be in 'result' state)
          if (
            toolName === 'searchWeb' &&
            state === 'result' &&
            result?.results &&
            Array.isArray(result.results)
          ) {
            const citations: CitationReference[] = result.results.map(
              (r: any) => ({
                number: r.position || 0,
                title: r.title || '',
                url: r.url || '',
                snippet: r.snippet || '',
              }),
            );

            console.log('[Citations Debug] ✅ EXTRACTED CITATIONS:', citations);

            if (citations.length > 0) {
              return citations;
            }
          }
        }
      }
    }
    console.log('[Citations Debug] No citations found, returning empty');
    return [];
  }, [messages, propCitations]);

  const citations = extractedCitations;

  console.log('[Citations Debug] Final citations for rendering:', citations);

  const {
    containerRef: messagesContainerRef,
    endRef: messagesEndRef,
    onViewportEnter,
    onViewportLeave,
    hasSentMessage,
  } = useMessages({
    chatId,
    status,
  });

  const { handlePin, handleReply, isPinned } = useMessageActions({
    chatId,
    onStartReply,
  });

  // Memoize the thinking state to avoid infinite loops
  const shouldShowThinking = useMemo(() => {
    if (messages.length === 0) return false;

    // Show thinking if we're actively searching
    if (
      searchProgress?.status === 'searching' ||
      searchProgress?.status === 'processing'
    ) {
      return true;
    }

    // Show thinking if status is submitted
    if (status === 'submitted') {
      return messages[messages.length - 1].role === 'user';
    }

    // Show thinking if status is streaming but last assistant message has no content yet
    if (status === 'streaming') {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === 'user') {
        return true; // No assistant response yet
      }
      if (lastMessage.role === 'assistant') {
        // Check if message has text content
        const textContent = lastMessage.parts
          ?.filter((part) => part.type === 'text')
          .map((part) => part.text)
          .join('')
          .trim();

        return !textContent || textContent.length === 0;
      }
    }

    return false;
  }, [messages, searchProgress?.status, status]);

  // Memoize filtered messages to avoid recalculating on every render
  const filteredMessages = useMemo(() => {
    return messages.filter((message, index) => {
      // Don't render empty assistant messages when we should be showing thinking instead
      if (
        message.role === 'assistant' &&
        index === messages.length - 1 &&
        shouldShowThinking
      ) {
        const textContent = message.parts
          ?.filter((part) => part.type === 'text')
          .map((part) => part.text)
          .join('')
          .trim();

        // If this is an empty assistant message and we should show thinking, don't render it
        return textContent && textContent.length > 0;
      }
      return true;
    });
  }, [messages, shouldShowThinking]);

  // Show loading skeleton when messages are being loaded
  // Don't show skeleton for new chats (when pathname is exactly /chat)
  const isNewChat = pathname === '/chat' && messages.length === 0;
  const isLoading = messages.length === 0 && status === 'ready' && !isNewChat;

  // Debug logging and set global class
  useEffect(() => {
    console.log('Chat mesh debug:', {
      pathname,
      isNewChat,
      hasSentMessage,
      messagesLength: messages.length,
      shouldShowMesh: true,
    });

    // Always enable chat mesh styling for both new and existing chats
    document.body.classList.add('has-chat-mesh');

    return () => {
      document.body.classList.remove('has-chat-mesh');
    };
  }, [pathname]);

  // Detect dashboard mode
  const [dashboardKind, setDashboardKind] = useState<string | null>(null);
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const dash = url.searchParams.get('dashboard');
      setDashboardKind(dash);
    } catch {}
  }, []);

  if (dashboardKind) {
    return (
      <div
        ref={messagesContainerRef}
        className="flex flex-col min-w-0 gap-6 flex-1 overflow-y-scroll pt-4 pb-36 relative bg-transparent"
      >
        <div className="w-full max-w-3xl mx-auto px-4">
          <ComposerDashboard />
        </div>
      </div>
    );
  }

  const isExistingChatView = !(isNewChat && !hasSentMessage);
  const meshClasses = `eos-chat-mesh eos-chat-active${
    isExistingChatView ? ' existing-chat-gradient' : ''
  }`;

  return (
    <div
      ref={messagesContainerRef}
      className={`${meshClasses} flex flex-col min-w-0 gap-6 flex-1 overflow-y-scroll pt-4 pb-36 relative bg-transparent`}
    >
      {/* Spacer (like SwiftUI Spacer()) */}
      <div className="shrink-0 h-2" />
      {isLoading ? (
        <MessageSkeleton count={3} />
      ) : (
        filteredMessages.map((message, index) => (
          <PreviewMessage
            key={message.id}
            chatId={chatId}
            message={message}
            isLoading={
              status === 'streaming' &&
              filteredMessages.length - 1 === index &&
              !shouldShowThinking
            }
            vote={
              votes
                ? votes.find((vote) => vote.messageId === message.id)
                : undefined
            }
            setMessages={setMessages}
            reload={reload}
            isReadonly={isReadonly}
            requiresScrollPadding={
              hasSentMessage && index === filteredMessages.length - 1
            }
            onPin={handlePin}
            onReply={(messageId) => {
              const msg = messages.find((m) => m.id === messageId);
              if (msg) {
                const textContent =
                  msg.parts
                    ?.filter((part) => part.type === 'text')
                    .map((part) => part.text)
                    .join('\n')
                    .trim() || '';

                // Only allow replies to user and assistant messages
                const validRole =
                  msg.role === 'user' || msg.role === 'assistant'
                    ? msg.role
                    : 'assistant';
                handleReply(messageId, textContent, validRole);
              }
            }}
            isPinned={isPinned(message.id)}
            citations={citations}
            searchProgress={searchProgress}
            meetingMetadata={meetingMetadata}
          />
        ))
      )}

      {shouldShowThinking && (
        <ThinkingMessage
          searchProgress={searchProgress}
          chatStatus={
            dataStream?.length &&
            dataStream[dataStream.length - 1]?.type === 'chat-status'
              ? dataStream[dataStream.length - 1]
              : undefined
          }
        />
      )}

      {/* Citations are now shown in the sources button in message actions, not here */}

      <motion.div
        ref={messagesEndRef}
        className="shrink-0 min-w-[24px] min-h-[24px]"
        onViewportLeave={onViewportLeave}
        onViewportEnter={onViewportEnter}
      />
    </div>
  );
}

export const Messages = memo(PureMessages, (prevProps, nextProps) => {
  if (prevProps.isArtifactVisible && nextProps.isArtifactVisible) return true;

  if (prevProps.status !== nextProps.status) return false;
  if (prevProps.status && nextProps.status) return false;
  if (prevProps.messages.length !== nextProps.messages.length) return false;
  if (!equal(prevProps.messages, nextProps.messages)) return false;
  if (!equal(prevProps.votes, nextProps.votes)) return false;
  if (!equal(prevProps.searchProgress, nextProps.searchProgress)) return false;

  return true;
});
