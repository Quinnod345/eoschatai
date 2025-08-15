import type { Chat } from '@/lib/db/schema';
import { SidebarMenuButton, SidebarMenuItem } from './ui/sidebar';
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
import { memo, useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useChatVisibility } from '@/hooks/use-chat-visibility';
import { cn } from '@/lib/utils';
import { getDisplayTitle } from '@/lib/utils/chat-utils';
import { Pin, Bookmark } from 'lucide-react';
import { toast } from 'sonner';
import { useChatPreloader } from '@/hooks/use-chat-preloader';
import { useLoading } from '@/hooks/use-loading';

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
  const { preloadChat } = useChatPreloader();
  const preloadTimeoutRef = useRef<NodeJS.Timeout>();

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

  // Preload chat on hover
  const handleMouseEnter = () => {
    // Delay preloading by 200ms to avoid unnecessary preloads
    preloadTimeoutRef.current = setTimeout(() => {
      preloadChat(chat.id);
    }, 200);
  };

  const handleMouseLeave = () => {
    if (preloadTimeoutRef.current) {
      clearTimeout(preloadTimeoutRef.current);
    }
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (preloadTimeoutRef.current) {
        clearTimeout(preloadTimeoutRef.current);
      }
    };
  }, []);

  return (
    <SidebarMenuItem className="py-1 px-1 group/item relative">
      <motion.div
        className="w-full rounded-md"
        whileHover={{ y: -1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      >
        <SidebarMenuButton
          asChild
          isActive={isActive}
          size="lg"
          className={cn(
            'rounded-lg !h-11 py-3 px-3 text-[14px] leading-6 font-normal transition-all duration-200 mr-0 text-sidebar-foreground/90',
            isActive
              ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm'
              : 'hover:bg-sidebar-accent/60 hover:text-sidebar-foreground hover:shadow-sm',
          )}
        >
          <Link
            href={`/chat/${chat.id}`}
            onClick={() => {
              setOpenMobile(false);
              const { setLoading } = useLoading.getState();
              setLoading(true, 'Loading chat...', 'chat');
            }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className="relative flex items-center w-full"
          >
            {/* Title area - expands fully by default; on hover/active, add padding to avoid the right overlay */}
            <div
              className={cn(
                'min-w-0 flex-1 pr-0 transition-[padding] duration-150',
                // Pull back even less
                isActive && ((pinnedCount ?? 0) > 0 || isBookmarked) && 'pr-7',
                isActive && !((pinnedCount ?? 0) > 0 || isBookmarked) && 'pr-6',
                (pinnedCount ?? 0) > 0 || isBookmarked
                  ? 'group-hover/item:pr-7'
                  : 'group-hover/item:pr-6',
              )}
            >
              <span className="truncate block min-w-0 text-[14px] font-normal">
                {getDisplayTitle(chat.title)}
              </span>
            </div>

            {/* Right overlay: indicators (always visible) + three dots (hover/active) */}
            <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {pinnedCount && pinnedCount > 0 && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground/80">
                  <Pin className="h-4 w-4 text-eos-orange" />
                  {pinnedCount > 1 && (
                    <span className="text-eos-orange font-medium">
                      {pinnedCount}
                    </span>
                  )}
                </div>
              )}
              {isBookmarked && (
                <Bookmark className="h-4 w-4 text-blue-500 fill-current" />
              )}

              <DropdownMenu modal={true}>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    className={cn(
                      'pointer-events-auto inline-flex p-1.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
                      isActive
                        ? 'text-white dark:text-blue-400'
                        : 'group-hover/item:text-white dark:group-hover/item:text-blue-400',
                      'opacity-0 transition-opacity duration-150 group-hover/item:opacity-100 data-[state=open]:opacity-100',
                      'transition-none transform-none hover:transform-none active:transform-none hover:scale-100 hover:translate-y-0 hover:shadow-none active:scale-100 active:translate-y-0',
                      isActive && 'opacity-100',
                    )}
                    aria-label="More options"
                  >
                    <MoreHorizontalIcon />
                  </button>
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
                    <span>
                      {isBookmarked ? 'Remove Bookmark' : 'Bookmark Chat'}
                    </span>
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
                          {visibilityType === 'public' ? (
                            <CheckCircleFillIcon />
                          ) : null}
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
            </div>
          </Link>
        </SidebarMenuButton>
      </motion.div>
    </SidebarMenuItem>
  );
};

export const ChatItem = memo(PureChatItem, (prevProps, nextProps) => {
  if (prevProps.isActive !== nextProps.isActive) return false;
  if (prevProps.pinnedCount !== nextProps.pinnedCount) return false;
  if (prevProps.bookmarkedCount !== nextProps.bookmarkedCount) return false;
  return true;
});
