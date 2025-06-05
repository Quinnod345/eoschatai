'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

interface UISettings {
  fontSize: string;
  // Add other UI settings here as needed
}

interface UISettingsContextType {
  settings: UISettings;
  updateSettings: React.Dispatch<React.SetStateAction<UISettings>>;
}

const defaultSettings: UISettings = {
  fontSize: 'medium',
};

const UISettingsContext = createContext<UISettingsContextType | undefined>(
  undefined,
);

export function UISettingsProvider({
  children,
}: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<UISettings>(defaultSettings);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load settings from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedSettings = localStorage.getItem('uiSettings');
      if (storedSettings) {
        try {
          const parsedSettings = JSON.parse(storedSettings);
          setSettings(parsedSettings);
        } catch (e) {
          console.error('Failed to parse UI settings from localStorage', e);
        }
      }
      setIsLoaded(true);
    }
  }, []);

  // Save settings to localStorage whenever they change
  useEffect(() => {
    if (isLoaded && typeof window !== 'undefined') {
      localStorage.setItem('uiSettings', JSON.stringify(settings));

      // Apply font size to body or root element
      const fontSizeClass =
        settings.fontSize === 'small'
          ? 'text-sm'
          : settings.fontSize === 'large'
            ? 'text-lg'
            : 'text-base';

      // Remove existing font size classes
      document.documentElement.classList.remove(
        'text-sm',
        'text-base',
        'text-lg',
      );
      // Add the new font size class
      document.documentElement.classList.add(fontSizeClass);
    }
  }, [settings, isLoaded]);

  return (
    <UISettingsContext.Provider
      value={{ settings, updateSettings: setSettings }}
    >
      {children}
    </UISettingsContext.Provider>
  );
}

export function useUISettings() {
  const context = useContext(UISettingsContext);
  if (context === undefined) {
    throw new Error('useUISettings must be used within a UISettingsProvider');
  }
  return context;
}
