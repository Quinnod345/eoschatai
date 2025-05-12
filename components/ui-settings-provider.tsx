'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
  useCallback,
} from 'react';

interface UISettings {
  fontSize: string;
}

interface UISettingsContextType {
  settings: UISettings;
  updateSettings: (settings: Partial<UISettings>) => void;
}

const defaultSettings: UISettings = {
  fontSize: 'medium',
};

const UISettingsContext = createContext<UISettingsContextType | undefined>(
  undefined,
);

export function useUISettings() {
  const context = useContext(UISettingsContext);
  if (!context) {
    throw new Error('useUISettings must be used within a UISettingsProvider');
  }
  return context;
}

interface UISettingsProviderProps {
  children: ReactNode;
}

export function UISettingsProvider({ children }: UISettingsProviderProps) {
  const [settings, setSettings] = useState<UISettings>(defaultSettings);
  const [isClient, setIsClient] = useState(false);

  // Load settings from localStorage on mount
  useEffect(() => {
    setIsClient(true);
    const savedSettings = localStorage.getItem('ui-settings');
    if (savedSettings) {
      try {
        const parsedSettings = JSON.parse(savedSettings);
        setSettings({ ...defaultSettings, ...parsedSettings });
      } catch (error) {
        console.error('Failed to parse UI settings:', error);
      }
    }

    // Initialize theme based on stored preference or system default
    const initializeTheme = () => {
      const storedTheme = localStorage.getItem('theme');

      if (storedTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else if (storedTheme === 'light') {
        document.documentElement.classList.remove('dark');
      } else {
        // Use system preference if no stored preference
        if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
    };

    initializeTheme();

    // Add listener for system preference changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleMediaChange = (e: MediaQueryListEvent) => {
      const storedTheme = localStorage.getItem('theme');
      // Only apply system preference changes if user hasn't set a preference
      if (!storedTheme) {
        if (e.matches) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
    };

    // Add listener for system preference changes
    mediaQuery.addEventListener('change', handleMediaChange);

    // Clean up
    return () => {
      mediaQuery.removeEventListener('change', handleMediaChange);
    };
  }, []);

  // Apply settings to the document as CSS variables
  useEffect(() => {
    if (!isClient) return;

    // Save to localStorage whenever settings change
    localStorage.setItem('ui-settings', JSON.stringify(settings));

    // Apply font size
    switch (settings.fontSize) {
      case 'small':
        document.documentElement.classList.add('text-size-small');
        document.documentElement.classList.remove(
          'text-size-medium',
          'text-size-large',
        );
        break;
      case 'large':
        document.documentElement.classList.add('text-size-large');
        document.documentElement.classList.remove(
          'text-size-small',
          'text-size-medium',
        );
        break;
      default:
        // Medium (default)
        document.documentElement.classList.add('text-size-medium');
        document.documentElement.classList.remove(
          'text-size-small',
          'text-size-large',
        );
        break;
    }
  }, [settings, isClient]);

  // Memoize the updateSettings function to prevent unnecessary rerenders
  const updateSettings = useCallback((newSettings: Partial<UISettings>) => {
    setSettings((current) => {
      // Only update if values are actually different
      const updatedSettings = { ...current };
      let hasChanges = false;

      Object.entries(newSettings).forEach(([key, value]) => {
        if (value !== undefined && current[key as keyof UISettings] !== value) {
          updatedSettings[key as keyof UISettings] = value as any;
          hasChanges = true;
        }
      });

      return hasChanges ? updatedSettings : current;
    });
  }, []);

  return (
    <UISettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </UISettingsContext.Provider>
  );
}
