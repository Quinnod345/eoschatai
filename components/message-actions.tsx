import type { Message } from 'ai';
import { useSWRConfig } from 'swr';
import { useCopyToClipboard } from 'usehooks-ts';
import { useState } from 'react';

import type { Vote } from '@/lib/db/schema';

import { CopyIcon, ThumbDownIcon, ThumbUpIcon, PencilEditIcon } from './icons';
import { Button } from './ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';
import { memo } from 'react';
import { motion } from 'framer-motion';
import equal from 'fast-deep-equal';
import { toast, toastUtils } from '@/lib/toast-system';
import { Pin, MessageCircle, Share, RefreshCw, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { copyRichText, processMessageParts } from '@/lib/utils/copy-utils';
import { FeedbackModal } from './feedback-modal';
import { SourcesDialog } from './sources-dialog';

interface CitationReference {
  number: number;
  title: string;
  url: string;
  snippet?: string;
}

export function PureMessageActions({
  chatId,
  message,
  vote,
  isLoading,
  onPin,
  onReply,
  isPinned,
  onEdit,
  onRetry,
  citations,
}: {
  chatId: string;
  message: Message;
  vote: Vote | undefined;
  isLoading: boolean;
  onPin?: (messageId: string) => void;
  onReply?: (messageId: string) => void;
  isPinned?: boolean;
  onEdit?: () => void;
  onRetry?: () => void;
  citations?: CitationReference[];
}) {
  const { mutate } = useSWRConfig();
  const [_, copyToClipboard] = useCopyToClipboard();
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [sourcesDialogOpen, setSourcesDialogOpen] = useState(false);
  const [pendingVoteType, setPendingVoteType] = useState<'up' | 'down' | null>(
    null,
  );

  // Check if this message has citations
  const hasCitations = citations && citations.length > 0;

  const handleCopy = async () => {
    // Process message parts to get clean text with formatted mentions
    const textFromParts = processMessageParts(message.parts);

    if (!textFromParts) {
      toastUtils.copyError();
      return;
    }

    try {
      // Try to copy as rich text (HTML)
      await copyRichText(textFromParts);
      toastUtils.copySuccess();
    } catch (error) {
      // Fallback to plain text copy
      await copyToClipboard(textFromParts);
      toastUtils.copySuccess();
    }
  };

  const handleShare = () => {
    // Process message parts to get clean text with formatted mentions
    const textFromParts = processMessageParts(message.parts);

    if (navigator.share && textFromParts) {
      navigator
        .share({
          title: 'EOSAI Message',
          text: textFromParts,
        })
        .catch(() => {
          // Fallback to copy
          handleCopy();
        });
    } else {
      // Fallback to copy
      handleCopy();
    }
  };

  const handleFeedbackSubmit = async (feedback: {
    category?: string;
    description?: string;
  }) => {
    if (!pendingVoteType) return;

    // First submit the vote
    const votePromise = fetch('/api/vote', {
      method: 'PATCH',
      body: JSON.stringify({
        chatId,
        messageId: message.id,
        type: pendingVoteType,
      }),
    });

    // Then submit the feedback
    const feedbackPromise = fetch('/api/feedback', {
      method: 'POST',
      body: JSON.stringify({
        chatId,
        messageId: message.id,
        type: pendingVoteType,
        category: feedback.category,
        description: feedback.description,
      }),
    });

    // Handle both promises
    toast.promise(Promise.all([votePromise, feedbackPromise]), {
      loading:
        pendingVoteType === 'up'
          ? 'Upvoting Response...'
          : 'Downvoting Response...',
      success: () => {
        mutate<Array<Vote>>(
          `/api/vote?chatId=${chatId}`,
          (currentVotes) => {
            if (!currentVotes) return [];

            const votesWithoutCurrent = currentVotes.filter(
              (vote) => vote.messageId !== message.id,
            );

            return [
              ...votesWithoutCurrent,
              {
                chatId,
                messageId: message.id,
                isUpvoted: pendingVoteType === 'up',
              },
            ];
          },
          { revalidate: false },
        );

        return pendingVoteType === 'up'
          ? 'Upvoted Response!'
          : 'Downvoted Response!';
      },
      error:
        pendingVoteType === 'up'
          ? 'Failed to upvote response.'
          : 'Failed to downvote response.',
    });

    setFeedbackModalOpen(false);
    setPendingVoteType(null);
  };

  if (isLoading) return null;

  return (
    <>
      <TooltipProvider delayDuration={0}>
        <div
          className={cn(
            'flex flex-row items-center gap-2',
            // Show actions only on hover for user messages
            message.role === 'user' &&
              'opacity-0 transition-opacity group-hover:opacity-100 group-hover/message:opacity-100',
          )}
        >
          {/* Show edited indicator if message has been edited */}
          {(message as any).isEdited && (
            <span className="text-xs text-muted-foreground/70 italic">
              (edited)
            </span>
          )}

          <div className="flex flex-row gap-1">
            {/* Sources button - only show for assistant messages with citations */}
            {message.role === 'assistant' && hasCitations && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <motion.div
                    whileHover={{ scale: 1.03, y: -1 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    <Button
                      className="py-1 px-2 h-fit text-muted-foreground hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950 dark:hover:text-blue-400"
                      variant="ghost"
                      size="sm"
                      onClick={() => setSourcesDialogOpen(true)}
                    >
                      <FileText className="h-3 w-3" />
                      <span className="text-xs ml-1 font-medium">
                        {citations.length}
                      </span>
                    </Button>
                  </motion.div>
                </TooltipTrigger>
                <TooltipContent>
                  View {citations.length} source
                  {citations.length !== 1 ? 's' : ''}
                </TooltipContent>
              </Tooltip>
            )}

            {/* Enhanced actions for all messages */}
            <Tooltip>
              <TooltipTrigger asChild>
                <motion.div
                  whileHover={{ scale: 1.03, y: -1 }}
                  whileTap={{ scale: 0.97 }}
                >
                  <Button
                    className={cn(
                      'py-1 px-2 h-fit text-muted-foreground hover:bg-eos-orange/10',
                      isPinned && 'text-eos-orange',
                    )}
                    variant="ghost"
                    size="sm"
                    onClick={() => onPin?.(message.id)}
                  >
                    <Pin
                      className={cn('h-3 w-3', isPinned && 'fill-current')}
                    />
                  </Button>
                </motion.div>
              </TooltipTrigger>
              <TooltipContent>
                {isPinned ? 'Unpin message' : 'Pin message'}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <motion.div
                  whileHover={{ scale: 1.03, y: -1 }}
                  whileTap={{ scale: 0.97 }}
                >
                  <Button
                    className="py-1 px-2 h-fit text-muted-foreground hover:bg-eos-orange/10"
                    variant="ghost"
                    size="sm"
                    onClick={() => onReply?.(message.id)}
                  >
                    <MessageCircle className="h-3 w-3" />
                  </Button>
                </motion.div>
              </TooltipTrigger>
              <TooltipContent>Reply to message</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <motion.div
                  whileHover={{ scale: 1.03, y: -1 }}
                  whileTap={{ scale: 0.97 }}
                >
                  <Button
                    className="py-1 px-2 h-fit text-muted-foreground hover:bg-eos-orange/10"
                    variant="ghost"
                    size="sm"
                    onClick={handleCopy}
                  >
                    <CopyIcon />
                  </Button>
                </motion.div>
              </TooltipTrigger>
              <TooltipContent>Copy message</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <motion.div
                  whileHover={{ scale: 1.03, y: -1 }}
                  whileTap={{ scale: 0.97 }}
                >
                  <Button
                    className="py-1 px-2 h-fit text-muted-foreground hover:bg-eos-orange/10"
                    variant="ghost"
                    size="sm"
                    onClick={handleShare}
                  >
                    <Share className="h-3 w-3" />
                  </Button>
                </motion.div>
              </TooltipTrigger>
              <TooltipContent>Share message</TooltipContent>
            </Tooltip>

            {/* Edit action for user messages */}
            {message.role === 'user' && onEdit && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <motion.div
                    whileHover={{ scale: 1.03, y: -1 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    <Button
                      className="py-1 px-2 h-fit text-muted-foreground hover:bg-eos-orange/10"
                      variant="ghost"
                      size="sm"
                      onClick={onEdit}
                    >
                      <PencilEditIcon />
                    </Button>
                  </motion.div>
                </TooltipTrigger>
                <TooltipContent>Edit message</TooltipContent>
              </Tooltip>
            )}

            {/* Voting and retry actions for assistant messages only */}
            {message.role === 'assistant' && (
              <div className="flex items-center opacity-0 group-hover/message:opacity-100 transition-opacity duration-200">
                <div className="w-px h-6 bg-border mx-1" />

                <Tooltip>
                  <TooltipTrigger asChild>
                    <motion.div
                      whileHover={{ scale: 1.03, y: -1 }}
                      whileTap={{ scale: 0.97 }}
                    >
                      <Button
                        data-testid="message-upvote"
                        className="py-1 px-2 h-fit text-muted-foreground !pointer-events-auto hover:bg-green-50 hover:text-green-600 dark:hover:bg-green-950 dark:hover:text-green-400"
                        disabled={vote?.isUpvoted}
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setPendingVoteType('up');
                          setFeedbackModalOpen(true);
                        }}
                      >
                        <ThumbUpIcon />
                      </Button>
                    </motion.div>
                  </TooltipTrigger>
                  <TooltipContent>Upvote Response</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <motion.div
                      whileHover={{ scale: 1.03, y: -1 }}
                      whileTap={{ scale: 0.97 }}
                    >
                      <Button
                        data-testid="message-downvote"
                        className="py-1 px-2 h-fit text-muted-foreground !pointer-events-auto hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 dark:hover:text-red-400"
                        variant="ghost"
                        size="sm"
                        disabled={vote && !vote.isUpvoted}
                        onClick={() => {
                          setPendingVoteType('down');
                          setFeedbackModalOpen(true);
                        }}
                      >
                        <ThumbDownIcon />
                      </Button>
                    </motion.div>
                  </TooltipTrigger>
                  <TooltipContent>Downvote Response</TooltipContent>
                </Tooltip>

                {/* Retry action for assistant messages */}
                {onRetry && (
                  <>
                    <div className="w-px h-6 bg-border mx-1" />
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <motion.div
                          whileHover={{ scale: 1.03, y: -1 }}
                          whileTap={{ scale: 0.97 }}
                        >
                          <Button
                            className="py-1 px-2 h-fit text-muted-foreground hover:bg-eos-orange/10"
                            variant="ghost"
                            size="sm"
                            onClick={onRetry}
                          >
                            <RefreshCw className="h-3 w-3" />
                          </Button>
                        </motion.div>
                      </TooltipTrigger>
                      <TooltipContent>Retry generation</TooltipContent>
                    </Tooltip>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </TooltipProvider>

      {pendingVoteType && (
        <FeedbackModal
          isOpen={feedbackModalOpen}
          onClose={() => {
            setFeedbackModalOpen(false);
            setPendingVoteType(null);
          }}
          messageId={message.id}
          chatId={chatId}
          voteType={pendingVoteType}
          onSubmit={handleFeedbackSubmit}
        />
      )}

      {/* Sources dialog */}
      {hasCitations && (
        <SourcesDialog
          open={sourcesDialogOpen}
          onOpenChange={setSourcesDialogOpen}
          citations={citations}
        />
      )}
    </>
  );
}

export const MessageActions = memo(
  PureMessageActions,
  (prevProps, nextProps) => {
    if (!equal(prevProps.vote, nextProps.vote)) return false;
    if (prevProps.isLoading !== nextProps.isLoading) return false;
    if (prevProps.isPinned !== nextProps.isPinned) return false;
    if (prevProps.message.id !== nextProps.message.id) return false;
    // Don't compare function references as they may change
    // if (prevProps.onPin !== nextProps.onPin) return false;
    // if (prevProps.onReply !== nextProps.onReply) return false;

    return true;
  },
);
