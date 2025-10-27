'use client';

import * as React from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/lib/toast-system';
import { useSession } from 'next-auth/react';
import { Separator } from '@/components/ui/separator';
import { useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Gate } from '@/components/gate';
import { UpgradePrompt } from '@/components/upgrade-prompt';
import {
  UserCircle,
  Calendar,
  Moon,
  Sun,
  Monitor,
  Bell,
  Shield,
  Zap,
  X,
  Check,
  Camera,
  Palette,
  Download,
  Trash2,
  Database,
  ExternalLink,
  AlertTriangle,
  Building2,
  BarChart,
} from 'lucide-react';
import Image from 'next/image';
import { ImageCropper } from '@/components/image-cropper';
import { AnimatedModal } from '@/components/ui/animated-modal';
import { useUISettings } from '@/components/ui-settings-provider';
import { useUserSettings } from '@/components/user-settings-provider';
import { useTheme } from 'next-themes';
import { OrganizationSettings } from '@/components/organization-settings';
import { useAccountStore } from '@/lib/stores/account-store';

function MemoriesManager() {
  const [query, setQuery] = React.useState('');
  const [status, setStatus] = React.useState<string>('');
  const [type, setType] = React.useState<string>('');
  const [loading, setLoading] = React.useState(false);
  const [memories, setMemories] = React.useState<any[]>([]);

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (query) params.set('q', query);
      if (status) params.set('status', status);
      if (type) params.set('type', type);
      const res = await fetch(`/api/memories?${params.toString()}`);
      const data = await res.json();
      setMemories(Array.isArray(data.memories) ? data.memories : []);
    } catch (e) {
      console.error('Failed to load memories', e);
    } finally {
      setLoading(false);
    }
  }, [query, status, type]);

  React.useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/memories?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      setMemories((prev) => prev.filter((m) => m.id !== id));
    } catch (e) {
      console.error('Failed to delete memory', e);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          placeholder="Search memories"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Select
          value={status || 'all'}
          onValueChange={(v) => setStatus(v === 'all' ? '' : v)}
        >
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
            <SelectItem value="dismissed">Dismissed</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={type || 'all'}
          onValueChange={(v) => setType(v === 'all' ? '' : v)}
        >
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="preference">Preference</SelectItem>
            <SelectItem value="profile">Profile</SelectItem>
            <SelectItem value="company">Company</SelectItem>
            <SelectItem value="task">Task</SelectItem>
            <SelectItem value="knowledge">Knowledge</SelectItem>
            <SelectItem value="personal">Personal</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={load} disabled={loading} className="whitespace-nowrap">
          {loading ? 'Loading...' : 'Refresh'}
        </Button>
      </div>

      <div className="rounded-lg border divide-y">
        {memories.length === 0 && (
          <div className="p-6 text-sm text-muted-foreground">
            No memories found.
          </div>
        )}
        {memories.map((m) => (
          <div key={m.id} className="p-4 flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <div className="font-medium truncate">{m.summary}</div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground uppercase">
                  {m.memoryType}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground uppercase">
                  {m.status}
                </span>
              </div>
              {m.topic && (
                <div className="text-xs text-muted-foreground mt-1">
                  Topic: {m.topic}
                </div>
              )}
              {m.content && (
                <div className="text-sm text-muted-foreground mt-2 line-clamp-3 whitespace-pre-wrap">
                  {m.content}
                </div>
              )}
              <div className="text-xs text-muted-foreground mt-2">
                Saved {new Date(m.createdAt).toLocaleString()}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDelete(m.id)}
              >
                Delete
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface UserSettings {
  displayName?: string;
  profilePicture?: string;
  companyName?: string;
  companyType?: string;
  companyDescription?: string;
  companyIndustry?: string;
  companySize?: string;
  companyWebsite?: string;
  companyCountry?: string;
  companyState?: string;
  language?: string;
  fontSize?: string;
  notificationsEnabled?: boolean;
  autocompleteEnabled?: boolean;
  googleCalendarConnected?: boolean;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { data: session, update: updateSession } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = React.useState(false);
  const { theme, setTheme } = useTheme();
  const { updateSettings: updateUISettings } = useUISettings();
  const { settings: globalUserSettings, updateSettings: updateGlobalSettings } =
    useUserSettings();

  const [activeSection, setActiveSection] = React.useState('profile');
  const [settings, setSettings] = React.useState<UserSettings>({
    displayName: '',
    profilePicture: '',
    companyName: '',
    companyType: '',
    companyDescription: '',
    companyIndustry: '',
    companySize: '',
    companyWebsite: '',
    companyCountry: '',
    companyState: '',
    language: 'english',
    fontSize: 'medium',
    notificationsEnabled: true,
    autocompleteEnabled: true,
    googleCalendarConnected: false,
  });

  // UI state
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [email, setEmail] = React.useState('');
  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [passwordError, setPasswordError] = React.useState('');
  const [uploadingImage, setUploadingImage] = React.useState(false);
  const [cropperImage, setCropperImage] = React.useState<string | null>(null);
  const [isCropperOpen, setIsCropperOpen] = React.useState(false);
  const [calendarConnecting, setCalendarConnecting] = React.useState(false);

  // Account data (org and user) from global account store
  const org = useAccountStore((state) => state.org);
  const accountUser = useAccountStore((state) => state.user);
  const entitlements = useAccountStore((state) => state.entitlements);
  const usageCounters = useAccountStore((state) => state.usageCounters);

  // Privacy & Security state
  const [exportingData, setExportingData] = React.useState(false);
  const [clearingHistory, setClearingHistory] = React.useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [deletingAccount, setDeletingAccount] = React.useState(false);
  const [dataStats, setDataStats] = React.useState<{
    totalChats: number;
    totalMessages: number;
    totalDocuments: number;
    accountAge: number;
  } | null>(null);

  // Navigation items
  const navigationItems = [
    { id: 'profile', label: 'Profile', icon: UserCircle },
    { id: 'personalization', label: 'Personalization', icon: Palette },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'integrations', label: 'Integrations', icon: Zap },
    { id: 'organization', label: 'Organization', icon: Building2 },
    { id: 'billing', label: 'Billing', icon: Database },
    { id: 'usage', label: 'Usage', icon: BarChart },
    { id: 'privacy', label: 'Privacy', icon: Shield },
    { id: 'memories', label: 'Memories', icon: Database },
  ];

  // Fetch settings on mount and when URL parameters change
  React.useEffect(() => {
    if (isOpen && session?.user) {
      fetchUserSettings();
      setEmail(session.user.email || '');

      // Check URL parameters for OAuth success/error
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('success')) {
        toast.success(decodeURIComponent(urlParams.get('success') || ''));
        setCalendarConnecting(false); // Reset connecting state
        // Clean up URL parameters
        const url = new URL(window.location.href);
        url.searchParams.delete('success');
        url.searchParams.delete('open_settings');
        window.history.replaceState({}, '', url.toString());
      }
      if (urlParams.get('error')) {
        toast.error(decodeURIComponent(urlParams.get('error') || ''));
        setCalendarConnecting(false); // Reset connecting state
        // Clean up URL parameters
        const url = new URL(window.location.href);
        url.searchParams.delete('error');
        url.searchParams.delete('open_settings');
        window.history.replaceState({}, '', url.toString());
      }
    }
  }, [isOpen, session]);

  // Also sync with global settings when they change
  React.useEffect(() => {
    if (globalUserSettings && isOpen) {
      setSettings((prev) => ({
        ...prev,
        displayName: globalUserSettings.displayName || '',
        profilePicture: globalUserSettings.profilePicture || '',
        companyName: globalUserSettings.companyName || '',
        companyType: globalUserSettings.companyType || '',
        companyDescription: globalUserSettings.companyDescription || '',
        companyIndustry: globalUserSettings.companyIndustry || '',
        companySize: globalUserSettings.companySize || '',
        companyWebsite: globalUserSettings.companyWebsite || '',
        companyCountry: globalUserSettings.companyCountry || '',
        companyState: globalUserSettings.companyState || '',
        language: globalUserSettings.language || 'english',
        fontSize: globalUserSettings.fontSize || 'medium',
        notificationsEnabled: globalUserSettings.notificationsEnabled ?? true,
        autocompleteEnabled: globalUserSettings.autocompleteEnabled ?? true,
      }));
    }
  }, [globalUserSettings, isOpen]);

  const fetchUserSettings = async () => {
    try {
      setLoading(true);

      // Fetch user settings and calendar status in parallel
      const [settingsResponse, calendarResponse] = await Promise.all([
        fetch('/api/user-settings'),
        fetch('/api/calendar/status'),
      ]);

      const settingsData = settingsResponse.ok
        ? await settingsResponse.json()
        : {};
      const calendarData = calendarResponse.ok
        ? await calendarResponse.json()
        : { connected: false };

      console.log('Fetched settings data:', settingsData);

      setSettings({
        displayName: settingsData.displayName || '',
        profilePicture: settingsData.profilePicture || '',
        companyName: settingsData.companyName || '',
        companyType: settingsData.companyType || '',
        companyDescription: settingsData.companyDescription || '',
        companyIndustry: settingsData.companyIndustry || '',
        companySize: settingsData.companySize || '',
        companyWebsite: settingsData.companyWebsite || '',
        companyCountry: settingsData.companyCountry || '',
        companyState: settingsData.companyState || '',
        language: settingsData.language || 'english',
        fontSize: settingsData.fontSize || 'medium',
        notificationsEnabled: settingsData.notificationsEnabled ?? true,
        // new toggle
        autocompleteEnabled: settingsData.autocompleteEnabled ?? true,
        googleCalendarConnected: calendarData.connected ?? false,
      });
    } catch (error) {
      console.error('Failed to fetch settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveChanges = async () => {
    try {
      setLoading(true);

      // Log what we're sending
      console.log('Saving settings:', settings);

      // Remove googleCalendarConnected from settings as it's not a user setting
      const { googleCalendarConnected, ...settingsToSave } = settings;

      // Update through the context to trigger global updates
      await updateGlobalSettings(settingsToSave);

      toast.success('Settings saved successfully');

      if (updateUISettings) {
        updateUISettings((prev) => ({
          ...prev,
          fontSize: settings.fontSize || 'medium',
        }));
      }

      if (settings.displayName) {
        await updateSession({ displayName: settings.displayName });
      }

      if (settings.profilePicture) {
        await updateSession({ profilePicture: settings.profilePicture });
      }

      onClose();
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  const handleProfilePictureChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    setCropperImage(url);
    setIsCropperOpen(true);
  };

  const handleCroppedImageUpload = async (
    croppedAreaPixels: any,
    croppedBlob: Blob,
  ) => {
    try {
      setUploadingImage(true);
      setIsCropperOpen(false);

      const formData = new FormData();
      formData.append('file', croppedBlob, 'profile.jpg');

      const response = await fetch('/api/user/profile-picture', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setSettings((prev) => ({ ...prev, profilePicture: data.url }));

        // Update global settings context immediately
        await updateGlobalSettings({ profilePicture: data.url });

        toast.success('Profile picture updated');
        await updateSession({ profilePicture: data.url });
      } else {
        throw new Error('Failed to upload');
      }
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      toast.error('Failed to upload profile picture');
    } finally {
      setUploadingImage(false);
      if (cropperImage) {
        URL.revokeObjectURL(cropperImage);
        setCropperImage(null);
      }
    }
  };

  const handleUpdatePassword = async () => {
    setPasswordError('');

    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/account/update-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (response.ok) {
        toast.success('Password updated successfully');
        setCurrentPassword('');
        setNewPassword('');
      } else {
        const data = await response.json();
        setPasswordError(data.error || 'Failed to update password');
      }
    } catch (error) {
      console.error('Error updating password:', error);
      setPasswordError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleCalendarAuth = async () => {
    try {
      setCalendarConnecting(true);
      localStorage.setItem('calendarAuthReturnTo', window.location.href);
      toast.success('Redirecting to Google authentication...');

      // Small delay to show the loading state
      await new Promise((resolve) => setTimeout(resolve, 500));

      window.location.href = '/api/calendar/auth';
    } catch (error) {
      console.error('Failed to initiate Google Calendar auth:', error);
      toast.error('Failed to connect to Google Calendar');
      setCalendarConnecting(false);
    }
  };

  const handleGoogleCalendarDisconnect = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/calendar/disconnect', {
        method: 'POST',
      });

      if (response.ok) {
        setSettings((prev) => ({ ...prev, googleCalendarConnected: false }));
        toast.success('Google Calendar disconnected successfully');

        // Refresh the connection status to ensure UI is accurate
        setTimeout(() => {
          fetchUserSettings();
        }, 1000);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to disconnect');
      }
    } catch (error) {
      console.error('Failed to disconnect Google Calendar:', error);
      toast.error(
        error instanceof Error
          ? error.message
          : 'Failed to disconnect Google Calendar',
      );
    } finally {
      setLoading(false);
    }
  };

  // Privacy & Security handlers
  const handleExportData = async () => {
    try {
      setExportingData(true);
      const response = await fetch('/api/user/export-data');

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `eos-ai-data-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success('Data exported successfully');
      } else {
        throw new Error('Failed to export data');
      }
    } catch (error) {
      console.error('Error exporting data:', error);
      toast.error('Failed to export data');
    } finally {
      setExportingData(false);
    }
  };

  const handleClearChatHistory = async () => {
    try {
      setClearingHistory(true);
      const response = await fetch('/api/user/clear-history', {
        method: 'POST',
      });

      if (response.ok) {
        toast.success('Chat history cleared successfully');
        // Refresh the page to update the UI
        window.location.reload();
      } else {
        throw new Error('Failed to clear chat history');
      }
    } catch (error) {
      console.error('Error clearing chat history:', error);
      toast.error('Failed to clear chat history');
    } finally {
      setClearingHistory(false);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      setDeletingAccount(true);
      const response = await fetch('/api/user/delete-account', {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Account deletion initiated. You will be logged out.');
        // Redirect to logout
        window.location.href = '/api/auth/signout';
      } else {
        throw new Error('Failed to delete account');
      }
    } catch (error) {
      console.error('Error deleting account:', error);
      toast.error('Failed to delete account');
    } finally {
      setDeletingAccount(false);
      setShowDeleteConfirm(false);
    }
  };

  const fetchDataStats = async () => {
    try {
      const response = await fetch('/api/user/data-stats');
      if (response.ok) {
        const stats = await response.json();
        setDataStats(stats);
      }
    } catch (error) {
      console.error('Error fetching data stats:', error);
    }
  };

  // Fetch data stats when privacy section is opened
  React.useEffect(() => {
    if (isOpen && activeSection === 'privacy') {
      fetchDataStats();
    }
  }, [isOpen, activeSection]);

  return (
    <>
      <AnimatedModal isOpen={isOpen} onClose={onClose}>
        <div
          className="relative bg-background/80 rounded-2xl border border-white/30 dark:border-zinc-700/30 shadow-enhanced backdrop-blur-[16px] settings-modal"
          style={{
            width: 'min(1100px, 95vw)',
            height: 'min(80vh, 700px)',
            maxWidth: '100%',
          }}
        >
          <div
            className="absolute inset-0 settings-modal-grid overflow-hidden"
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(180px, 224px) minmax(300px, 1fr)',
            }}
          >
            {/* Sidebar */}
            <div className="bg-muted/30 p-4 border-r overflow-y-auto">
              <h2 className="text-lg font-semibold mb-4">Settings</h2>
              <nav className="space-y-1">
                {navigationItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveSection(item.id)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                      activeSection === item.id
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted',
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </button>
                ))}
              </nav>
            </div>

            {/* Content */}
            <div className="flex flex-col min-w-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto overflow-x-hidden p-6">
                <div className="max-w-xl mx-auto w-full">
                  {/* Profile Section */}
                  {activeSection === 'profile' && (
                    <div>
                      <h3 className="text-xl font-semibold mb-6">Profile</h3>
                      <div className="space-y-6">
                        {/* Profile Picture */}
                        <div className="flex items-center gap-4 mb-6">
                          <div className="relative flex-shrink-0">
                            <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                              {settings.profilePicture ? (
                                <Image
                                  src={settings.profilePicture}
                                  alt="Profile"
                                  fill
                                  className="object-cover"
                                />
                              ) : (
                                <UserCircle className="h-12 w-12 text-muted-foreground" />
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className="absolute bottom-0 right-0 h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center"
                              disabled={uploadingImage}
                            >
                              <Camera className="h-3 w-3" />
                            </button>
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept="image/*"
                              onChange={handleProfilePictureChange}
                              className="hidden"
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium">
                              Profile Picture
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Click the camera icon to upload
                            </p>
                          </div>
                        </div>

                        {/* Display Name */}
                        <div className="space-y-2">
                          <Label htmlFor="displayName">Display Name</Label>
                          <Input
                            id="displayName"
                            value={settings.displayName}
                            onChange={(e) =>
                              setSettings((prev) => ({
                                ...prev,
                                displayName: e.target.value,
                              }))
                            }
                            placeholder="How should we address you?"
                          />
                        </div>

                        {/* Email */}
                        <div className="space-y-2">
                          <Label htmlFor="email">Email Address</Label>
                          <div className="flex gap-2 min-w-0">
                            <Input
                              id="email"
                              type="email"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              disabled={session?.user?.type === 'guest'}
                              className="flex-1 min-w-0"
                            />
                            <Button
                              variant="outline"
                              type="button"
                              disabled={
                                loading ||
                                email === session?.user?.email ||
                                session?.user?.type === 'guest'
                              }
                              className="flex-shrink-0"
                            >
                              Update
                            </Button>
                          </div>
                        </div>

                        {/* Password */}
                        {session?.user?.type !== 'guest' && (
                          <div className="space-y-4 pt-4 border-t">
                            <h4 className="text-sm font-medium">
                              Change Password
                            </h4>
                            {passwordError && (
                              <p className="text-sm text-destructive">
                                {passwordError}
                              </p>
                            )}
                            <div className="space-y-2">
                              <Input
                                type="password"
                                placeholder="Current password"
                                value={currentPassword}
                                onChange={(e) =>
                                  setCurrentPassword(e.target.value)
                                }
                              />
                              <Input
                                type="password"
                                placeholder="New password (min 6 characters)"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                              />
                              <Button
                                onClick={handleUpdatePassword}
                                disabled={
                                  loading || !currentPassword || !newPassword
                                }
                                className="w-full"
                              >
                                Update Password
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Appearance Section */}
                  {activeSection === 'appearance' && (
                    <div>
                      <h3 className="text-xl font-semibold mb-6">Appearance</h3>
                      <div className="space-y-6">
                        {/* Theme */}
                        <div className="space-y-3">
                          <Label>Theme</Label>
                          <div className="grid grid-cols-3 gap-2 max-w-sm">
                            <Button
                              variant={
                                theme === 'light' ? 'default' : 'outline'
                              }
                              size="sm"
                              onClick={() => setTheme('light')}
                              className="flex items-center gap-2 justify-center"
                            >
                              <Sun className="h-4 w-4 flex-shrink-0" />
                              <span className="truncate">Light</span>
                            </Button>
                            <Button
                              variant={theme === 'dark' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => setTheme('dark')}
                              className="flex items-center gap-2 justify-center"
                            >
                              <Moon className="h-4 w-4 flex-shrink-0" />
                              <span className="truncate">Dark</span>
                            </Button>
                            <Button
                              variant={
                                theme === 'system' ? 'default' : 'outline'
                              }
                              size="sm"
                              onClick={() => setTheme('system')}
                              className="flex items-center gap-2 justify-center"
                            >
                              <Monitor className="h-4 w-4 flex-shrink-0" />
                              <span className="truncate">System</span>
                            </Button>
                          </div>
                        </div>

                        {/* Font Size */}
                        <div className="space-y-2">
                          <Label htmlFor="fontSize">Font Size</Label>
                          <Select
                            value={settings.fontSize}
                            onValueChange={(value) =>
                              setSettings((prev) => ({
                                ...prev,
                                fontSize: value,
                              }))
                            }
                          >
                            <SelectTrigger
                              id="fontSize"
                              className="w-full max-w-xs"
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="small">Small</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="large">Large</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Language */}
                        <div className="space-y-2">
                          <Label htmlFor="language">Language</Label>
                          <Select
                            value={settings.language}
                            onValueChange={(value) =>
                              setSettings((prev) => ({
                                ...prev,
                                language: value,
                              }))
                            }
                          >
                            <SelectTrigger
                              id="language"
                              className="w-full max-w-xs"
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="english">English</SelectItem>
                              <SelectItem value="spanish">Español</SelectItem>
                              <SelectItem value="french">Français</SelectItem>
                              <SelectItem value="german">Deutsch</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Notifications Section */}
                  {activeSection === 'notifications' && (
                    <div>
                      <h3 className="text-xl font-semibold mb-6">
                        Notifications
                      </h3>
                      <div className="space-y-6">
                        <div className="flex items-center justify-between gap-4">
                          <div className="min-w-0">
                            <p className="font-medium">Enable Notifications</p>
                            <p className="text-sm text-muted-foreground">
                              Receive notifications for important updates
                            </p>
                          </div>
                          <Switch
                            checked={settings.notificationsEnabled}
                            onCheckedChange={(checked) =>
                              setSettings((prev) => ({
                                ...prev,
                                notificationsEnabled: checked,
                              }))
                            }
                            className="flex-shrink-0"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Personalization Section (moved, combines appearance + company + autocomplete) */}
                  {activeSection === 'personalization' && (
                    <div>
                      <h3 className="text-xl font-semibold mb-6">
                        Personalization
                      </h3>
                      <div className="space-y-6">
                        {/* Predictive suggestions toggle */}
                        <div className="rounded-xl border bg-card p-4">
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex-1">
                              <div className="font-medium">
                                Predictive suggestions
                              </div>
                              <div className="text-sm text-muted-foreground">
                                Show autocomplete suggestions in new chats while
                                typing
                              </div>
                            </div>
                            <button
                              className="inline-flex items-center px-3 py-2 rounded-md border hover:bg-accent text-sm"
                              onClick={() =>
                                setSettings((prev) => ({
                                  ...prev,
                                  autocompleteEnabled:
                                    !prev.autocompleteEnabled,
                                }))
                              }
                              type="button"
                            >
                              {settings.autocompleteEnabled ? 'On' : 'Off'}
                            </button>
                          </div>
                        </div>

                        <Separator className="my-4" />

                        <h4 className="text-lg font-medium">Company</h4>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="companyName">Company Name</Label>
                            <Input
                              id="companyName"
                              value={settings.companyName}
                              onChange={(e) =>
                                setSettings((prev) => ({
                                  ...prev,
                                  companyName: e.target.value,
                                }))
                              }
                              placeholder="Your company name"
                              className="w-full"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="companyType">Company Type</Label>
                            <Select
                              value={settings.companyType}
                              onValueChange={(value) =>
                                setSettings((prev) => ({
                                  ...prev,
                                  companyType: value,
                                }))
                              }
                            >
                              <SelectTrigger
                                id="companyType"
                                className="w-full"
                              >
                                <SelectValue placeholder="Select type" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="corporation">
                                  Corporation
                                </SelectItem>
                                <SelectItem value="llc">LLC</SelectItem>
                                <SelectItem value="partnership">
                                  Partnership
                                </SelectItem>
                                <SelectItem value="nonprofit">
                                  Non-Profit
                                </SelectItem>
                                <SelectItem value="startup">Startup</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="companyDescription">
                              Description
                            </Label>
                            <Textarea
                              id="companyDescription"
                              value={settings.companyDescription}
                              onChange={(e) =>
                                setSettings((prev) => ({
                                  ...prev,
                                  companyDescription: e.target.value,
                                }))
                              }
                              placeholder="What does your company do?"
                              rows={4}
                              className="resize-none w-full"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="companyIndustry">Industry</Label>
                            <Select
                              value={settings.companyIndustry || ''}
                              onValueChange={(value) =>
                                setSettings((prev) => ({
                                  ...prev,
                                  companyIndustry: value,
                                }))
                              }
                            >
                              <SelectTrigger id="companyIndustry">
                                <SelectValue placeholder="Select your industry" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="technology">
                                  Technology
                                </SelectItem>
                                <SelectItem value="healthcare">
                                  Healthcare
                                </SelectItem>
                                <SelectItem value="finance">Finance</SelectItem>
                                <SelectItem value="manufacturing">
                                  Manufacturing
                                </SelectItem>
                                <SelectItem value="retail">Retail</SelectItem>
                                <SelectItem value="professional-services">
                                  Professional Services
                                </SelectItem>
                                <SelectItem value="education">
                                  Education
                                </SelectItem>
                                <SelectItem value="construction">
                                  Construction
                                </SelectItem>
                                <SelectItem value="real-estate">
                                  Real Estate
                                </SelectItem>
                                <SelectItem value="hospitality">
                                  Hospitality
                                </SelectItem>
                                <SelectItem value="transportation">
                                  Transportation
                                </SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="companySize">Company Size</Label>
                            <Select
                              value={settings.companySize || ''}
                              onValueChange={(value) =>
                                setSettings((prev) => ({
                                  ...prev,
                                  companySize: value,
                                }))
                              }
                            >
                              <SelectTrigger id="companySize">
                                <SelectValue placeholder="Select company size" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="1-10">
                                  1-10 employees
                                </SelectItem>
                                <SelectItem value="11-50">
                                  11-50 employees
                                </SelectItem>
                                <SelectItem value="51-200">
                                  51-200 employees
                                </SelectItem>
                                <SelectItem value="201-500">
                                  201-500 employees
                                </SelectItem>
                                <SelectItem value="501-1000">
                                  501-1000 employees
                                </SelectItem>
                                <SelectItem value="1000+">
                                  1000+ employees
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="companyWebsite">
                              Company Website
                            </Label>
                            <Input
                              id="companyWebsite"
                              type="url"
                              value={settings.companyWebsite}
                              onChange={(e) =>
                                setSettings((prev) => ({
                                  ...prev,
                                  companyWebsite: e.target.value,
                                }))
                              }
                              placeholder="https://www.example.com"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Headquarters Location</Label>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <Select
                                  value={settings.companyCountry || ''}
                                  onValueChange={(value) =>
                                    setSettings((prev) => ({
                                      ...prev,
                                      companyCountry: value,
                                    }))
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select country" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="us">
                                      United States
                                    </SelectItem>
                                    <SelectItem value="ca">Canada</SelectItem>
                                    <SelectItem value="uk">
                                      United Kingdom
                                    </SelectItem>
                                    <SelectItem value="au">
                                      Australia
                                    </SelectItem>
                                    <SelectItem value="de">Germany</SelectItem>
                                    <SelectItem value="fr">France</SelectItem>
                                    <SelectItem value="jp">Japan</SelectItem>
                                    <SelectItem value="cn">China</SelectItem>
                                    <SelectItem value="in">India</SelectItem>
                                    <SelectItem value="br">Brazil</SelectItem>
                                    <SelectItem value="mx">Mexico</SelectItem>
                                    <SelectItem value="other">Other</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Input
                                  value={settings.companyState}
                                  onChange={(e) =>
                                    setSettings((prev) => ({
                                      ...prev,
                                      companyState: e.target.value,
                                    }))
                                  }
                                  placeholder="State/Province"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Integrations Section */}
                  {activeSection === 'integrations' && (
                    <div>
                      <h3 className="text-xl font-semibold mb-6">
                        Integrations
                      </h3>
                      <div className="space-y-6">
                        {/* Google Calendar Integration */}
                        <div className="rounded-lg border bg-card">
                          <div className="p-6">
                            <div className="flex items-start gap-4">
                              <div className="flex-shrink-0 mt-1">
                                <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                                  <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                </div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                  <h4 className="font-semibold">
                                    Google Calendar
                                  </h4>
                                  {settings.googleCalendarConnected && (
                                    <div className="flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/20 rounded-full">
                                      <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
                                      <span className="text-xs text-green-700 dark:text-green-300 font-medium">
                                        Connected
                                      </span>
                                    </div>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                                  {settings.googleCalendarConnected
                                    ? 'Your Google Calendar is connected! You can now ask the AI to create events, check your schedule, and manage your calendar directly from the chat.'
                                    : 'Connect your Google Calendar to enable AI-powered calendar management. Create events, check your schedule, and get meeting reminders all through natural conversation.'}
                                </p>

                                {settings.googleCalendarConnected && (
                                  <div className="mb-4">
                                    <h5 className="text-sm font-medium mb-2">
                                      What you can do:
                                    </h5>
                                    <ul className="text-sm text-muted-foreground space-y-1">
                                      <li>
                                        • Create calendar events by describing
                                        them
                                      </li>
                                      <li>
                                        • Check your schedule and upcoming
                                        meetings
                                      </li>
                                      <li>
                                        • Get meeting summaries and reminders
                                      </li>
                                      <li>
                                        • Schedule meetings with natural
                                        language
                                      </li>
                                    </ul>
                                  </div>
                                )}

                                <div className="flex items-center gap-3">
                                  {settings.googleCalendarConnected ? (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={handleGoogleCalendarDisconnect}
                                      disabled={loading}
                                      className="flex-shrink-0"
                                    >
                                      <X className="h-4 w-4 mr-1" />
                                      Disconnect
                                    </Button>
                                  ) : (
                                    <Gate
                                      feature="calendar_connect"
                                      placement="settings:calendar"
                                      fallback={
                                        <UpgradePrompt
                                          feature="calendar_connect"
                                          placement="settings:calendar"
                                          onAutoRetry={() => {
                                            handleGoogleCalendarAuth();
                                          }}
                                          cta="Upgrade to Connect"
                                          className="flex-shrink-0"
                                        />
                                      }
                                    >
                                      <Button
                                        size="sm"
                                        onClick={handleGoogleCalendarAuth}
                                        disabled={
                                          loading ||
                                          calendarConnecting ||
                                          session?.user?.type === 'guest'
                                        }
                                        className="flex-shrink-0"
                                      >
                                        <Calendar className="h-4 w-4 mr-1" />
                                        {calendarConnecting
                                          ? 'Connecting...'
                                          : 'Connect Google Calendar'}
                                      </Button>
                                    </Gate>
                                  )}

                                  {session?.user?.type === 'guest' && (
                                    <p className="text-xs text-muted-foreground">
                                      Please sign up for a full account to use
                                      integrations
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Future Integrations Preview */}
                        <div className="rounded-lg border bg-muted/30 opacity-60">
                          <div className="p-6">
                            <div className="flex items-start gap-4">
                              <div className="flex-shrink-0 mt-1">
                                <div className="h-10 w-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                                  <Zap className="h-5 w-5 text-gray-500" />
                                </div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-semibold mb-2">
                                  More Integrations Coming Soon
                                </h4>
                                <p className="text-sm text-muted-foreground mb-4">
                                  We're working on additional integrations to
                                  make your workflow even more seamless.
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  <div className="px-3 py-1 bg-background rounded-full text-xs text-muted-foreground">
                                    Slack
                                  </div>
                                  <div className="px-3 py-1 bg-background rounded-full text-xs text-muted-foreground">
                                    Notion
                                  </div>
                                  <div className="px-3 py-1 bg-background rounded-full text-xs text-muted-foreground">
                                    Zoom
                                  </div>
                                  <div className="px-3 py-1 bg-background rounded-full text-xs text-muted-foreground">
                                    Microsoft Teams
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Billing Section */}
                  {activeSection === 'billing' && (
                    <div>
                      <h3 className="text-xl font-semibold mb-6">
                        Billing & Subscription
                      </h3>
                      <div className="space-y-6">
                        {/* Personal Subscription */}
                        {session?.user && !org && (
                          <div className="rounded-lg border bg-card p-6">
                            <div className="flex items-start gap-4">
                              <div className="flex-1 min-w-0">
                                <h4 className="font-semibold mb-2">
                                  Personal Subscription
                                </h4>
                                <p className="text-sm text-muted-foreground mb-4">
                                  Manage your personal subscription, payment
                                  method, or cancel.
                                </p>
                                <div className="mb-4 p-3 rounded-lg bg-muted">
                                  <p className="text-sm font-medium">
                                    Current Plan
                                  </p>
                                  <p className="text-lg font-bold capitalize">
                                    {accountUser?.plan || 'Free'}
                                  </p>
                                </div>
                                <Button
                                  onClick={async () => {
                                    try {
                                      const res = await fetch(
                                        '/api/billing/portal',
                                      );
                                      const data = await res
                                        .json()
                                        .catch(() => ({}));
                                      if (!res.ok || !data.url) {
                                        throw new Error(
                                          data?.error || 'Portal unavailable',
                                        );
                                      }
                                      window.location.href = data.url as string;
                                    } catch (e) {
                                      toast.error(
                                        'Unable to open billing portal',
                                      );
                                    }
                                  }}
                                  className="w-full sm:w-auto"
                                >
                                  Open Billing Portal
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Organization Subscription Notice */}
                        {org && (
                          <div className="rounded-lg border bg-card p-6">
                            <div className="flex items-start gap-4">
                              <div className="flex-1 min-w-0">
                                <h4 className="font-semibold mb-2">
                                  Organization Subscription
                                </h4>
                                <p className="text-sm text-muted-foreground mb-4">
                                  Your subscription is managed through your
                                  organization.
                                </p>
                                <div className="mb-4 p-3 rounded-lg bg-muted">
                                  <p className="text-sm font-medium">
                                    Organization
                                  </p>
                                  <p className="text-lg font-bold">
                                    Organization
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    {org?.plan.charAt(0).toUpperCase() +
                                      org?.plan.slice(1)}{' '}
                                    Plan
                                  </p>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  To manage billing, go to the Organization
                                  section or contact your organization owner.
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="rounded-lg border bg-muted/30 p-6">
                          <h4 className="font-semibold mb-2">
                            Testing Controls (local/dev)
                          </h4>
                          <p className="text-sm text-muted-foreground mb-4">
                            For manual testing, you can set your plan locally.
                            This only works in non‑production.
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={async () => {
                                try {
                                  const res = await fetch(
                                    '/api/billing/admin',
                                    {
                                      method: 'POST',
                                      headers: {
                                        'Content-Type': 'application/json',
                                      },
                                      body: JSON.stringify({
                                        action: 'set_plan',
                                        plan: 'free',
                                      }),
                                    },
                                  );
                                  if (!res.ok) throw new Error();
                                  toast.success('Plan set to Free');
                                  // Trigger account refresh instead of reload
                                  setTimeout(() => {
                                    const refreshEvent = new Event(
                                      'account-refresh',
                                    );
                                    window.dispatchEvent(refreshEvent);
                                  }, 400);
                                } catch {
                                  toast.error('Failed to set plan');
                                }
                              }}
                            >
                              Set Free
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={async () => {
                                try {
                                  const res = await fetch(
                                    '/api/billing/admin',
                                    {
                                      method: 'POST',
                                      headers: {
                                        'Content-Type': 'application/json',
                                      },
                                      body: JSON.stringify({
                                        action: 'set_plan',
                                        plan: 'pro',
                                      }),
                                    },
                                  );
                                  if (!res.ok) throw new Error();
                                  toast.success('Plan set to Pro');
                                  // Trigger account refresh instead of reload
                                  setTimeout(() => {
                                    const refreshEvent = new Event(
                                      'account-refresh',
                                    );
                                    window.dispatchEvent(refreshEvent);
                                  }, 400);
                                } catch {
                                  toast.error('Failed to set plan');
                                }
                              }}
                            >
                              Set Pro
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={async () => {
                                try {
                                  const res = await fetch(
                                    '/api/billing/admin',
                                    {
                                      method: 'POST',
                                      headers: {
                                        'Content-Type': 'application/json',
                                      },
                                      body: JSON.stringify({
                                        action: 'set_plan',
                                        plan: 'business',
                                      }),
                                    },
                                  );
                                  if (!res.ok) throw new Error();
                                  toast.success('Plan set to Business');
                                  // Trigger account refresh instead of reload
                                  setTimeout(() => {
                                    const refreshEvent = new Event(
                                      'account-refresh',
                                    );
                                    window.dispatchEvent(refreshEvent);
                                  }, 400);
                                } catch {
                                  toast.error('Failed to set plan');
                                }
                              }}
                            >
                              Set Business
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground mt-3">
                            Note: In production, use the Manage Subscription
                            button above.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Organization Section */}
                  {activeSection === 'organization' && (
                    <div>
                      <h3 className="text-xl font-semibold mb-6">
                        Organization Settings
                      </h3>
                      <OrganizationSettings />
                    </div>
                  )}

                  {/* Privacy Section */}
                  {activeSection === 'privacy' && (
                    <div>
                      <h3 className="text-xl font-semibold mb-6">
                        Privacy & Security
                      </h3>
                      <div className="space-y-6">
                        {/* Data Overview */}
                        <div className="rounded-lg border bg-card">
                          <div className="p-6">
                            <div className="flex items-start gap-4">
                              <div className="flex-shrink-0 mt-1">
                                <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                                  <Database className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                </div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-semibold mb-2">
                                  Your Data Overview
                                </h4>
                                <p className="text-sm text-muted-foreground mb-4">
                                  Here's a summary of the data associated with
                                  your account.
                                </p>

                                {dataStats ? (
                                  <div className="grid grid-cols-2 gap-4 mb-4">
                                    <div className="bg-background rounded-lg p-3">
                                      <div className="text-2xl font-bold text-primary">
                                        {dataStats.totalChats}
                                      </div>
                                      <div className="text-xs text-muted-foreground">
                                        Chat Conversations
                                      </div>
                                    </div>
                                    <div className="bg-background rounded-lg p-3">
                                      <div className="text-2xl font-bold text-primary">
                                        {dataStats.totalMessages}
                                      </div>
                                      <div className="text-xs text-muted-foreground">
                                        Messages
                                      </div>
                                    </div>
                                    <div className="bg-background rounded-lg p-3">
                                      <div className="text-2xl font-bold text-primary">
                                        {dataStats.totalDocuments}
                                      </div>
                                      <div className="text-xs text-muted-foreground">
                                        Documents
                                      </div>
                                    </div>
                                    <div className="bg-background rounded-lg p-3">
                                      <div className="text-2xl font-bold text-primary">
                                        {dataStats.accountAge}
                                      </div>
                                      <div className="text-xs text-muted-foreground">
                                        Days with us
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="animate-pulse grid grid-cols-2 gap-4 mb-4">
                                    {[
                                      'chats',
                                      'messages',
                                      'documents',
                                      'days',
                                    ].map((type) => (
                                      <div
                                        key={`stat-skeleton-${type}`}
                                        className="bg-background rounded-lg p-3"
                                      >
                                        <div className="h-6 bg-muted rounded mb-1" />
                                        <div className="h-3 bg-muted rounded w-2/3" />
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Data Export */}
                        <div className="rounded-lg border bg-card">
                          <div className="p-6">
                            <div className="flex items-start gap-4">
                              <div className="flex-shrink-0 mt-1">
                                <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                                  <Download className="h-5 w-5 text-green-600 dark:text-green-400" />
                                </div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-semibold mb-2">
                                  Export Your Data
                                </h4>
                                <p className="text-sm text-muted-foreground mb-4">
                                  Download a complete copy of your data
                                  including chats, messages, documents, and
                                  account information in JSON format.
                                </p>
                                <Gate
                                  feature="export"
                                  placement="settings:export"
                                  fallback={
                                    <UpgradePrompt
                                      feature="export"
                                      placement="settings:export"
                                      onAutoRetry={() => {
                                        void handleExportData();
                                      }}
                                      cta="Upgrade to Export"
                                      className="w-full sm:w-auto"
                                    />
                                  }
                                >
                                  <Button
                                    onClick={handleExportData}
                                    disabled={exportingData}
                                    className="w-full sm:w-auto"
                                  >
                                    <Download className="h-4 w-4 mr-2" />
                                    {exportingData
                                      ? 'Preparing Export...'
                                      : 'Download My Data'}
                                  </Button>
                                </Gate>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Data Management */}
                        <div className="rounded-lg border bg-card">
                          <div className="p-6">
                            <div className="flex items-start gap-4">
                              <div className="flex-shrink-0 mt-1">
                                <div className="h-10 w-10 rounded-lg bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center">
                                  <Trash2 className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                                </div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-semibold mb-2">
                                  Data Management
                                </h4>
                                <p className="text-sm text-muted-foreground mb-4">
                                  Manage your chat history and account data.
                                  These actions cannot be undone.
                                </p>

                                <div className="space-y-3">
                                  <Button
                                    variant="outline"
                                    onClick={handleClearChatHistory}
                                    disabled={clearingHistory}
                                    className="w-full sm:w-auto mr-2"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    {clearingHistory
                                      ? 'Clearing...'
                                      : 'Clear Chat History'}
                                  </Button>

                                  <div className="text-xs text-muted-foreground">
                                    This will permanently delete all your
                                    conversations and messages.
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Privacy Information */}
                        <div className="rounded-lg border bg-card">
                          <div className="p-6">
                            <div className="flex items-start gap-4">
                              <div className="flex-shrink-0 mt-1">
                                <div className="h-10 w-10 rounded-lg bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center">
                                  <Shield className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                                </div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-semibold mb-2">
                                  Data Protection
                                </h4>
                                <div className="space-y-3 text-sm text-muted-foreground">
                                  <div className="flex items-center gap-2">
                                    <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                                    <span>
                                      All data is encrypted in transit and at
                                      rest
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                                    <span>
                                      Chat history retained for 6 months maximum
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                                    <span>
                                      Account data deleted within 90 days of
                                      account deletion
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                                    <span>
                                      No data shared with third parties without
                                      consent
                                    </span>
                                  </div>
                                </div>

                                <div className="mt-4 pt-4 border-t">
                                  <div className="flex flex-wrap gap-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() =>
                                        window.open('/privacy-policy', '_blank')
                                      }
                                    >
                                      <ExternalLink className="h-4 w-4 mr-1" />
                                      Privacy Policy
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() =>
                                        window.open('/terms', '_blank')
                                      }
                                    >
                                      <ExternalLink className="h-4 w-4 mr-1" />
                                      Terms of Service
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Account Deletion */}
                        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20">
                          <div className="p-6">
                            <div className="flex items-start gap-4">
                              <div className="flex-shrink-0 mt-1">
                                <div className="h-10 w-10 rounded-lg bg-red-100 dark:bg-red-900/40 flex items-center justify-center">
                                  <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                                </div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-semibold mb-2 text-red-900 dark:text-red-100">
                                  Delete Account
                                </h4>
                                <p className="text-sm text-red-700 dark:text-red-300 mb-4">
                                  Permanently delete your account and all
                                  associated data. This action cannot be undone
                                  and will immediately log you out.
                                </p>

                                {!showDeleteConfirm ? (
                                  <Button
                                    variant="destructive"
                                    onClick={() => setShowDeleteConfirm(true)}
                                    className="w-full sm:w-auto"
                                    disabled={session?.user?.type === 'guest'}
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete My Account
                                  </Button>
                                ) : (
                                  <div className="space-y-3">
                                    <div className="p-3 bg-red-100 dark:bg-red-900/40 rounded-lg">
                                      <p className="text-sm font-medium text-red-900 dark:text-red-100 mb-2">
                                        Are you absolutely sure?
                                      </p>
                                      <p className="text-xs text-red-700 dark:text-red-300">
                                        This will permanently delete all your
                                        chats, documents, and account data. Type
                                        your email to confirm.
                                      </p>
                                    </div>
                                    <div className="flex gap-2">
                                      <Button
                                        variant="destructive"
                                        onClick={handleDeleteAccount}
                                        disabled={deletingAccount}
                                        size="sm"
                                      >
                                        {deletingAccount
                                          ? 'Deleting...'
                                          : 'Yes, Delete Everything'}
                                      </Button>
                                      <Button
                                        variant="outline"
                                        onClick={() =>
                                          setShowDeleteConfirm(false)
                                        }
                                        size="sm"
                                      >
                                        Cancel
                                      </Button>
                                    </div>
                                  </div>
                                )}

                                {session?.user?.type === 'guest' && (
                                  <p className="text-xs text-muted-foreground mt-2">
                                    Guest accounts are automatically cleaned up.
                                    No action needed.
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Usage Section */}
                  {activeSection === 'usage' && (
                    <div>
                      <h3 className="text-xl font-semibold mb-6">Usage</h3>
                      <div className="space-y-6">
                        <p className="text-sm text-muted-foreground">
                          Track your usage and limits for various features.
                        </p>

                        {/* Chat Usage */}
                        <div className="rounded-lg border bg-card">
                          <div className="p-6">
                            <div className="flex items-start gap-4">
                              <div className="flex-shrink-0 mt-1">
                                <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                                  <Database className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                </div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-semibold mb-2">
                                  Daily Chats
                                </h4>
                                <p className="text-sm text-muted-foreground mb-4">
                                  Number of chat messages sent today.
                                </p>
                                {accountUser && (
                                  <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                      <span className="text-sm font-medium">
                                        Usage:
                                      </span>
                                      <span className="text-2xl font-bold">
                                        {usageCounters?.chats_today ?? 0}
                                        {entitlements?.features.chats_per_day &&
                                        entitlements.features.chats_per_day > 0
                                          ? ` / ${entitlements.features.chats_per_day}`
                                          : ''}
                                      </span>
                                    </div>
                                    {entitlements?.features.chats_per_day &&
                                      entitlements.features.chats_per_day >
                                        0 && (
                                        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                                          <div
                                            className="bg-primary h-full transition-all"
                                            style={{
                                              width: `${Math.min(
                                                ((usageCounters?.chats_today ??
                                                  0) /
                                                  entitlements.features
                                                    .chats_per_day) *
                                                  100,
                                                100,
                                              )}%`,
                                            }}
                                          />
                                        </div>
                                      )}
                                    {!entitlements?.features.chats_per_day ||
                                    entitlements.features.chats_per_day <= 0 ? (
                                      <p className="text-xs text-muted-foreground">
                                        Unlimited chats available on your plan
                                      </p>
                                    ) : (
                                      <div className="flex items-center justify-between gap-2">
                                        <p className="text-xs text-muted-foreground">
                                          {entitlements.features.chats_per_day -
                                            (usageCounters?.chats_today ?? 0) >
                                          0
                                            ? `${entitlements.features.chats_per_day - (usageCounters?.chats_today ?? 0)} chats remaining today`
                                            : 'Daily limit reached. Resets at midnight.'}
                                        </p>
                                        {process.env.NODE_ENV !==
                                          'production' && (
                                          <button
                                            type="button"
                                            onClick={async () => {
                                              try {
                                                const res = await fetch(
                                                  '/api/debug/reset-usage',
                                                  {
                                                    method: 'POST',
                                                    headers: {
                                                      'Content-Type':
                                                        'application/json',
                                                    },
                                                    body: JSON.stringify({
                                                      scope: 'self',
                                                    }),
                                                  },
                                                );
                                                if (res.ok) {
                                                  window.location.reload();
                                                }
                                              } catch (error) {
                                                console.error(
                                                  'Failed to reset usage:',
                                                  error,
                                                );
                                              }
                                            }}
                                            className="text-xs text-blue-500 hover:text-blue-600 underline"
                                          >
                                            Reset
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Upload Usage */}
                        <div className="rounded-lg border bg-card">
                          <div className="p-6">
                            <div className="flex items-start gap-4">
                              <div className="flex-shrink-0 mt-1">
                                <div className="h-10 w-10 rounded-lg bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center">
                                  <Database className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                                </div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-semibold mb-2">
                                  Context Uploads
                                </h4>
                                <p className="text-sm text-muted-foreground mb-4">
                                  Total files uploaded for context (PDFs,
                                  documents, images, etc.).
                                </p>
                                {accountUser && (
                                  <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                      <span className="text-sm font-medium">
                                        Usage:
                                      </span>
                                      <span className="text-2xl font-bold">
                                        {usageCounters?.uploads_total ?? 0}
                                        {entitlements?.features
                                          .context_uploads_total &&
                                        entitlements.features
                                          .context_uploads_total > 0
                                          ? ` / ${entitlements.features.context_uploads_total}`
                                          : ''}
                                      </span>
                                    </div>
                                    {entitlements?.features
                                      .context_uploads_total &&
                                      entitlements.features
                                        .context_uploads_total > 0 && (
                                        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                                          <div
                                            className="bg-primary h-full transition-all"
                                            style={{
                                              width: `${Math.min(
                                                ((usageCounters?.uploads_total ??
                                                  0) /
                                                  entitlements.features
                                                    .context_uploads_total) *
                                                  100,
                                                100,
                                              )}%`,
                                            }}
                                          />
                                        </div>
                                      )}
                                    {!entitlements?.features
                                      .context_uploads_total ||
                                    entitlements.features
                                      .context_uploads_total <= 0 ? (
                                      <p className="text-xs text-muted-foreground">
                                        Unlimited uploads available on your plan
                                      </p>
                                    ) : (
                                      <p className="text-xs text-muted-foreground">
                                        {entitlements.features
                                          .context_uploads_total -
                                          (usageCounters?.uploads_total ?? 0) >
                                        0
                                          ? `${entitlements.features.context_uploads_total - (usageCounters?.uploads_total ?? 0)} uploads remaining`
                                          : 'Upload limit reached. Upgrade for more.'}
                                      </p>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Plan Information */}
                        <div className="rounded-lg border bg-muted/30">
                          <div className="p-6">
                            <h4 className="font-semibold mb-2">Your Plan</h4>
                            <p className="text-lg font-bold capitalize mb-2">
                              {accountUser?.plan || 'Free'}
                            </p>
                            {accountUser?.plan === 'free' && (
                              <p className="text-sm text-muted-foreground">
                                Upgrade to Pro or Business for unlimited usage
                                and advanced features.
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Memories Section */}
                  {activeSection === 'memories' && (
                    <div>
                      <h3 className="text-xl font-semibold mb-6">Memories</h3>
                      <MemoriesManager />
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="border-t p-4 flex justify-end gap-2">
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button onClick={handleSaveChanges} disabled={loading}>
                  {loading ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </AnimatedModal>

      {/* Image Cropper */}
      {cropperImage && isCropperOpen && (
        <ImageCropper
          image={cropperImage}
          onCropComplete={handleCroppedImageUpload}
          onCancel={() => {
            setIsCropperOpen(false);
            if (cropperImage) {
              URL.revokeObjectURL(cropperImage);
              setCropperImage(null);
            }
          }}
        />
      )}
    </>
  );
}
