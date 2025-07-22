import type { UIMessage } from 'ai';
import { PreviewMessage, ThinkingMessage } from './message';
import { memo, useMemo } from 'react';
import type { Vote } from '@/lib/db/schema';
import equal from 'fast-deep-equal';
import type { UseChatHelpers } from '@ai-sdk/react';
import { motion } from 'framer-motion';
import { useMessages } from '@/hooks/use-messages';
import { useMessageActions } from '@/hooks/use-message-actions';
import type { SearchProgress } from '@/hooks/use-web-search-progress';
import { MessageSkeleton } from './message-skeleton';
import { usePathname } from 'next/navigation';

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
  isArtifactVisible: boolean;
  citations?: CitationReference[];
  searchProgress?: SearchProgress;
  meetingMetadata?: any;
  onStartReply?: (
    messageId: string,
    content: string,
    role: 'user' | 'assistant',
  ) => void;
}

function PureMessages({
  chatId,
  status,
  votes,
  messages,
  setMessages,
  reload,
  isReadonly,
  citations,
  searchProgress,
  meetingMetadata,
  onStartReply,
}: MessagesProps) {
  const pathname = usePathname();
  
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
  const isNewChat = pathname === '/chat';
  const isLoading = messages.length === 0 && status === 'ready' && !isNewChat;

  return (
    <div
      ref={messagesContainerRef}
      className="flex flex-col min-w-0 gap-6 flex-1 overflow-y-scroll pt-4 pb-36 relative bg-transparent"
    >
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
        <ThinkingMessage searchProgress={searchProgress} />
      )}

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
