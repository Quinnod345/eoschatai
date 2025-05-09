'use client';

import type { User } from 'next-auth';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { Search, X } from 'lucide-react';
import { useState } from 'react';

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
} from '@/components/ui/sidebar';
import { AnimatedSidebarWrapper } from '@/components/ui/animated-sidebar';

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
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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
    <Sidebar className="group-data-[side=left]:border-r-0">
      <motion.div
        initial={false}
        animate={state === 'expanded' ? 'expanded' : 'collapsed'}
        variants={headerVariants}
      >
        <SidebarHeader className="py-4">
          <SidebarMenu>
            <div className="flex flex-row justify-between items-center px-2">
              {!isSearchOpen ? (
                <>
                  <Link
                    href="/"
                    onClick={() => {
                      setOpenMobile(false);
                    }}
                    className="flex flex-row gap-3 items-center"
                  >
                    <motion.div
                      className="px-3 py-1.5 hover:bg-muted rounded-md cursor-pointer"
                      whileHover={{
                        backgroundColor: 'rgba(var(--primary-rgb), 0.1)',
                        transition: { duration: 0.2 },
                      }}
                    >
                      <img
                        src="/images/eos-logo.png"
                        alt="EOS Logo"
                        className="w-24 h-auto"
                        style={{
                          display: 'block',
                          objectFit: 'contain',
                        }}
                      />
                    </motion.div>
                  </Link>
                  <div className="flex gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          type="button"
                          className="p-2 h-fit"
                          onClick={() => {
                            setOpenMobile(false);
                            setIsSearchOpen(true);
                          }}
                        >
                          <Search size={18} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent align="end">Search Chats</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          type="button"
                          className="p-2 h-fit"
                          onClick={() => {
                            setOpenMobile(false);
                            router.push('/');
                            router.refresh();
                          }}
                        >
                          <PlusIcon />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent align="end">New Chat</TooltipContent>
                    </Tooltip>
                  </div>
                </>
              ) : (
                <div className="flex w-full items-center gap-1">
                  <SidebarInput
                    placeholder="Search chats..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoFocus
                    className="flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => {
                      setIsSearchOpen(false);
                      setSearchQuery('');
                    }}
                  >
                    <X size={16} />
                  </Button>
                </div>
              )}
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
          <SidebarHistory user={user} searchQuery={searchQuery} />
        </motion.div>
      </SidebarContent>
    </Sidebar>
  );
}
