'use client';

import type { User } from 'next-auth';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useLoading } from '@/hooks/use-loading';
import { mutate as swrMutate } from 'swr';
import { useTheme } from 'next-themes';

import {
  PlusIcon,
  FileTextIcon,
  ImageIcon,
  CodeIcon,
  TargetIcon,
} from '@/components/icons';
import { FileSpreadsheet, Users2, Mic } from 'lucide-react';
import { SidebarHistory } from '@/components/sidebar-history';
import { SidebarToggle } from './sidebar-toggle';
import { Button } from '@/components/ui/button';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  useSidebar,
} from '@/components/ui/sidebar';
import { AdvancedSearch } from '@/components/advanced-search';
import { SidebarUserNav } from './sidebar-user-nav';

// Composer menu items
const composerItems = [
  {
    kind: 'text',
    label: 'Documents',
    icon: FileTextIcon,
    tooltip: 'Create documents',
  },
  {
    kind: 'sheet',
    label: 'Spreadsheets',
    icon: FileSpreadsheet,
    tooltip: 'Create spreadsheets',
  },
  {
    kind: 'image',
    label: 'Images',
    icon: ImageIcon,
    tooltip: 'Generate images',
  },
  {
    kind: 'code',
    label: 'Code',
    icon: CodeIcon,
    tooltip: 'Write and run code',
  },
  {
    kind: 'vto',
    label: "VTO's",
    icon: TargetIcon,
    tooltip: 'Vision/Traction Organizer',
  },
  {
    kind: 'accountability',
    label: 'A/C',
    icon: Users2,
    tooltip: 'Accountability Charts',
  },
  {
    kind: 'recordings',
    label: 'Recordings',
    icon: Mic,
    tooltip: 'Manage voice recordings',
  },
] as const;

