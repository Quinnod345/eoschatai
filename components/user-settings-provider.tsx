'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { useSession } from 'next-auth/react';
import { toast } from '@/lib/toast-system';

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
  timezone?: string;
  fontSize?: string;
  notificationsEnabled?: boolean;
  autocompleteEnabled?: boolean;
  disableGlassEffects?: boolean;
}

interface UserSettingsContextType {
  settings: UserSettings;
  loading: boolean;
  updateSettings: (newSettings: Partial<UserSettings>) => Promise<void>;
  refreshSettings: () => Promise<void>;
}

const defaultSettings: UserSettings = {
  autocompleteEnabled: true,
  notificationsEnabled: true,
  language: 'english',
  timezone: 'UTC',
  fontSize: 'medium',
  disableGlassEffects: true,
};

const UserSettingsContext = createContext<UserSettingsContextType | undefined>(
  undefined,
);

export function UserSettingsProvider({
  children,
}: { children: React.ReactNode }) {
  const { status } = useSession();
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const lastSyncedTimezoneRef = useRef<string | null>(null);

  const getBrowserTimezone = useCallback((): string => {
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (typeof timezone === 'string' && timezone.trim().length > 0) {
        return timezone.trim();
      }
    } catch (error) {
      console.warn('Failed to resolve browser timezone:', error);
    }

    return 'UTC';
  }, []);

  const fetchSettings = useCallback(async () => {
    // Only fetch if user is authenticated
    if (status !== 'authenticated') {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/user-settings');
      if (response.ok) {
        const data = await response.json();
        console.log('Fetched user settings:', data);
        const mergedSettings = {
          ...defaultSettings,
          ...data,
        } as UserSettings;
        setSettings(mergedSettings);

        const browserTimezone = getBrowserTimezone();
        const storedTimezone =
          typeof mergedSettings.timezone === 'string' &&
          mergedSettings.timezone.trim().length > 0
            ? mergedSettings.timezone.trim()
            : 'UTC';

        // Keep timezone aligned automatically so local-day resets are accurate.
        if (
          browserTimezone !== storedTimezone &&
          lastSyncedTimezoneRef.current !== browserTimezone
        ) {
          const timezoneResponse = await fetch('/api/user-settings', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ timezone: browserTimezone }),
          });

          if (timezoneResponse.ok) {
            lastSyncedTimezoneRef.current = browserTimezone;
            setSettings((prev) => ({
              ...prev,
              timezone: browserTimezone,
            }));
          } else {
            console.warn('Failed to persist browser timezone');
          }
        }
      }
      // Silently ignore 401 errors - user is not authenticated
    } catch (error) {
      console.error('Failed to fetch user settings:', error);
    } finally {
      setLoading(false);
    }
  }, [getBrowserTimezone, status]);

  const updateSettings = useCallback(
    async (newSettings: Partial<UserSettings>) => {
      // Don't allow updates if not authenticated
      if (status !== 'authenticated') {
        console.warn('Cannot update settings: user not authenticated');
        return;
      }

      try {
        // Optimistically update local state
        setSettings((prev) => ({ ...prev, ...newSettings }));
        if (typeof newSettings.timezone === 'string') {
          lastSyncedTimezoneRef.current = newSettings.timezone;
        }

        const response = await fetch('/api/user-settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newSettings),
        });

        if (!response.ok) {
          if (typeof newSettings.timezone === 'string') {
            lastSyncedTimezoneRef.current = null;
          }
          // Revert on failure
          await fetchSettings();
          throw new Error('Failed to update settings');
        }

        const updatedData = await response.json();
        console.log('Updated user settings:', updatedData);
        setSettings(updatedData);
      } catch (error) {
        if (typeof newSettings.timezone === 'string') {
          lastSyncedTimezoneRef.current = null;
        }
        console.error('Error updating settings:', error);
        toast.error('Failed to update settings');
        throw error;
      }
    },
    [fetchSettings, status],
  );

  useEffect(() => {
    // Wait until session status is determined before fetching
    if (status === 'loading') {
      return;
    }
    fetchSettings();
  }, [fetchSettings, status]);

  return (
    <UserSettingsContext.Provider
      value={{
        settings,
        loading,
        updateSettings,
        refreshSettings: fetchSettings,
      }}
    >
      {children}
    </UserSettingsContext.Provider>
  );
}

export function useUserSettings() {
  const context = useContext(UserSettingsContext);
  if (context === undefined) {
    throw new Error(
      'useUserSettings must be used within a UserSettingsProvider',
    );
  }
  return context;
}
