'use client';

import { ChevronUp, User } from 'lucide-react';
import Image from 'next/image';
import type { User as NextAuthUser } from 'next-auth';
import { signOut, useSession } from 'next-auth/react';
import { useTheme } from 'next-themes';
import { useState, useEffect } from 'react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { useRouter } from 'next/navigation';
import { toast } from './toast';
import { LoaderIcon, SettingsIcon } from './icons';
import { guestRegex } from '@/lib/constants';
import { SettingsModal } from './settings-modal';

export function SidebarUserNav({ user }: { user: NextAuthUser }) {
  const router = useRouter();
  const { data, status } = useSession();
  const { setTheme, theme } = useTheme();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);

  const isGuest = guestRegex.test(data?.user?.email ?? '');

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

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            {status === 'loading' ? (
              <SidebarMenuButton className="data-[state=open]:bg-sidebar-accent bg-background data-[state=open]:text-sidebar-accent-foreground h-10 justify-between">
                <div className="flex flex-row gap-2">
                  <div className="size-6 bg-zinc-500/30 rounded-full animate-pulse" />
                  <span className="bg-zinc-500/30 text-transparent rounded-md animate-pulse">
                    Loading auth status
                  </span>
                </div>
                <div className="animate-spin text-zinc-500">
                  <LoaderIcon />
                </div>
              </SidebarMenuButton>
            ) : (
              <SidebarMenuButton
                data-testid="user-nav-button"
                className="data-[state=open]:bg-sidebar-accent bg-background data-[state=open]:text-sidebar-accent-foreground h-10"
              >
                <div
                  className="relative size-6 rounded-full overflow-hidden border border-muted/30 bg-muted/20"
                  style={{ borderRadius: '50%' }}
                >
                  {isLoadingProfile ? (
                    <div className="size-full animate-pulse bg-muted/40" />
                  ) : profilePicture ? (
                    <Image
                      src={profilePicture}
                      alt={user.email ?? 'User Avatar'}
                      fill
                      className="object-cover rounded-full"
                      onError={() => setProfilePicture(null)}
                    />
                  ) : (
                    <div className="flex items-center justify-center size-full">
                      <User size={22} className="text-muted-foreground/60" />
                    </div>
                  )}
                </div>
                <span data-testid="user-email" className="truncate">
                  {isGuest ? 'Guest' : user?.email}
                </span>
                <ChevronUp className="ml-auto" />
              </SidebarMenuButton>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent
            data-testid="user-nav-menu"
            side="top"
            className="w-[--radix-popper-anchor-width]"
          >
            <DropdownMenuItem
              data-testid="user-nav-item-settings"
              className="cursor-pointer"
              onSelect={() => setIsSettingsOpen(true)}
            >
              <SettingsIcon size={16} />
              Account Settings
            </DropdownMenuItem>
            <DropdownMenuItem
              data-testid="user-nav-item-theme"
              className="cursor-pointer"
              onSelect={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              {`Toggle ${theme === 'light' ? 'dark' : 'light'} mode`}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild data-testid="user-nav-item-auth">
              <button
                type="button"
                className="w-full cursor-pointer"
                onClick={() => {
                  if (status === 'loading') {
                    toast({
                      type: 'error',
                      description:
                        'Checking authentication status, please try again!',
                    });

                    return;
                  }

                  if (isGuest) {
                    router.push('/login');
                  } else {
                    signOut({
                      redirectTo: '/',
                    });
                  }
                }}
              >
                {isGuest ? 'Login to your account' : 'Sign out'}
              </button>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => {
          setIsSettingsOpen(false);
          // Refresh profile picture when settings modal is closed
          if (status !== 'loading') {
            fetch('/api/user-settings')
              .then((response) => response.ok && response.json())
              .then((data) => setProfilePicture(data.profilePicture || null))
              .catch((error) =>
                console.error('Failed to refresh profile picture', error),
              );
          }
        }}
      />
    </SidebarMenu>
  );
}
