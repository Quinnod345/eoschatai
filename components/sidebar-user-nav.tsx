'use client';

import { ChevronUp, User, FileText, Globe } from 'lucide-react';
import Image from 'next/image';
import type { User as NextAuthUser } from 'next-auth';
import { signOut, useSession } from 'next-auth/react';
import { useTheme } from 'next-themes';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from './toast';
import { LoaderIcon, SettingsIcon } from './icons';
import { guestRegex } from '@/lib/constants';
import { SettingsModal } from './settings-modal';
import { DocumentContextModal } from './document-context-modal';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { FileSpreadsheet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { styles } from '@/lib/styles';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  CreditCard,
  Github,
  Keyboard,
  LifeBuoy,
  LogOut,
  Settings,
} from 'lucide-react';

export function SidebarUserNav({
  user,
  className,
}: { user: NextAuthUser; className?: string }) {
  const router = useRouter();
  const { data, status } = useSession();
  const { setTheme, theme } = useTheme();

  // Modal states
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showDocumentContextModal, setShowDocumentContextModal] =
    useState(false);

  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [chatHistoryChecked, setChatHistoryChecked] = useState<string | null>(
    null,
  );
  const userName = data?.user?.email || '';

  const isGuest = guestRegex.test(data?.user?.email ?? '');

  // Detect if the component is used in the header
  const isInHeader = className?.includes('header-user-nav');

  // Fetch user settings to get profile picture
  useEffect(() => {
    async function fetchUserSettings() {
      if (status === 'loading') return;

      try {
        setIsLoadingProfile(true);
        const response = await fetch('/api/user-settings');

        if (response.ok) {
          const data = await response.json();
          setProfilePicture(data.profilePicture || null);
        }
      } catch (error) {
        console.error('Failed to fetch user settings', error);
      } finally {
        setIsLoadingProfile(false);
      }
    }

    fetchUserSettings();
  }, [status]);

  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/sign-in' });
  };

  return (
    <>
      <div
        className={cn(
          'pb-4 pt-4 flex justify-between items-center md:flex-col md:h-full md:justify-start gap-4',
          isInHeader && 'p-0 md:flex-row md:h-auto', // Adjust styling for header use
          styles.navStyles,
          className,
        )}
      >
        <motion.div
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          className={cn(
            'flex items-center w-auto md:flex-col gap-2',
            isInHeader && 'flex-row md:flex-row', // Make sure it stays in row layout in header
            styles.userAvatarContainer,
          )}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className={cn(
                  'relative h-8 w-8 rounded-full hover:animate-pulse',
                  styles.avatarButton,
                )}
              >
                <Avatar className="h-8 w-8">
                  {profilePicture ? (
                    <AvatarImage src={profilePicture} alt={userName} />
                  ) : (
                    <AvatarFallback>
                      <span className="sr-only">{userName}</span>
                      <User className="h-4 w-4" />
                    </AvatarFallback>
                  )}
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <div className="flex flex-col justify-center items-center gap-2 p-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                  {profilePicture ? (
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={profilePicture} alt={userName} />
                      <AvatarFallback>
                        <User className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    <User className="h-4 w-4" />
                  )}
                </div>
                <div className="space-y-1 text-center">
                  <p className="text-sm font-medium leading-none">{userName}</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user.email}
                  </p>
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShowSettingsModal(true)}>
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => setShowDocumentContextModal(true)}
              >
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center">
                        <FileSpreadsheet className="mr-2 h-4 w-4" />
                        <span>Document Context</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      Upload company documents like Core Process, Scorecard, or
                      V/TO to provide context for AI responses
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() =>
                  window.open('https://eosworldwide.com', '_blank')
                }
              >
                <Globe className="mr-2 h-4 w-4" />
                <span>EOS Website</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  setChatHistoryChecked('keyboard_shortcuts');
                  router.push('/keyboard-shortcuts');
                }}
              >
                <Keyboard className="mr-2 h-4 w-4" />
                <span>Keyboard shortcuts</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer"
                onSelect={handleSignOut}
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </motion.div>
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
      />

      {/* Document Context Modal */}
      <DocumentContextModal
        isOpen={showDocumentContextModal}
        onClose={() => setShowDocumentContextModal(false)}
      />
    </>
  );
}
