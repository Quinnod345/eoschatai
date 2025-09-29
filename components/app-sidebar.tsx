'use client';

import type { User } from 'next-auth';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useLoading } from '@/hooks/use-loading';
import { mutate as swrMutate } from 'swr';
import { useTheme } from 'next-themes';
import Script from 'next/script';

// Type declarations for liquidGL
declare global {
  interface Window {
    liquidGL?: any;
    html2canvas?: any;
  }
}

import {
  PlusIcon,
  FileTextIcon,
  ImageIcon,
  CodeIcon,
  TargetIcon,
} from '@/components/icons';
import { FileSpreadsheet } from 'lucide-react';
import { Users2 } from 'lucide-react';
import { Mic } from 'lucide-react';
import { Zap } from 'lucide-react';
import { SidebarHistory } from '@/components/sidebar-history';
import { Button } from '@/components/ui/button';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from '@/components/ui/sidebar';
import { AdvancedSearch } from '@/components/advanced-search';
// import { useLoading } from '@/hooks/use-loading';

// Spring transition settings
const springTransition = {
  type: 'spring',
  stiffness: 260,
  damping: 20,
  mass: 1,
};

export function AppSidebar({ user }: { user: User | undefined }) {
  const router = useRouter();
  const { setOpenMobile, state } = useSidebar();
  const { theme, resolvedTheme } = useTheme();
  // Ensure we react immediately to theme changes even before mount flags settle
  const isDarkTheme = (resolvedTheme ?? theme) === 'dark';
  const [mounted, setMounted] = useState(false);
  const [selectedComposerKind, setSelectedComposerKind] = useState<
    'text' | 'sheet' | 'image' | 'code' | 'vto' | 'accountability' | null
  >(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [liquidGLReady, setLiquidGLReady] = useState(false);
  const liquidGLInitialized = useRef(false);

  // Once mounted on client, we can safely show the UI without hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Initialize liquidGL after scripts are loaded
  useEffect(() => {
    if (liquidGLReady && !liquidGLInitialized.current && state === 'expanded') {
      // Wait a bit for DOM to be ready
      setTimeout(() => {
        try {
          // @ts-ignore
          if (window.liquidGL && window.html2canvas) {
            // Initialize liquidGL on the dedicated lens layer
            // @ts-ignore
            window.liquidGL({
              snapshot: 'body',
              target: '.liquid-gl-lens',
              resolution: 2.2,
              // Stronger refraction and crisper edge bevels for a flawless glass look
              refraction: 0.02,
              bevelDepth: 0.08,
              bevelWidth: 0.22,
              // Add subtle frost to increase perceived blur within the lens
              frost: 0.08,
              shadow: false,
              specular: true,
              reveal: 'fade',
              tilt: false,
              tiltFactor: 3,
              // Slightly stronger magnification to emphasize edge refraction
              magnify: 1.08,
              on: {
                init(instance: any) {
                  console.log('LiquidGL initialized on sidebar');
                  liquidGLInitialized.current = true;
                },
              },
            });
          }
        } catch (error) {
          console.error('Failed to initialize liquidGL:', error);
        }
      }, 100);
    }
  }, [liquidGLReady, state]);

  // Determine which logo to use based on theme
  // Keep composer selection in sync with URL (?dashboard=...)
  useEffect(() => {
    const dash = searchParams?.get('dashboard');
    if (dash) {
      setSelectedComposerKind(
        ['text', 'sheet', 'image', 'code', 'vto', 'accountability'].includes(
          dash,
        )
          ? (dash as any)
          : null,
      );
    } else {
      // When navigating to chats (no dashboard param), clear selection
      setSelectedComposerKind(null);
    }
  }, [pathname, searchParams]);

  const logoSrc =
    mounted && isDarkTheme
      ? '/images/eos-logo-dark-mode.png'
      : '/images/eos-logo.png';

  // Animation variants
  const headerVariants = {
    expanded: {
      y: 0,
      opacity: 1,
      transition: springTransition,
    },
    collapsed: {
      y: -10,
      opacity: 0,
      transition: springTransition,
    },
  };

  const contentVariants = {
    expanded: {
      opacity: 1,
      scale: 1,
      transition: {
        ...springTransition,
        delay: 0.05,
      },
    },
    collapsed: {
      opacity: 0,
      scale: 0.98,
      transition: springTransition,
    },
  };

  const footerVariants = {
    expanded: {
      y: 0,
      opacity: 1,
      transition: {
        ...springTransition,
        delay: 0.1,
      },
    },
    collapsed: {
      y: 10,
      opacity: 0,
      transition: springTransition,
    },
  };

  return (
    <>
      <Sidebar className="group-data-[side=left]:border-r-0">
        <motion.div
          initial={false}
          animate={state === 'expanded' ? 'expanded' : 'collapsed'}
          variants={headerVariants}
        >
          <SidebarHeader className="py-4">
            <SidebarMenu>
              <div className="flex flex-row justify-between items-center px-2">
                <Link
                  href="/chat"
                  onClick={() => {
                    setOpenMobile(false);
                    setSelectedComposerKind(null);
                  }}
                  className="flex flex-row gap-3 items-center"
                >
                  <motion.div
                    className="px-3 py-1.5 rounded-md cursor-pointer"
                    whileHover={{
                      y: -1,
                      transition: { duration: 0.2, ease: 'easeOut' },
                    }}
                  >
                    <Image
                      key={isDarkTheme ? 'logo-dark' : 'logo-light'}
                      src={logoSrc}
                      alt="EOS Logo"
                      width={96}
                      height={40}
                      className="w-24 h-auto"
                      style={{
                        display: mounted ? 'block' : 'none', // Prevent flash of wrong theme logo
                        objectFit: 'contain',
                      }}
                    />
                  </motion.div>
                </Link>
                <div className="flex gap-1 items-center">
                  {/* Advanced Search Component */}
                  <AdvancedSearch />

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <motion.div
                        whileHover={{ scale: 1.05, y: -1 }}
                        whileTap={{ scale: 0.96 }}
                      >
                        <Button
                          variant="ghost"
                          type="button"
                          className="p-2 h-fit"
                          onClick={() => {
                            setOpenMobile(false);
                            setSelectedComposerKind(null);
                            // Don't show loading for new chat - it should be instant
                            // Force a clean navigation to /chat without any search parameters
                            const url = new URL(
                              '/chat',
                              window.location.origin,
                            );
                            router.replace(url.pathname);
                          }}
                        >
                          <PlusIcon />
                        </Button>
                      </motion.div>
                    </TooltipTrigger>
                    <TooltipContent align="end">New Chat</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </SidebarMenu>
          </SidebarHeader>
        </motion.div>

        <SidebarContent className="pt-2 flex-1">
          <motion.div
            initial={false}
            animate={state === 'expanded' ? 'expanded' : 'collapsed'}
            variants={contentVariants}
            className="h-full"
          >
            <div className="flex flex-col h-full">
              {/* Composer Section */}
              <div className="pl-3 pr-2 py-1.5 text-sm font-semibold leading-5 text-sidebar-foreground/90">
                Composer
              </div>
              <div className="px-1 pb-2">
                <SidebarMenu className="gap-1.5">
                  {[
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
                  ].map((item) => (
                    <SidebarMenuItem
                      key={item.kind}
                      className="py-1 px-1 group/item relative"
                    >
                      <motion.div
                        className="w-full rounded-md"
                        whileHover={{ y: -1 }}
                        transition={{
                          type: 'spring',
                          stiffness: 350,
                          damping: 26,
                        }}
                      >
                        <SidebarMenuButton
                          size="lg"
                          className={cn(
                            'rounded-lg !h-11 py-3 px-3 text-[14px] leading-6 font-normal transition-all duration-200 mr-0 justify-start text-sidebar-foreground',
                            selectedComposerKind === item.kind
                              ? 'active-glass-button'
                              : 'hover:bg-sidebar-accent/60 hover:text-sidebar-foreground hover:shadow-sm',
                          )}
                          tooltip={item.tooltip}
                          onClick={() => {
                            setOpenMobile(false);
                            if (
                              item.kind === 'text' ||
                              item.kind === 'sheet' ||
                              item.kind === 'image' ||
                              item.kind === 'code' ||
                              item.kind === 'vto' ||
                              item.kind === 'accountability'
                            ) {
                              setSelectedComposerKind(item.kind as any);
                            } else {
                              setSelectedComposerKind(null);
                            }
                            // Show global loading overlay for better perceived speed
                            const { setLoading } = useLoading.getState();
                            setLoading(
                              true,
                              `Loading ${item.label.toLowerCase()}…`,
                              'default',
                            );
                            if (item.kind === 'recordings') {
                              const key = `/api/voice/recordings`;
                              void swrMutate(
                                key,
                                fetch(key).then((r) => r.json()),
                                { revalidate: false, populateCache: true },
                              );
                              router.push(`/chat?dashboard=recordings`);
                            } else {
                              const key = `/api/documents?composerKind=${item.kind}`;
                              void swrMutate(
                                key,
                                fetch(key).then((r) => r.json()),
                                { revalidate: false, populateCache: true },
                              );
                              router.push(`/chat?dashboard=${item.kind}`);
                            }
                          }}
                        >
                          <div className="relative flex items-center w-full">
                            <item.icon size={16} className="mr-2" />
                            <span className="truncate block min-w-0 text-[14px] font-normal">
                              {item.label}
                            </span>
                          </div>
                        </SidebarMenuButton>
                      </motion.div>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </div>

              <div className="pl-3 pr-2 py-1.5 text-sm font-semibold leading-5 text-sidebar-foreground/90">
                Chats
              </div>

              {/* Dev only: Test Premium UI */}
              {process.env.NODE_ENV !== 'production' && (
                <div className="px-3 pb-2 space-y-2">
                  <Link href="/test-premium">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start text-xs"
                    >
                      <Zap className="mr-2 h-3 w-3" />
                      Test Premium UI
                    </Button>
                  </Link>
                  <Link href="/test-nexus">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start text-xs"
                    >
                      <Zap className="mr-2 h-3 w-3" />
                      Test Nexus Selector
                    </Button>
                  </Link>
                </div>
              )}

              <div className="flex-1 min-h-0">
                <SidebarHistory user={user} />
              </div>
            </div>
          </motion.div>
        </SidebarContent>

        {user && (
          <motion.div
            initial={false}
            animate={state === 'expanded' ? 'expanded' : 'collapsed'}
            variants={footerVariants}
          >
            <SidebarFooter />
          </motion.div>
        )}
      </Sidebar>

      {/* Load liquidGL dependencies */}
      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"
        strategy="afterInteractive"
        onLoad={() => {
          console.log('html2canvas loaded');
          if (typeof window !== 'undefined' && window.liquidGL) {
            setLiquidGLReady(true);
          }
        }}
      />
      <Script
        src="/scripts/liquidGL.js"
        strategy="afterInteractive"
        onLoad={() => {
          console.log('liquidGL loaded');
          if (typeof window !== 'undefined' && window.html2canvas) {
            setLiquidGLReady(true);
          }
        }}
      />
    </>
  );
}
