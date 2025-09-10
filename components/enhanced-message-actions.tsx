import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Pin, MessageCircle, Copy, Share, Bookmark } from 'lucide-react';
import { toast } from '@/lib/toast-system';

interface MessageActionsProps {
  messageId: string;
  content: string;
  onPin?: (messageId: string) => void;
  onReply?: (messageId: string) => void;
  onBookmark?: (messageId: string) => void;
}

export function MessageActions({
  messageId,
  content,
  onPin,
  onReply,
  onBookmark,
}: MessageActionsProps) {
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      toast.success('Message copied to clipboard');
    } catch (error) {
      toast.error('Failed to copy message');
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator
        .share({
          title: 'EOS Chat AI Message',
          text: content,
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

  return (
    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 hover:bg-eos-orange/10"
            onClick={() => onPin?.(messageId)}
          >
            <Pin className="h-3 w-3" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Pin message</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 hover:bg-eos-orange/10"
            onClick={() => onReply?.(messageId)}
          >
            <MessageCircle className="h-3 w-3" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Reply to message</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 hover:bg-eos-orange/10"
            onClick={handleCopy}
          >
            <Copy className="h-3 w-3" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Copy message</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 hover:bg-eos-orange/10"
            onClick={() => onBookmark?.(messageId)}
          >
            <Bookmark className="h-3 w-3" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Bookmark message</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 hover:bg-eos-orange/10"
            onClick={handleShare}
          >
            <Share className="h-3 w-3" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Share message</TooltipContent>
      </Tooltip>
    </div>
  );
}