export function AppSidebar({ user }: { user: User | undefined }) {
  const router = useRouter();
  const { setOpenMobile, state } = useSidebar();
  const { theme, resolvedTheme } = useTheme();
  const isDarkTheme = (resolvedTheme ?? theme) === 'dark';
  const [mounted, setMounted] = useState(false);
  const [selectedComposerKind, setSelectedComposerKind] = useState<
    'text' | 'sheet' | 'image' | 'code' | 'vto' | 'accountability' | null
  >(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const isCollapsed = state === 'collapsed';

  // Hydration safety
  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync selected composer with URL
  useEffect(() => {
    const dash = searchParams?.get('dashboard');
    if (
      dash &&
      ['text', 'sheet', 'image', 'code', 'vto', 'accountability'].includes(dash)
    ) {
      setSelectedComposerKind(dash as any);
    } else {
      setSelectedComposerKind(null);
    }
  }, [pathname, searchParams]);

  const logoSrc =
    mounted && isDarkTheme
      ? '/images/eos-logo-dark-mode.png'
      : '/images/eos-logo.png';

  // Handle composer item click
  const handleComposerClick = (kind: string, label: string) => {
    setOpenMobile(false);
    if (
      ['text', 'sheet', 'image', 'code', 'vto', 'accountability'].includes(kind)
    ) {
      setSelectedComposerKind(kind as any);
    } else {
      setSelectedComposerKind(null);
    }

    const { setLoading } = useLoading.getState();
    setLoading(true, `Loading ${label.toLowerCase()}…`, 'default');

    if (kind === 'recordings') {
      const key = `/api/voice/recordings`;
      void swrMutate(
        key,
        fetch(key).then((r) => r.json()),
        { revalidate: false, populateCache: true },
      );
      router.push(`/chat?dashboard=recordings`);
    } else {
      const key = `/api/documents?composerKind=${kind}`;
      void swrMutate(
        key,
        fetch(key).then((r) => r.json()),
        { revalidate: false, populateCache: true },
      );
      router.push(`/chat?dashboard=${kind}`);
    }
  };

  // ============================================================
  // SPRING ANIMATION - Smooth, satisfying feel
  // ============================================================
  // Apple-style ease: quick acceleration, gentle deceleration
  const springCurve = 'cubic-bezier(0.32, 0.72, 0, 1)';
  const fastEasing = springCurve;

  // Section headers (Composer, Chats) - consistent fade for both states
  const getHeaderFadeStyle = () => ({
    opacity: isCollapsed ? 0 : 1,
    transition: `opacity 120ms ${springCurve}`,
  });

  return (
    <Sidebar className="group-data-[side=left]:border-r-0">
      {/* HEADER - FIXED 60px HEIGHT in BOTH states - NO layout shifts */}
      <SidebarHeader
        className="overflow-visible relative"
        style={{
          height: '60px',
          minHeight: '60px',
          maxHeight: '60px',
        }}
      >
        <SidebarMenu className="h-full">
          {/* COLLAPSED STATE - Toggle centered */}
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{
              opacity: isCollapsed ? 1 : 0,
              pointerEvents: isCollapsed ? 'auto' : 'none',
              transition: `opacity 120ms ${fastEasing}`,
            }}
          >
            <SidebarToggle />
          </div>

          {/* EXPANDED STATE - Logo, buttons, toggle in row */}
          <div
            className="absolute inset-0 flex flex-row items-center pl-2 pr-5 gap-0"
            style={{
              opacity: isCollapsed ? 0 : 1,
              pointerEvents: isCollapsed ? 'none' : 'auto',
              transition: `opacity 120ms ${fastEasing}`,
            }}
          >
            {/* Logo */}
            <div className="flex-shrink-0">
              <Link
                href="/chat"
                onClick={() => {
                  setOpenMobile(false);
                  setSelectedComposerKind(null);
                }}
                className="flex items-center"
              >
                <div className="px-0 py-1 rounded-md cursor-pointer hover:opacity-80 transition-opacity">
                  <Image
                    key={isDarkTheme ? 'logo-dark' : 'logo-light'}
                    src={logoSrc}
                    alt="EOS Logo"
                    width={96}
                    height={40}
                    className="w-24 h-auto object-contain"
                    style={{ display: mounted ? 'block' : 'none' }}
                    priority
                  />
                </div>
              </Link>
            </div>

            {/* Spacer - reduced to bring buttons closer */}
            <div className="flex-1 min-w-0 max-w-[8px]" />

            {/* Action buttons */}
            <div className="flex gap-3 items-center flex-shrink-0">
              <AdvancedSearch />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    type="button"
                    className="p-2 h-10 w-10 md:h-8 md:w-8 rounded-lg hover:bg-sidebar-accent/60"
                    onClick={() => {
                      setOpenMobile(false);
                      setSelectedComposerKind(null);
                      router.replace('/chat');
                    }}
                  >
                    <PlusIcon />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>New Chat</TooltipContent>
              </Tooltip>
              <SidebarToggle />
            </div>
          </div>
        </SidebarMenu>
      </SidebarHeader>

      {/* COLLAPSED ACTION BUTTONS - Below header, only when collapsed */}
      {/* Uses max-height for smooth animation (height: auto can't be animated) */}
      <div
        className="px-2 overflow-hidden"
        style={{
          maxHeight: isCollapsed ? '100px' : '0px',
          opacity: isCollapsed ? 1 : 0,
          transition: `max-height 280ms ${fastEasing}, opacity 120ms ${fastEasing}`,
          pointerEvents: isCollapsed ? 'auto' : 'none',
        }}
      >
        <div className="flex flex-col items-center gap-1.5 pb-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                type="button"
                className="p-2 h-10 w-10 md:h-9 md:w-9 rounded-lg hover:bg-sidebar-accent/60"
                onClick={() => {
                  setOpenMobile(false);
                  setSelectedComposerKind(null);
                  router.replace('/chat');
                }}
              >
                <PlusIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">New Chat</TooltipContent>
          </Tooltip>
          <AdvancedSearch />
        </div>
      </div>

      {/* CONTENT */}
      <SidebarContent className="pt-2 flex-1">
        <div className="flex flex-col h-full">
          {/* Composer Section Header - Fades out */}
          <div
            id="composer-nav-heading"
            className="pl-3 pr-2 py-1.5 text-sm font-semibold leading-5 text-sidebar-foreground/90"
            style={getHeaderFadeStyle()}
          >
            Composer
          </div>

          {/* Composer Menu Items - Using plain buttons to avoid SidebarMenuButton's collapsible padding changes */}
          <nav 
            aria-labelledby="composer-nav-heading"
            className={cn(
              "pb-2 flex flex-col gap-1.5",
              isCollapsed ? "px-2 items-center" : "px-2"
            )}
          >
            {composerItems.map((item) => {
              const isActive = selectedComposerKind === item.kind;

              // IMPORTANT: Always render Tooltip wrapper to prevent remount on collapse
              // The tooltip only shows when collapsed (controlled by `open` logic inside Tooltip)
              return (
                <Tooltip key={item.kind}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => handleComposerClick(item.kind, item.label)}
                      aria-current={isActive ? 'page' : undefined}
                      aria-label={isCollapsed ? item.tooltip : undefined}
                      className={cn(
                        // Base styles
                        'rounded-lg text-[14px] leading-6 font-normal text-sidebar-foreground',
                        'relative',
                        'transition-all duration-200',
                        // Focus styles for keyboard navigation
                        'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                        // Collapsed: square button, centered icon
                        // Expanded: full width, left-aligned
                        isCollapsed 
                          ? 'h-10 w-10 flex items-center justify-center' 
                          : 'h-11 w-full px-3 py-3 text-left',
                        // Active/hover states
                        isActive
                          ? 'active-glass-button'
                          : 'hover:bg-sidebar-accent/60 hover:text-sidebar-foreground hover:shadow-sm',
                      )}
                    >
                      {/* Icon - Centered when collapsed, left when expanded */}
                      <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                        <item.icon size={16} className="w-4 h-4" />
                      </div>
                      {/* Text - Only visible when expanded */}
                      {!isCollapsed && (
                        <span
                          className="absolute left-[calc(12px+16px+8px)] top-1/2 -translate-y-1/2 font-normal whitespace-nowrap pointer-events-none"
                          style={{
                            opacity: 1,
                            transition: `opacity 120ms ${fastEasing}`,
                          }}
                        >
                          {item.label}
                        </span>
                      )}
                    </button>
                  </TooltipTrigger>
                  {/* Only show tooltip content when sidebar is collapsed */}
                  <TooltipContent side="right" hidden={!isCollapsed}>
                    {item.tooltip}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </nav>

          {/* Chats Section Header - Fades out */}
          <div
            id="chats-nav-heading"
            className="pl-3 pr-2 py-1.5 text-sm font-semibold leading-5 text-sidebar-foreground/90"
            style={getHeaderFadeStyle()}
          >
            Chats
          </div>

          {/* Chat History */}
          <div className="flex-1 min-h-0">
            <SidebarHistory user={user} />
          </div>
        </div>
      </SidebarContent>

      {/* FOOTER */}
      {user && (
        <SidebarFooter>
          <div className="flex items-center justify-center w-full">
            <SidebarUserNav user={user} />
          </div>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
