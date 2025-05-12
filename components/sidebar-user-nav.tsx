'use client';

import { ChevronUp, User, FileText, Globe } from 'lucide-react';
import Image from 'next/image';
import type { User as NextAuthUser } from 'next-auth';
import { signOut, useSession } from 'next-auth/react';
import { useTheme } from 'next-themes';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
import { clientLogout } from '@/lib/auth-utils';

export function SidebarUserNav({
  user,
  className,
}: { user: NextAuthUser; className?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
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

  // Check for URL parameters related to calendar integration
  useEffect(() => {
    const calendarSuccess = searchParams.get('calendar_success');
    const calendarError = searchParams.get('calendar_error');
    const success = searchParams.get('success');
    const error = searchParams.get('error');
    const openSettings = searchParams.get('open_settings');

    // Check if we're returning from a Google Calendar authorization
    // and need to restore the original tab
    const savedReturnTo = localStorage.getItem('calendarAuthReturnTo');
    if (savedReturnTo && (success || error)) {
      // Clear the stored return URL
      localStorage.removeItem('calendarAuthReturnTo');

      // If we're on a different URL than the saved one, redirect back
      // but preserve the success/error parameters
      if (window.location.href !== savedReturnTo) {
        const returnToUrl = new URL(savedReturnTo);
        if (success) returnToUrl.searchParams.set('success', success);
        if (error) returnToUrl.searchParams.set('error', error);
        if (openSettings)
          returnToUrl.searchParams.set('open_settings', openSettings);

        // Redirect back to the original URL
        window.location.href = returnToUrl.toString();
        return;
      }
    }

    // Check for calendar-specific parameters (old format)
    if (calendarSuccess) {
      setShowSettingsModal(true);
      toast({
        type: 'success',
        description: calendarSuccess,
      });

      // Clear URL parameter
      const url = new URL(window.location.href);
      url.searchParams.delete('calendar_success');
      window.history.replaceState({}, '', url);
    }

    if (calendarError) {
      setShowSettingsModal(true);
      toast({
        type: 'error',
        description: calendarError,
      });

      // Clear URL parameter
      const url = new URL(window.location.href);
      url.searchParams.delete('calendar_error');
      window.history.replaceState({}, '', url);
    }

    // Check for general success/error parameters (new format)
    if (success) {
      toast({
        type: 'success',
        description: success,
      });

      // If openSettings is true, show the settings modal
      if (openSettings === 'true') {
        setShowSettingsModal(true);
      }

      // Clear URL parameter
      const url = new URL(window.location.href);
      url.searchParams.delete('success');
      url.searchParams.delete('open_settings');
      window.history.replaceState({}, '', url);
    }

    if (error) {
      toast({
        type: 'error',
        description: error,
      });

      // If openSettings is true, show the settings modal
      if (openSettings === 'true') {
        setShowSettingsModal(true);
      }

      // Clear URL parameter
      const url = new URL(window.location.href);
      url.searchParams.delete('error');
      url.searchParams.delete('open_settings');
      window.history.replaceState({}, '', url);
    }
  }, [searchParams]);

  const handleSignOut = async () => {
    await clientLogout();
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
