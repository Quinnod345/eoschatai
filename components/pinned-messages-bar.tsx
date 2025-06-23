import { useState } from 'react';
import { Pin, X, ChevronDown, ChevronUp, Copy } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';
import type { PinnedMessage } from '@/lib/db/schema';
import type { UIMessage } from 'ai';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';

interface PinnedMessagesBarProps {
  pinnedMessages: PinnedMessage[];
  messages: UIMessage[];
  onUnpin: (messageId: string) => void;
  onScrollToMessage: (messageId: string) => void;
}

export function PinnedMessagesBar({
  pinnedMessages,
  messages,
  onUnpin,
  onScrollToMessage,
}: PinnedMessagesBarProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (pinnedMessages.length === 0) return null;

  // Get the actual message content for pinned messages
  const pinnedWithContent = pinnedMessages
    .map((pinned) => {
      const message = messages.find((m) => m.id === pinned.messageId);
      if (!message) return null;

      const textContent =
        message.parts
          ?.filter((part) => part.type === 'text')
          .map((part) => part.text)
          .join(' ')
          .trim() || '';

      return {
        ...pinned,
        content: textContent,
        role: message.role,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  if (pinnedWithContent.length === 0) return null;

  const handleCopyMessage = (content: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(content);
    toast.success('Message copied to clipboard');
  };

  return (
    <>
      <div className="flex sticky top-[57px] z-30 items-center gap-2 px-2 md:px-2 py-1.5 bg-background border-b">
        <div className="flex items-center gap-2 flex-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-eos-orange/10 border border-eos-orange/20 cursor-pointer hover:bg-eos-orange/20 transition-colors">
                <Pin className="h-4 w-4 text-eos-orange" />
                <span className="text-sm font-medium text-eos-orange">
                  {pinnedWithContent.length}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              {pinnedWithContent.length} pinned message
              {pinnedWithContent.length > 1 ? 's' : ''}
            </TooltipContent>
          </Tooltip>

          {!isExpanded && pinnedWithContent.length > 0 && (
            <div className="hidden sm:flex items-center gap-2 flex-1 min-w-0">
              <div className="flex items-center gap-1 text-xs text-muted-foreground truncate">
                <span className="font-medium">Latest:</span>
                <span className="truncate max-w-[300px]">
                  {pinnedWithContent[0]?.content}
                </span>
              </div>
            </div>
          )}
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? (
            <>
              <ChevronUp className="h-4 w-4" />
              <span className="ml-1 hidden sm:inline">Hide</span>
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4" />
              <span className="ml-1 hidden sm:inline">Show</span>
            </>
          )}
        </Button>
      </div>

      {isExpanded && (
        <PinnedMessagesBarExpanded
          pinnedWithContent={pinnedWithContent}
          onScrollToMessage={onScrollToMessage}
          onUnpin={onUnpin}
          handleCopyMessage={handleCopyMessage}
        />
      )}
    </>
  );
}

interface PinnedWithContent extends PinnedMessage {
  content: string;
  role: 'user' | 'assistant' | 'system' | 'data';
}

export function PinnedMessagesBarExpanded({
  pinnedWithContent,
  onScrollToMessage,
  onUnpin,
  handleCopyMessage,
}: {
  pinnedWithContent: PinnedWithContent[];
  onScrollToMessage: (messageId: string) => void;
  onUnpin: (messageId: string) => void;
  handleCopyMessage: (content: string, e: React.MouseEvent) => void;
}) {
  return (
    <div className="px-2 md:px-2 pb-2 bg-background border-b">
      <div className="space-y-2">
        {pinnedWithContent.map((pinned) => (
          <div
            key={pinned.id}
            className="group flex items-start gap-2 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors"
            onClick={() => onScrollToMessage(pinned.messageId)}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={cn(
                    'text-xs font-medium',
                    pinned.role === 'user'
                      ? 'text-primary'
                      : 'text-muted-foreground',
                  )}
                >
                  {pinned.role === 'user' ? 'You' : 'Assistant'}
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(pinned.pinnedAt).toLocaleString()}
                </span>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-3">
                {pinned.content}
              </p>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={(e) => handleCopyMessage(pinned.content, e)}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Copy message</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      onUnpin(pinned.messageId);
                    }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Unpin message</TooltipContent>
              </Tooltip>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
