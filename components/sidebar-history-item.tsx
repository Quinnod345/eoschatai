import type { Chat } from '@/lib/db/schema';
import {
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from './ui/sidebar';
import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from './ui/dropdown-menu';
import {
  CheckCircleFillIcon,
  GlobeIcon,
  LockIcon,
  MoreHorizontalIcon,
  ShareIcon,
  TrashIcon,
} from './icons';
import { memo, useState, useEffect } from 'react';
import { useChatVisibility } from '@/hooks/use-chat-visibility';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { getDisplayTitle } from '@/lib/utils/chat-utils';
import { Pin, Bookmark } from 'lucide-react';
import { toast } from 'sonner';

const PureChatItem = ({
  chat,
  isActive,
  onDelete,
  setOpenMobile,
  pinnedCount,
  bookmarkedCount,
}: {
  chat: Chat;
  isActive: boolean;
  onDelete: (chatId: string) => void;
  setOpenMobile: (open: boolean) => void;
  pinnedCount?: number;
  bookmarkedCount?: number;
}) => {
  const { visibilityType, setVisibilityType } = useChatVisibility({
    chatId: chat.id,
    initialVisibilityType: chat.visibility,
  });

  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isBookmarkLoading, setIsBookmarkLoading] = useState(false);

  // Set initial bookmark state
  useEffect(() => {
    setIsBookmarked(!!bookmarkedCount && bookmarkedCount > 0);
  }, [bookmarkedCount]);

  // Listen for bookmark updates
  useEffect(() => {
    const handleBookmarkUpdate = (event: CustomEvent) => {
      const { type, data } = event.detail;
      if (type === 'bookmark' && data.chatId === chat.id) {
        setIsBookmarked(data.bookmarked);
      }
    };

    window.addEventListener(
      'messageActionUpdate',
      handleBookmarkUpdate as EventListener,
    );
    return () => {
      window.removeEventListener(
        'messageActionUpdate',
        handleBookmarkUpdate as EventListener,
      );
    };
  }, [chat.id]);

  const handleBookmarkToggle = async () => {
    if (isBookmarkLoading) return;

    setIsBookmarkLoading(true);
    try {
      const response = await fetch('/api/bookmark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: chat.id }),
      });

      const data = await response.json();

      if (response.ok) {
        setIsBookmarked(data.bookmarked);
        toast.success(data.bookmarked ? 'Chat bookmarked' : 'Bookmark removed');

        // Emit event for other components
        window.dispatchEvent(
          new CustomEvent('messageActionUpdate', {
            detail: {
              type: 'bookmark',
              data: { bookmarked: data.bookmarked, chatId: chat.id },
            },
          }),
        );
      } else {
        toast.error('Failed to update bookmark');
      }
    } catch (error) {
      toast.error('Failed to update bookmark');
      console.error('Error toggling bookmark:', error);
    } finally {
      setIsBookmarkLoading(false);
    }
  };

  return (
    <SidebarMenuItem className="py-1 px-1">
      <motion.div
        whileHover={{
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
          transition: { duration: 0.2, ease: 'easeOut' },
        }}
        whileTap={{
          scale: 0.98,
          transition: { duration: 0.1, ease: 'easeOut' },
        }}
        className="w-full rounded-md"
      >
        <SidebarMenuButton
          asChild
          isActive={isActive}
          className={cn(
            'rounded-md py-2 px-2 font-medium transition-all duration-200 mr-0 !pr-5',
            isActive
              ? 'bg-primary/15 text-primary shadow-sm'
              : 'hover:bg-sidebar-accent/70 hover:shadow-sm',
          )}
        >
          <Link
            href={`/chat/${chat.id}`}
            onClick={() => setOpenMobile(false)}
            className="flex items-center justify-between w-full"
          >
            <span className="truncate flex-1 pr-1">
              {getDisplayTitle(chat.title)}
            </span>
            <div className="flex items-center gap-0.5 ml-0.5 flex-shrink-0">
              {pinnedCount && pinnedCount > 0 && (
                <div className="flex items-center gap-0.5 text-xs">
                  <Pin className="h-3 w-3 text-eos-orange" />
                  {pinnedCount > 1 && (
                    <span className="text-eos-orange font-medium">
                      {pinnedCount}
                    </span>
                  )}
                </div>
              )}
              {isBookmarked && (
                <Bookmark className="h-3 w-3 text-blue-500 fill-current" />
              )}
            </div>
          </Link>
        </SidebarMenuButton>
      </motion.div>

      <DropdownMenu modal={true}>
        <DropdownMenuTrigger asChild>
          <SidebarMenuAction
            className={cn(
              'data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground !right-0.5 mr-0 -ml-1 transition-all duration-200 hover:bg-sidebar-accent/50',
              isActive && 'text-primary',
            )}
            showOnHover={!isActive}
          >
            <MoreHorizontalIcon />
            <span className="sr-only">More</span>
          </SidebarMenuAction>
        </DropdownMenuTrigger>

        <DropdownMenuContent side="bottom" align="end" className="w-48">
          <DropdownMenuItem
            className="cursor-pointer"
            onClick={handleBookmarkToggle}
            disabled={isBookmarkLoading}
          >
            <Bookmark
              className={cn('h-4 w-4', isBookmarked && 'fill-current')}
            />
            <span>{isBookmarked ? 'Remove Bookmark' : 'Bookmark Chat'}</span>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="cursor-pointer">
              <ShareIcon size={16} />
              <span>Share</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent>
                <DropdownMenuItem
                  className="cursor-pointer flex-row justify-between"
                  onClick={() => {
                    setVisibilityType('private');
                  }}
                >
                  <div className="flex flex-row gap-2 items-center">
                    <LockIcon size={12} />
                    <span>Private</span>
                  </div>
                  {visibilityType === 'private' ? (
                    <CheckCircleFillIcon />
                  ) : null}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer flex-row justify-between"
                  onClick={() => {
                    setVisibilityType('public');
                  }}
                >
                  <div className="flex flex-row gap-2 items-center">
                    <GlobeIcon />
                    <span>Public</span>
                  </div>
                  {visibilityType === 'public' ? <CheckCircleFillIcon /> : null}
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            className="cursor-pointer text-destructive focus:bg-destructive/15 focus:text-destructive dark:text-red-500"
            onSelect={() => onDelete(chat.id)}
          >
            <TrashIcon size={16} />
            <span>Delete</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  );
};

export const ChatItem = memo(PureChatItem, (prevProps, nextProps) => {
  if (prevProps.isActive !== nextProps.isActive) return false;
  if (prevProps.pinnedCount !== nextProps.pinnedCount) return false;
  if (prevProps.bookmarkedCount !== nextProps.bookmarkedCount) return false;
  return true;
});
