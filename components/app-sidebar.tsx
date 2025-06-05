'use client';

import type { User } from 'next-auth';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { Search, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';

import { PlusIcon } from '@/components/icons';
import { SidebarHistory } from '@/components/sidebar-history';
import { Button } from '@/components/ui/button';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarInput,
  useSidebar,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import { AnimatedSidebarWrapper } from '@/components/ui/animated-sidebar';
import { AdvancedSearch } from '@/components/advanced-search';

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
  const [mounted, setMounted] = useState(false);

  // Once mounted on client, we can safely show the UI without hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Determine which logo to use based on theme
  const logoSrc =
    mounted && (theme === 'dark' || resolvedTheme === 'dark')
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
                  }}
                  className="flex flex-row gap-3 items-center"
                >
                  <motion.div
                    className="px-3 py-1.5 hover:bg-muted rounded-md cursor-pointer"
                    whileHover={{
                      backgroundColor: 'rgba(var(--primary-rgb), 0.1)',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                      transition: { duration: 0.2, ease: 'easeOut' },
                    }}
                  >
                    <Image
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
                      <Button
                        variant="ghost"
                        type="button"
                        className="p-2 h-fit"
                        onClick={() => {
                          setOpenMobile(false);
                          // Force a clean navigation to /chat without any search parameters
                          const url = new URL('/chat', window.location.origin);
                          router.replace(url.pathname);
                        }}
                      >
                        <PlusIcon />
                      </Button>
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
            <SidebarHistory user={user} />
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
    </>
  );
}
