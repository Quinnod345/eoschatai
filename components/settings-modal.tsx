'use client';

import * as React from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/toast';
import { useSession } from 'next-auth/react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface UserSettings {
  id?: string;
  userId?: string;
  notificationsEnabled?: boolean;
  language?: string;
  fontSize?: string;
  displayName?: string;
  companyName?: string;
  companyType?: string;
  companyDescription?: string;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { data: session } = useSession();
  const [loading, setLoading] = React.useState(false);
  const [settings, setSettings] = React.useState<UserSettings>({
    notificationsEnabled: true,
    language: 'english',
    fontSize: 'medium',
    displayName: '',
    companyName: '',
    companyType: '',
    companyDescription: '',
  });
  const [activeTab, setActiveTab] = React.useState('general');

  // Fetch user settings when the modal opens
  React.useEffect(() => {
    if (isOpen && session?.user) {
      fetchUserSettings();
    }
  }, [isOpen, session]);

  const fetchUserSettings = async () => {
    if (!session?.user) return;

    try {
      setLoading(true);
      const response = await fetch('/api/user-settings');

      if (response.ok) {
        const data = await response.json();
        setSettings({
          notificationsEnabled: data.notificationsEnabled ?? true,
          language: data.language ?? 'english',
          fontSize: data.fontSize ?? 'medium',
          displayName: data.displayName ?? '',
          companyName: data.companyName ?? '',
          companyType: data.companyType ?? '',
          companyDescription: data.companyDescription ?? '',
        });
      }
    } catch (error) {
      console.error('Failed to fetch user settings:', error);
      toast({
        type: 'error',
        description: 'Failed to load settings',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveChanges = async () => {
    if (!session?.user) {
      toast({
        type: 'error',
        description: 'You must be logged in to save settings',
      });
      return;
    }

    try {
      setLoading(true);

      const response = await fetch('/api/user-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        toast({
          type: 'success',
          description: 'Settings saved successfully!',
        });
        onClose();
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save settings');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        type: 'error',
        description:
          error instanceof Error ? error.message : 'Failed to save settings',
      });
    } finally {
      setLoading(false);
    }
  };

  // Create helper functions to update specific settings
  const updateSetting = (key: keyof UserSettings, value: any) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <AlertDialog open={isOpen}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-xl">Settings</AlertDialogTitle>
        </AlertDialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="appearance">Appearance</TabsTrigger>
            <TabsTrigger value="company">Company</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4 py-4">
            {/* Notifications Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Notifications</h3>
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="notifications"
                  className="flex flex-col space-y-1"
                >
                  <span>Enable Notifications</span>
                  <span className="text-xs text-muted-foreground">
                    Receive notifications when new messages arrive
                  </span>
                </Label>
                <Switch
                  id="notifications"
                  checked={settings.notificationsEnabled}
                  onCheckedChange={(value) =>
                    updateSetting('notificationsEnabled', value)
                  }
                  disabled={loading}
                />
              </div>
            </div>

            {/* Account Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Account</h3>
              <div className="grid gap-2">
                <Label htmlFor="display-name">Display Name</Label>
                <Input
                  id="display-name"
                  placeholder="Your display name"
                  value={settings.displayName}
                  onChange={(e) => updateSetting('displayName', e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="appearance" className="space-y-4 py-4">
            <h3 className="text-lg font-medium">Appearance</h3>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="language">Language</Label>
                <Select
                  value={settings.language}
                  onValueChange={(value) => updateSetting('language', value)}
                  disabled={loading}
                >
                  <SelectTrigger id="language">
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="english">English</SelectItem>
                    <SelectItem value="spanish">Spanish</SelectItem>
                    <SelectItem value="french">French</SelectItem>
                    <SelectItem value="german">German</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="fontSize">Font Size</Label>
                <Select
                  value={settings.fontSize}
                  onValueChange={(value) => updateSetting('fontSize', value)}
                  disabled={loading}
                >
                  <SelectTrigger id="fontSize">
                    <SelectValue placeholder="Select font size" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="small">Small</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="large">Large</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="company" className="space-y-4 py-4">
            <h3 className="text-lg font-medium">Company Context</h3>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="company-name">Company Name</Label>
                <Input
                  id="company-name"
                  placeholder="Enter your company name"
                  value={settings.companyName}
                  onChange={(e) => updateSetting('companyName', e.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="company-type">Company Type</Label>
                <Select
                  value={settings.companyType}
                  onValueChange={(value) => updateSetting('companyType', value)}
                  disabled={loading}
                >
                  <SelectTrigger id="company-type">
                    <SelectValue placeholder="Select company type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="corporation">Corporation</SelectItem>
                    <SelectItem value="llc">LLC</SelectItem>
                    <SelectItem value="partnership">Partnership</SelectItem>
                    <SelectItem value="nonprofit">Non-Profit</SelectItem>
                    <SelectItem value="startup">Startup</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="company-description">About Your Company</Label>
                <Textarea
                  id="company-description"
                  placeholder="Describe what your company does, your mission, and other relevant information"
                  value={settings.companyDescription}
                  onChange={(e) =>
                    updateSetting('companyDescription', e.target.value)
                  }
                  className="min-h-[100px]"
                  disabled={loading}
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose} disabled={loading}>
            Cancel
          </AlertDialogCancel>
          <Button onClick={handleSaveChanges} disabled={loading}>
            {loading ? 'Saving...' : 'Save Changes'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
