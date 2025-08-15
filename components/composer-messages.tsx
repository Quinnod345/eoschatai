import { PreviewMessage, ThinkingMessage } from './message';
import type { Vote } from '@/lib/db/schema';
import type { UIMessage } from 'ai';
import { memo } from 'react';
import equal from 'fast-deep-equal';
import type { UIComposer } from './composer';
import type { UseChatHelpers } from '@ai-sdk/react';
import { motion } from 'framer-motion';
import { useMessages } from '@/hooks/use-messages';
import { useMessageActions } from '@/hooks/use-message-actions';

interface ComposerMessagesProps {
  chatId: string;
  status: UseChatHelpers['status'];
  votes: Array<Vote> | undefined;
  messages: Array<UIMessage>;
  setMessages: UseChatHelpers['setMessages'];
  reload: UseChatHelpers['reload'];
  isReadonly: boolean;
  composerStatus: UIComposer['status'];
  onStartReply?: (
    messageId: string,
    content: string,
    role: 'user' | 'assistant',
  ) => void;
}

function PureComposerMessages({
  chatId,
  status,
  votes,
  messages,
  setMessages,
  reload,
  isReadonly,
  onStartReply,
}: ComposerMessagesProps) {
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

  return (
    <div
      ref={messagesContainerRef}
      className="flex flex-col gap-4 h-full items-center overflow-y-scroll px-6 pt-20 pb-4 w-full"
    >
      {messages.map((message, index) => (
        <PreviewMessage
          chatId={chatId}
          key={message.id}
          message={message}
          isLoading={status === 'streaming' && index === messages.length - 1}
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

              // Only allow replies to user and assistant messages
              const validRole =
                msg.role === 'user' || msg.role === 'assistant'
                  ? msg.role
                  : 'assistant';
              handleReply(messageId, textContent, validRole);
            }
          }}
          isPinned={isPinned(message.id)}
        />
      ))}

      {status === 'submitted' &&
        messages.length > 0 &&
        messages[messages.length - 1].role === 'user' && <ThinkingMessage />}

      <motion.div
        ref={messagesEndRef}
        className="shrink-0 min-w-[24px] min-h-[24px]"
        onViewportLeave={onViewportLeave}
        onViewportEnter={onViewportEnter}
      />
    </div>
  );
}

function areEqual(
  prevProps: ComposerMessagesProps,
  nextProps: ComposerMessagesProps,
) {
  if (
    prevProps.composerStatus === 'streaming' &&
    nextProps.composerStatus === 'streaming'
  )
    return true;

  if (prevProps.status !== nextProps.status) return false;
  if (prevProps.status && nextProps.status) return false;
  if (prevProps.messages.length !== nextProps.messages.length) return false;
  if (!equal(prevProps.votes, nextProps.votes)) return false;

  return true;
}

export const ComposerMessages = memo(PureComposerMessages, areEqual);
