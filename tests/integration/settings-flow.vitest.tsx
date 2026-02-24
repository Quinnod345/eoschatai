// @ts-nocheck
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock next-auth
vi.mock('next-auth/react', () => ({
  useSession: vi.fn(() => ({
    data: { user: { id: 'user1', email: 'test@example.com' } },
    status: 'authenticated'
  }))
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    refresh: vi.fn()
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/settings'
}));

// Mock settings context or hooks
const mockSettings = {
  theme: 'light',
  language: 'en',
  notifications: {
    email: true,
    push: false,
    mentions: true
  },
  privacy: {
    shareData: false,
    trackUsage: true
  },
  ai: {
    model: 'gpt-4',
    temperature: 0.7,
    maxTokens: 2000
  }
};

vi.mock('@/contexts/settings-context', () => ({
  useSettings: vi.fn(() => ({
    settings: mockSettings,
    updateSettings: vi.fn(),
    isLoading: false
  }))
}));

describe('Settings Flow Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
    
    // Mock localStorage
    global.localStorage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn()
    } as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('User Profile Settings', () => {
    it('should update user profile information', async () => {
      // Mock profile update API
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          id: 'user1',
          name: 'Updated Name',
          email: 'updated@example.com'
        })
      });

      const ProfileSettings = () => {
        const [profile, setProfile] = React.useState({
          name: 'John Doe',
          email: 'john@example.com',
          bio: 'Software developer'
        });
        const [updating, setUpdating] = React.useState(false);

        const handleUpdate = async () => {
          setUpdating(true);
          
          try {
            const response = await fetch('/api/user/profile', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(profile)
            });

            if (response.ok) {
              const updatedProfile = await response.json();
              setProfile(updatedProfile);
            }
          } finally {
            setUpdating(false);
          }
        };

        return (
          <div>
            <input
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              data-testid="name-input"
              placeholder="Full name"
            />
            <input
              value={profile.email}
              onChange={(e) => setProfile({ ...profile, email: e.target.value })}
              data-testid="email-input"
              placeholder="Email"
            />
            <textarea
              value={profile.bio}
              onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
              data-testid="bio-input"
              placeholder="Bio"
            />
            <button
              onClick={handleUpdate}
              disabled={updating}
              data-testid="update-button"
            >
              {updating ? 'Updating...' : 'Update Profile'}
            </button>
          </div>
        );
      };

      const { useState } = require('react');

      render(<ProfileSettings />);

      const nameInput = screen.getByTestId('name-input');
      const emailInput = screen.getByTestId('email-input');
      const updateButton = screen.getByTestId('update-button');

      fireEvent.change(nameInput, { target: { value: 'Updated Name' } });
      fireEvent.change(emailInput, { target: { value: 'updated@example.com' } });
      fireEvent.click(updateButton);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/user/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Updated Name',
            email: 'updated@example.com',
            bio: 'Software developer'
          })
        });
      });
    });

    it('should handle profile validation errors', async () => {
      // Mock validation error response
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({
          error: 'Invalid email format',
          field: 'email'
        })
      });

      const ProfileSettings = () => {
        const [email, setEmail] = React.useState('invalid-email');
        const [error, setError] = React.useState<string | null>(null);

        const handleUpdate = async () => {
          try {
            const response = await fetch('/api/user/profile', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email })
            });

            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error);
            }
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Update failed');
          }
        };

        return (
          <div>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              data-testid="email-input"
            />
            <button onClick={handleUpdate} data-testid="update-button">
              Update
            </button>
            {error && <div data-testid="error">{error}</div>}
          </div>
        );
      };

      const { useState } = require('react');

      render(<ProfileSettings />);

      const updateButton = screen.getByTestId('update-button');
      fireEvent.click(updateButton);

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Invalid email format');
      });
    });
  });

  describe('Theme and Appearance Settings', () => {
    it('should change theme and persist preference', async () => {
      const ThemeSettings = () => {
        const [theme, setTheme] = React.useState('light');

        const handleThemeChange = async (newTheme: string) => {
          setTheme(newTheme);
          localStorage.setItem('theme', newTheme);
          
          // Apply theme to document
          document.documentElement.setAttribute('data-theme', newTheme);
          
          // Save to backend
          await fetch('/api/user/settings', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ theme: newTheme })
          });
        };

        return (
          <div>
            <div data-testid="current-theme">Current theme: {theme}</div>
            <button
              onClick={() => handleThemeChange('dark')}
              data-testid="dark-theme-button"
            >
              Dark Theme
            </button>
            <button
              onClick={() => handleThemeChange('light')}
              data-testid="light-theme-button"
            >
              Light Theme
            </button>
          </div>
        );
      };

      const { useState } = require('react');
      global.fetch = vi.fn().mockResolvedValue({ ok: true });

      render(<ThemeSettings />);

      const darkButton = screen.getByTestId('dark-theme-button');
      fireEvent.click(darkButton);

      await waitFor(() => {
        expect(localStorage.setItem).toHaveBeenCalledWith('theme', 'dark');
        expect(fetch).toHaveBeenCalledWith('/api/user/settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ theme: 'dark' })
        });
        expect(screen.getByTestId('current-theme')).toHaveTextContent('Current theme: dark');
      });
    });

    it('should load theme from localStorage on mount', async () => {
      // Mock localStorage return value
      (localStorage.getItem as any).mockReturnValue('dark');

      const ThemeSettings = () => {
        const [theme, setTheme] = React.useState(() => {
          return localStorage.getItem('theme') || 'light';
        });

        return (
          <div data-testid="current-theme">Current theme: {theme}</div>
        );
      };

      const { useState } = require('react');

      render(<ThemeSettings />);

      expect(screen.getByTestId('current-theme')).toHaveTextContent('Current theme: dark');
    });
  });

  describe('Notification Settings', () => {
    it('should update notification preferences', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });

      const NotificationSettings = () => {
        const [notifications, setNotifications] = React.useState({
          email: true,
          push: false,
          mentions: true,
          updates: false
        });

        const handleToggle = async (setting: string, value: boolean) => {
          const updated = { ...notifications, [setting]: value };
          setNotifications(updated);

          await fetch('/api/user/notifications', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updated)
          });
        };

        return (
          <div>
            <label>
              <input
                type="checkbox"
                checked={notifications.email}
                onChange={(e) => handleToggle('email', e.target.checked)}
                data-testid="email-notifications"
              />
              Email notifications
            </label>
            <label>
              <input
                type="checkbox"
                checked={notifications.push}
                onChange={(e) => handleToggle('push', e.target.checked)}
                data-testid="push-notifications"
              />
              Push notifications
            </label>
          </div>
        );
      };

      const { useState } = require('react');

      render(<NotificationSettings />);

      const pushCheckbox = screen.getByTestId('push-notifications');
      fireEvent.click(pushCheckbox);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/user/notifications', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: true,
            push: true,
            mentions: true,
            updates: false
          })
        });
      });
    });
  });

  describe('AI Model Settings', () => {
    it('should update AI model preferences', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });

      const AISettings = () => {
        const [aiSettings, setAISettings] = React.useState({
          model: 'gpt-4',
          temperature: 0.7,
          maxTokens: 2000,
          systemPrompt: 'You are a helpful assistant.'
        });

        const handleUpdate = async () => {
          await fetch('/api/user/ai-settings', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(aiSettings)
          });
        };

        return (
          <div>
            <select
              value={aiSettings.model}
              onChange={(e) => setAISettings({ ...aiSettings, model: e.target.value })}
              data-testid="model-select"
            >
              <option value="gpt-4">GPT-4</option>
              <option value="gpt-3.5">GPT-3.5</option>
              <option value="claude">Claude</option>
            </select>
            
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={aiSettings.temperature}
              onChange={(e) => setAISettings({ ...aiSettings, temperature: Number.parseFloat(e.target.value) })}
              data-testid="temperature-slider"
            />
            <span data-testid="temperature-value">{aiSettings.temperature}</span>

            <input
              type="number"
              value={aiSettings.maxTokens}
              onChange={(e) => setAISettings({ ...aiSettings, maxTokens: Number.parseInt(e.target.value) })}
              data-testid="max-tokens-input"
            />

            <button onClick={handleUpdate} data-testid="save-button">
              Save AI Settings
            </button>
          </div>
        );
      };

      const { useState } = require('react');

      render(<AISettings />);

      const modelSelect = screen.getByTestId('model-select');
      const temperatureSlider = screen.getByTestId('temperature-slider');
      const saveButton = screen.getByTestId('save-button');

      fireEvent.change(modelSelect, { target: { value: 'claude' } });
      fireEvent.change(temperatureSlider, { target: { value: '0.9' } });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/user/ai-settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'claude',
            temperature: 0.9,
            maxTokens: 2000,
            systemPrompt: 'You are a helpful assistant.'
          })
        });
      });
    });

    it('should validate AI settings values', async () => {
      const AISettings = () => {
        const [temperature, setTemperature] = React.useState(0.7);
        const [error, setError] = React.useState<string | null>(null);

        const handleTemperatureChange = (value: number) => {
          if (value < 0 || value > 2) {
            setError('Temperature must be between 0 and 2');
            return;
          }
          
          setError(null);
          setTemperature(value);
        };

        return (
          <div>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={temperature}
              onChange={(e) => handleTemperatureChange(Number.parseFloat(e.target.value))}
              data-testid="temperature-slider"
            />
            {error && <div data-testid="error">{error}</div>}
          </div>
        );
      };

      const { useState } = require('react');

      render(<AISettings />);

      const temperatureSlider = screen.getByTestId('temperature-slider');
      
      // Simulate invalid value (this would normally be prevented by the range input)
      fireEvent.change(temperatureSlider, { target: { value: '2.5' } });

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Temperature must be between 0 and 2');
      });
    });
  });

  describe('Privacy Settings', () => {
    it('should update privacy preferences', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });

      const PrivacySettings = () => {
        const [privacy, setPrivacy] = React.useState({
          dataSharing: false,
          analytics: true,
          personalization: true,
          thirdPartyIntegrations: false
        });

        const handleToggle = async (setting: string, value: boolean) => {
          const updated = { ...privacy, [setting]: value };
          setPrivacy(updated);

          await fetch('/api/user/privacy', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updated)
          });
        };

        return (
          <div>
            <label>
              <input
                type="checkbox"
                checked={privacy.dataSharing}
                onChange={(e) => handleToggle('dataSharing', e.target.checked)}
                data-testid="data-sharing"
              />
              Allow data sharing for product improvement
            </label>
            
            <label>
              <input
                type="checkbox"
                checked={privacy.analytics}
                onChange={(e) => handleToggle('analytics', e.target.checked)}
                data-testid="analytics"
              />
              Enable usage analytics
            </label>
          </div>
        );
      };

      const { useState } = require('react');

      render(<PrivacySettings />);

      const dataSharingCheckbox = screen.getByTestId('data-sharing');
      fireEvent.click(dataSharingCheckbox);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/user/privacy', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dataSharing: true,
            analytics: true,
            personalization: true,
            thirdPartyIntegrations: false
          })
        });
      });
    });
  });

  describe('Settings Persistence and Sync', () => {
    it('should load settings on component mount', async () => {
      // Mock settings API
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          theme: 'dark',
          language: 'es',
          notifications: { email: false, push: true }
        })
      });

      const SettingsLoader = () => {
        const [settings, setSettings] = React.useState<any>(null);
        const [loading, setLoading] = React.useState(true);

        useEffect(() => {
          const loadSettings = async () => {
            try {
              const response = await fetch('/api/user/settings');
              const data = await response.json();
              setSettings(data);
            } finally {
              setLoading(false);
            }
          };

          loadSettings();
        }, []);

        if (loading) return <div data-testid="loading">Loading settings...</div>;

        return (
          <div>
            <div data-testid="theme">Theme: {settings?.theme}</div>
            <div data-testid="language">Language: {settings?.language}</div>
          </div>
        );
      };

      const { useState, useEffect } = require('react');

      render(<SettingsLoader />);

      expect(screen.getByTestId('loading')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByTestId('theme')).toHaveTextContent('Theme: dark');
        expect(screen.getByTestId('language')).toHaveTextContent('Language: es');
      });
    });

    it('should sync settings across tabs', async () => {
      const SettingsSync = () => {
        const [theme, setTheme] = React.useState('light');

        useEffect(() => {
          const handleStorageChange = (e: StorageEvent) => {
            if (e.key === 'theme' && e.newValue) {
              setTheme(e.newValue);
            }
          };

          window.addEventListener('storage', handleStorageChange);
          return () => window.removeEventListener('storage', handleStorageChange);
        }, []);

        return (
          <div data-testid="theme">Current theme: {theme}</div>
        );
      };

      const { useState, useEffect } = require('react');

      render(<SettingsSync />);

      expect(screen.getByTestId('theme')).toHaveTextContent('Current theme: light');

      // Simulate storage change from another tab
      const storageEvent = new StorageEvent('storage', {
        key: 'theme',
        newValue: 'dark',
        oldValue: 'light'
      });
      
      window.dispatchEvent(storageEvent);

      await waitFor(() => {
        expect(screen.getByTestId('theme')).toHaveTextContent('Current theme: dark');
      });
    });
  });

  describe('Settings Export/Import', () => {
    it('should export settings as JSON', async () => {
      const mockSettings = {
        theme: 'dark',
        notifications: { email: true },
        aiSettings: { model: 'gpt-4' }
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockSettings)
      });

      const SettingsExport = () => {
        const handleExport = async () => {
          const response = await fetch('/api/user/settings/export');
          const settings = await response.json();
          
          const blob = new Blob([JSON.stringify(settings, null, 2)], { 
            type: 'application/json' 
          });
          
          // Create download link
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = 'settings.json';
          link.click();
          URL.revokeObjectURL(url);
        };

        return (
          <button onClick={handleExport} data-testid="export-button">
            Export Settings
          </button>
        );
      };

      // Mock URL.createObjectURL and related methods
      global.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
      global.URL.revokeObjectURL = vi.fn();
      const mockLink = { click: vi.fn(), href: '', download: '' };
      document.createElement = vi.fn().mockReturnValue(mockLink);

      render(<SettingsExport />);

      const exportButton = screen.getByTestId('export-button');
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/user/settings/export');
        expect(mockLink.click).toHaveBeenCalled();
      });
    });
  });
});