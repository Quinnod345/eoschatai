import type { UIMessage } from 'ai';
import { PreviewMessage, ThinkingMessage } from './message';
import { memo } from 'react';
import type { Vote } from '@/lib/db/schema';
import equal from 'fast-deep-equal';
import type { UseChatHelpers } from '@ai-sdk/react';
import { motion } from 'framer-motion';
import { useMessages } from '@/hooks/use-messages';
import { useMessageActions } from '@/hooks/use-message-actions';
import type { SearchProgress } from '@/hooks/use-web-search-progress';

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
}: MessagesProps) {
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

  const { handlePin, handleReply, isPinned } = useMessageActions({ chatId });

  return (
    <div
      ref={messagesContainerRef}
      className="flex flex-col min-w-0 gap-6 flex-1 overflow-y-scroll pt-4 pb-36 relative bg-transparent"
    >
      {messages.map((message, index) => (
        <PreviewMessage
          key={message.id}
          chatId={chatId}
          message={message}
          isLoading={status === 'streaming' && messages.length - 1 === index}
          vote={
            votes
              ? votes.find((vote) => vote.messageId === message.id)
              : undefined
          }
          setMessages={setMessages}
          reload={reload}
          isReadonly={isReadonly}
          requiresScrollPadding={
            hasSentMessage && index === messages.length - 1
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
              handleReply(messageId, textContent);
            }
          }}
          isPinned={isPinned(message.id)}
          citations={citations}
        />
      ))}

      {(status === 'submitted' || status === 'streaming') &&
        messages.length > 0 &&
        messages[messages.length - 1].role === 'user' && (
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
