import type { Message } from 'ai';
import { useSWRConfig } from 'swr';
import { useCopyToClipboard } from 'usehooks-ts';

import type { Vote } from '@/lib/db/schema';

import { CopyIcon, ThumbDownIcon, ThumbUpIcon } from './icons';
import { Button } from './ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';
import { memo } from 'react';
import equal from 'fast-deep-equal';
import { toast, toastUtils } from '@/lib/toast-system';
import { Pin, MessageCircle, Share } from 'lucide-react';
import { cn } from '@/lib/utils';
import { copyRichText, processMessageParts } from '@/lib/utils/copy-utils';

export function PureMessageActions({
  chatId,
  message,
  vote,
  isLoading,
  onPin,
  onReply,
  isPinned,
}: {
  chatId: string;
  message: Message;
  vote: Vote | undefined;
  isLoading: boolean;
  onPin?: (messageId: string) => void;
  onReply?: (messageId: string) => void;
  isPinned?: boolean;
}) {
  const { mutate } = useSWRConfig();
  const [_, copyToClipboard] = useCopyToClipboard();

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
          title: 'EOS Chat AI Message',
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

  if (isLoading) return null;

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex flex-row items-center gap-2 opacity-0 group-hover/message:opacity-100 transition-opacity duration-200">
        {/* Show edited indicator if message has been edited */}
        {(message as any).isEdited && (
          <span className="text-xs text-muted-foreground/70 italic">
            (edited)
          </span>
        )}

        <div className="flex flex-row gap-1">
          {/* Enhanced actions for all messages */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                className={cn(
                  'py-1 px-2 h-fit text-muted-foreground hover:bg-eos-orange/10',
                  isPinned && 'text-eos-orange',
                )}
                variant="ghost"
                size="sm"
                onClick={() => onPin?.(message.id)}
              >
                <Pin className={cn('h-3 w-3', isPinned && 'fill-current')} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {isPinned ? 'Unpin message' : 'Pin message'}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                className="py-1 px-2 h-fit text-muted-foreground hover:bg-eos-orange/10"
                variant="ghost"
                size="sm"
                onClick={() => onReply?.(message.id)}
              >
                <MessageCircle className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Reply to message</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                className="py-1 px-2 h-fit text-muted-foreground hover:bg-eos-orange/10"
                variant="ghost"
                size="sm"
                onClick={handleCopy}
              >
                <CopyIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copy message</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                className="py-1 px-2 h-fit text-muted-foreground hover:bg-eos-orange/10"
                variant="ghost"
                size="sm"
                onClick={handleShare}
              >
                <Share className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Share message</TooltipContent>
          </Tooltip>

          {/* Voting actions for assistant messages only */}
          {message.role === 'assistant' && (
            <>
              <div className="w-px h-6 bg-border mx-1" />

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    data-testid="message-upvote"
                    className="py-1 px-2 h-fit text-muted-foreground !pointer-events-auto hover:bg-green-50 hover:text-green-600 dark:hover:bg-green-950 dark:hover:text-green-400"
                    disabled={vote?.isUpvoted}
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      const upvote = fetch('/api/vote', {
                        method: 'PATCH',
                        body: JSON.stringify({
                          chatId,
                          messageId: message.id,
                          type: 'up',
                        }),
                      });

                      toast.promise(upvote, {
                        loading: 'Upvoting Response...',
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
                                  isUpvoted: true,
                                },
                              ];
                            },
                            { revalidate: false },
                          );

                          return 'Upvoted Response!';
                        },
                        error: 'Failed to upvote response.',
                      });
                    }}
                  >
                    <ThumbUpIcon />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Upvote Response</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    data-testid="message-downvote"
                    className="py-1 px-2 h-fit text-muted-foreground !pointer-events-auto hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 dark:hover:text-red-400"
                    variant="ghost"
                    size="sm"
                    disabled={vote && !vote.isUpvoted}
                    onClick={async () => {
                      const downvote = fetch('/api/vote', {
                        method: 'PATCH',
                        body: JSON.stringify({
                          chatId,
                          messageId: message.id,
                          type: 'down',
                        }),
                      });

                      toast.promise(downvote, {
                        loading: 'Downvoting Response...',
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
                                  isUpvoted: false,
                                },
                              ];
                            },
                            { revalidate: false },
                          );

                          return 'Downvoted Response!';
                        },
                        error: 'Failed to downvote response.',
                      });
                    }}
                  >
                    <ThumbDownIcon />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Downvote Response</TooltipContent>
              </Tooltip>
            </>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}

export const MessageActions = memo(
  PureMessageActions,
  (prevProps, nextProps) => {
    if (!equal(prevProps.vote, nextProps.vote)) return false;
    if (prevProps.isLoading !== nextProps.isLoading) return false;
    if (prevProps.onPin !== nextProps.onPin) return false;
    if (prevProps.onReply !== nextProps.onReply) return false;
    if (prevProps.isPinned !== nextProps.isPinned) return false;

    return true;
  },
);
