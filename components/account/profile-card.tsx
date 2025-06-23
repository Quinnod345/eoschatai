'use client';

import * as React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { SettingsModal } from '@/components/settings-modal';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { User, Mail, Calendar } from 'lucide-react';
import RecordingModal from '@/components/recording-modal';

export function ProfileCard() {
  const { data: session } = useSession();
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [isRecordingModalOpen, setIsRecordingModalOpen] = React.useState(false);
  const [settings, setSettings] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (session?.user) {
      fetchUserSettings();
    }
  }, [session]);

  const fetchUserSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/user-settings');

      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      }
    } catch (error) {
      console.error('Failed to fetch user settings:', error);
    } finally {
      setLoading(false);
    }
  };

  // Function to generate avatar initials
  const getInitials = () => {
    if (settings?.displayName) {
      return settings.displayName
        .split(' ')
        .map((part: string) => part[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);
    }

    if (session?.user?.email) {
      return session.user.email.substring(0, 2).toUpperCase();
    }

    return 'U';
  };

  const getAccountType = () => {
    return session?.user?.type === 'guest'
      ? 'Guest Account'
      : 'Registered Account';
  };

  return (
    <>
      <Card className="w-full">
        <CardHeader className="flex flex-row items-center gap-4">
          <Avatar className="h-14 w-14">
            <AvatarFallback className="text-lg font-medium">
              {getInitials()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <CardTitle>
              {settings?.displayName || session?.user?.email || 'User'}
            </CardTitle>
            <CardDescription>{getAccountType()}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span>{session?.user?.email || 'No email'}</span>
          </div>
          {settings?.companyName && (
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span>
                {settings.companyName}
                {settings.companyType && ` (${settings.companyType})`}
              </span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span>Member since {new Date().toLocaleDateString()}</span>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setIsSettingsOpen(true)}
          >
            Account Settings
          </Button>
          <Button
            className="w-full"
            onClick={() => setIsRecordingModalOpen(true)}
          >
            Voice Recording Suite
          </Button>
        </CardFooter>
      </Card>

      {isSettingsOpen && (
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => {
            setIsSettingsOpen(false);
            fetchUserSettings();
          }}
        />
      )}

      {isRecordingModalOpen && (
        <RecordingModal
          isOpen={isRecordingModalOpen}
          onClose={() => setIsRecordingModalOpen(false)}
        />
      )}
    </>
  );
}
