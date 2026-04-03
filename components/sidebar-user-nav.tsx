'use client';

import { User, Globe } from 'lucide-react';
import type { User as NextAuthUser } from 'next-auth';
import { useSession } from 'next-auth/react';
import { useTheme } from 'next-themes';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from '@/lib/toast-system';
import { guestRegex } from '@/lib/constants';
import { SettingsModal } from './settings-modal';
import { DocumentContextModal } from './document-context-modal';
import { KeyboardShortcutsModal } from './keyboard-shortcuts-modal';
import { useUserSettings } from '@/components/user-settings-provider';
import { FileSpreadsheet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { springChat } from '@/lib/motion/presets';
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
import { Keyboard, LogOut, Settings } from 'lucide-react';
import { clientLogout } from '@/lib/auth-utils';
import {
  OrganizationSwitcher,
  OrganizationSwitcherTrigger,
} from '@/components/organization-switcher';

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
  const [settingsInitialSection, setSettingsInitialSection] = useState<string | undefined>(undefined);
  const [showDocumentContextModal, setShowDocumentContextModal] =
    useState(false);
  const [showKeyboardShortcutsModal, setShowKeyboardShortcutsModal] =
    useState(false);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [showOrgSwitcher, setShowOrgSwitcher] = useState(false);

  const { settings: userSettings } = useUserSettings();
  const profilePicture = userSettings.profilePicture || null;
  const [chatHistoryChecked, setChatHistoryChecked] = useState<string | null>(
    null,
  );
  const userName = data?.user?.email || '';

  const isGuest = guestRegex.test(data?.user?.email ?? '');

  // Detect if the component is used in the header
  const isInHeader = className?.includes('header-user-nav');

  // Add keyboard shortcut to open keyboard shortcuts modal
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === '?') {
        event.preventDefault();
        setShowKeyboardShortcutsModal(true);
      }
    };

    const handleOpenSettingsModal = () => {
      setShowSettingsModal(true);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('openSettingsModal', handleOpenSettingsModal);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('openSettingsModal', handleOpenSettingsModal);
    };
  }, []);

  // No longer need to fetch user settings - using context

  // Check for URL parameters related to calendar integration and settings
  useEffect(() => {
    const calendarSuccess = searchParams.get('calendar_success');
    const calendarError = searchParams.get('calendar_error');
    const success = searchParams.get('success');
    const error = searchParams.get('error');
    const openSettings = searchParams.get('open_settings');
    const settingsSection = searchParams.get('settings');
    
    // Handle settings section param (e.g., ?settings=api-keys)
    if (settingsSection) {
      setSettingsInitialSection(settingsSection);
      setShowSettingsModal(true);
      
      // Clear the URL param
      const url = new URL(window.location.href);
      url.searchParams.delete('settings');
      window.history.replaceState({}, '', url);
      return; // Don't process other params if we're opening settings
    }

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
      toast.success(calendarSuccess);

      // Clear URL parameter
      const url = new URL(window.location.href);
      url.searchParams.delete('calendar_success');
      window.history.replaceState({}, '', url);
    }

    if (calendarError) {
      setShowSettingsModal(true);
      toast.error(calendarError);

      // Clear URL parameter
      const url = new URL(window.location.href);
      url.searchParams.delete('calendar_error');
      window.history.replaceState({}, '', url);
    }

    // Check for general success/error parameters (new format)
    if (success) {
      toast.success(success);

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
      toast.error(error);

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
          transition={{ ...springChat, delay: 0.4 }}
          className={cn(
            'flex items-center w-auto md:flex-col gap-2',
            isInHeader && 'flex-row md:flex-row', // Make sure it stays in row layout in header
            styles.userAvatarContainer,
          )}
        >
          <DropdownMenu open={avatarMenuOpen} onOpenChange={setAvatarMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className={cn(
                  'relative h-8 w-8 rounded-full',
                  avatarMenuOpen ? 'avatar-open-bloom' : 'hover:animate-pulse',
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
            <DropdownMenuContent className="w-64" align="start" side="right" sideOffset={8} forceMount>
              <div className="flex flex-col justify-center items-center gap-2.5 px-3 py-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                  {profilePicture ? (
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={profilePicture} alt={userName} />
                      <AvatarFallback>
                        <User className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    <User className="h-4 w-4" />
                  )}
                </div>
                <div className="space-y-1 text-center min-w-0 w-full">
                  <p className="text-sm font-medium leading-none break-words">{userName}</p>
                  <p className="text-xs leading-none text-muted-foreground break-words">
                    {user.email}
                  </p>
                </div>
              </div>
              <OrganizationSwitcherTrigger
                onClick={() => setShowOrgSwitcher(true)}
              />
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShowSettingsModal(true)}>
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => setShowDocumentContextModal(true)}
              >
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                <span>Document Context</span>
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
                onSelect={() => setShowKeyboardShortcutsModal(true)}
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
        onClose={() => {
          setShowSettingsModal(false);
          setSettingsInitialSection(undefined);
        }}
        initialSection={settingsInitialSection}
      />

      {/* Document Context Modal */}
      <DocumentContextModal
        isOpen={showDocumentContextModal}
        onClose={() => setShowDocumentContextModal(false)}
      />

      {/* Keyboard Shortcuts Modal */}
      <KeyboardShortcutsModal
        isOpen={showKeyboardShortcutsModal}
        onClose={() => setShowKeyboardShortcutsModal(false)}
      />



      {/* Organization Switcher */}
      {showOrgSwitcher && (
        <OrganizationSwitcher onClose={() => setShowOrgSwitcher(false)} />
      )}
    </>
  );
}
