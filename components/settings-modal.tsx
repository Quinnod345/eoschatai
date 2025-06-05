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
import { toast } from '@/lib/toast-system';
import { useSession } from 'next-auth/react';
import { Separator } from '@/components/ui/separator';
import { useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { UserCircle, Calendar, ExternalLink } from 'lucide-react';
import Image from 'next/image';
import { ImageCropper } from '@/components/image-cropper';
import { AnimatedModal } from '@/components/ui/animated-modal';
import { useUISettings } from '@/components/ui-settings-provider';

// Custom styling to isolate the settings modal from global hover effects
const styles = {
  wrapper: 'settings-modal-wrapper',
  tabList: 'settings-tabs-list',
  tabTrigger: 'settings-tab-trigger',
  tabActive: 'settings-tab-active',
  tabContent: 'settings-tab-content',
  headerText: 'settings-header-text',
  normalText: 'settings-text',
  mutedText: 'settings-muted-text',
  formLabel: 'settings-form-label',
  cancelButton: 'settings-cancel-button',
  fixedHeight: 'settings-fixed-height',
  enhancedModal: 'settings-enhanced-modal',
  modalContent: 'settings-modal-content', // New class for consistent width
};

// Animation variants for staggered animations
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.07,
      delayChildren: 0.1,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      staggerChildren: 0.05,
      staggerDirection: -1,
    },
  },
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 24,
    },
  },
  exit: {
    y: -20,
    opacity: 0,
    transition: {
      duration: 0.2,
    },
  },
};

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
  profilePicture?: string;
  googleCalendarConnected?: boolean;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { data: session, update: updateSession } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = React.useState(false);
  const { settings: uiSettings, updateSettings: updateUISettings } =
    useUISettings();
  const [settings, setSettings] = React.useState<UserSettings>({
    notificationsEnabled: true,
    language: 'english',
    fontSize: 'medium',
    displayName: '',
    companyName: '',
    companyType: '',
    companyDescription: '',
    profilePicture: '',
    googleCalendarConnected: false,
  });
  const [activeTab, setActiveTab] = React.useState('profile');
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const settingsContainerRef = React.useRef<HTMLDivElement>(null);

  // Account management state
  const [email, setEmail] = React.useState('');
  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [passwordError, setPasswordError] = React.useState('');
  const [uploadingImage, setUploadingImage] = React.useState(false);

  // Add these state variables near the other state declarations
  const [cropperImage, setCropperImage] = React.useState<string | null>(null);
  const [isCropperOpen, setIsCropperOpen] = React.useState(false);
  const [blockOutsideClicks, setBlockOutsideClicks] = React.useState(false);

  // Add a state for the current theme
  const [currentTheme, setCurrentTheme] = React.useState<string>('system');

  // Initialize the theme state when the modal opens
  React.useEffect(() => {
    if (isOpen && typeof window !== 'undefined') {
      const storedTheme = localStorage.getItem('theme');
      setCurrentTheme(storedTheme || 'system');
    }
  }, [isOpen]);

  // Apply font size to the settings container based on the selected fontSize
  React.useEffect(() => {
    if (settingsContainerRef.current && settings.fontSize) {
      // Remove any previous font size classes
      settingsContainerRef.current.classList.remove(
        'text-sm',
        'text-base',
        'text-lg',
      );

      // Apply the appropriate font size class
      switch (settings.fontSize) {
        case 'small':
          settingsContainerRef.current.classList.add('text-sm');
          break;
        case 'medium':
          settingsContainerRef.current.classList.add('text-base');
          break;
        case 'large':
          settingsContainerRef.current.classList.add('text-lg');
          break;
        default:
          settingsContainerRef.current.classList.add('text-base');
      }
    }
  }, [settings.fontSize, isOpen]);

  // Add settings modal specific styling to the document
  React.useEffect(() => {
    // Create a style element if it doesn't exist already
    const id = 'settings-modal-styles';
    if (!document.getElementById(id)) {
      const styleEl = document.createElement('style');
      styleEl.id = id;
      styleEl.textContent = `
        /* Base styles for settings modal */
        .${styles.wrapper} * {
          color: var(--color-text) !important;
        }
        
        /* Define theme-aware variables */
        .${styles.wrapper} {
          --color-text: hsl(var(--foreground));
          --color-text-muted: hsl(var(--muted-foreground));
          --color-bg: hsl(var(--background));
          --color-bg-muted: hsl(var(--muted));
          --color-primary: hsl(var(--primary));
          --color-border: hsl(var(--border));
        }
        
        /* Fix modal width to be consistent across tabs */
        .${styles.modalContent} {
          width: 540px;
          max-width: calc(100vw - 32px);
        }
        
        /* Tab list styles */
        .${styles.tabList} {
          background-color: var(--color-bg-muted);
          border-radius: 0.375rem;
        }
        
        /* Tab trigger styles */
        .${styles.tabTrigger} {
          color: var(--color-text) !important;
          position: relative;
          z-index: 1;
        }
        
        /* Remove the tab trigger hover effect */
        .${styles.tabTrigger}:hover {
          color: var(--color-text) !important;
        }
        
        /* Active tab styling */
        .${styles.tabActive} {
          background-color: var(--color-bg);
          color: var(--color-text) !important;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }
        
        /* Text styles */
        .${styles.headerText} {
          color: var(--color-text) !important;
          font-weight: 500;
        }
        
        .${styles.normalText} {
          color: var(--color-text) !important;
        }
        
        .${styles.mutedText} {
          color: var(--color-text-muted) !important;
        }
        
        /* Remove hover color change */
        .${styles.mutedText}:hover {
          color: var(--color-text-muted) !important;
        }
        
        /* Form labels */
        .${styles.formLabel} {
          color: var(--color-text) !important;
        }
        
        /* Cancel button */
        .${styles.cancelButton}:hover {
          background-color: var(--color-bg-muted);
        }
        
        /* Fixed height content */
        .${styles.fixedHeight} {
          height: 450px;
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: var(--color-border) transparent;
        }
        
        /* Improve scrollbar styling */
        .${styles.fixedHeight}::-webkit-scrollbar {
          width: 6px;
        }
        
        .${styles.fixedHeight}::-webkit-scrollbar-track {
          background: transparent;
        }
        
        .${styles.fixedHeight}::-webkit-scrollbar-thumb {
          background-color: var(--color-border);
          border-radius: 3px;
        }
        
        /* Enhanced modal styling with shadows */
        .${styles.enhancedModal} {
          background-color: hsl(var(--background));
          border: 1px solid var(--color-border);
        }

        /* Fix switch toggle styling */
        .${styles.wrapper} [data-state="checked"] {
          background-color: hsl(var(--primary)) !important;
        }
        
        .${styles.wrapper} [data-state="unchecked"] {
          background-color: hsl(var(--muted)) !important;
        }

        .${styles.wrapper} [role="switch"] span {
          transform: translateX(0) !important;
          transition: transform 200ms ease-in-out !important;
        }

        .${styles.wrapper} [data-state="checked"] span {
          transform: translateX(1rem) !important;
        }

        /* Ensure dropdowns appear above other content */
        .select-content {
          z-index: 100;
        }

        /* Dark mode specific adjustments */
        @media (prefers-color-scheme: dark) {
          .${styles.enhancedModal} {
            box-shadow: inset 0px 0px 10px rgba(255, 255, 255, 0.03), 
                      0 8px 30px rgba(0, 0, 0, 0.5), 
                      0 2px 8px rgba(0, 0, 0, 0.4);
          }
        }

        /* Light mode specific adjustments */
        @media (prefers-color-scheme: light) {
          .${styles.enhancedModal} {
            box-shadow: inset 0px 0px 10px rgba(0, 0, 0, 0.05), 
                      0 8px 30px rgba(0, 0, 0, 0.15), 
                      0 2px 8px rgba(0, 0, 0, 0.1);
          }
        }
      `;
      document.head.appendChild(styleEl);
    }

    // Clean up style element when component unmounts
    return () => {
      const styleEl = document.getElementById(id);
      if (styleEl) {
        styleEl.remove();
      }
    };
  }, []);

  // Modify the handleProfilePictureChange function to block outside clicks
  const handleProfilePictureChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast.error(
        'Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.',
      );
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File too large. Maximum size is 5MB.');
      return;
    }

    // Block outside clicks when cropper opens
    setBlockOutsideClicks(true);

    // Create a URL for the image to show in the cropper
    const imageUrl = URL.createObjectURL(file);
    setCropperImage(imageUrl);
    setIsCropperOpen(true);

    // Reset the file input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Add a new function to handle the cropper close and restore outside click behavior
  const handleCropperClose = () => {
    setIsCropperOpen(false);
    setBlockOutsideClicks(false);
    if (cropperImage) {
      URL.revokeObjectURL(cropperImage);
      setCropperImage(null);
    }
  };

  // Modify the handleCroppedImageUpload function to restore outside click behavior
  const handleCroppedImageUpload = async (
    croppedAreaPixels: any,
    croppedBlob: Blob,
  ) => {
    try {
      setUploadingImage(true);
      setIsCropperOpen(false);
      setBlockOutsideClicks(false);

      // Validate the cropped blob
      if (!croppedBlob || croppedBlob.size === 0) {
        throw new Error('The cropped image is empty. Please try again.');
      }

      const formData = new FormData();
      formData.append('file', croppedBlob, 'profile.jpg');

      // Log upload size for debugging
      console.log(`Uploading profile picture: ${croppedBlob.size} bytes`);

      const response = await fetch('/api/user/profile-picture', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();

        if (!data.url) {
          throw new Error('No URL returned from server');
        }

        // Update state with the new profile picture URL
        updateSetting('profilePicture', data.url);

        // Also update settings in the database immediately
        await fetch('/api/user-settings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...settings,
            profilePicture: data.url,
          }),
        });

        toast.success('Profile picture updated');

        // Update session to reflect new profile picture
        await updateSession({ profilePicture: data.url });
      } else {
        let errorMessage = 'Failed to upload profile picture';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          // If the response isn't JSON, use status text
          errorMessage = `Server error: ${response.statusText || response.status}`;
        }
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      toast.error(
        error instanceof Error
          ? error.message
          : 'Failed to upload profile picture. Please try again.',
      );
    } finally {
      setUploadingImage(false);
      // Clean up the object URL
      if (cropperImage) {
        URL.revokeObjectURL(cropperImage);
        setCropperImage(null);
      }
    }
  };

  // Create helper functions to update specific settings
  const updateSetting = (key: keyof UserSettings, value: any) => {
    // Don't update if the value hasn't changed
    if (settings[key] === value) {
      return;
    }

    // Update local state
    setSettings((prev) => ({ ...prev, [key]: value }));

    // If we're updating the font size, update it in the UI context as well
    if (key === 'fontSize' && updateUISettings) {
      updateUISettings((prev) => ({ ...prev, fontSize: value }));
    }
  };

  // Modify the event listener for clicks outside the modal
  React.useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      // If we are explicitly blocking outside clicks (during cropper operation), do nothing
      if (blockOutsideClicks) return;

      // Check if the click was outside the modal content
      const modalContent = document.querySelector('.settings-modal-wrapper');
      const selectContent = document.querySelector('[role="listbox"]');
      const cropperUI = document.querySelector(
        '.reactEasyCrop_Container, .cropper-container',
      );
      const fileInputs = document.querySelectorAll('input[type="file"]');
      const modalDialogs = document.querySelectorAll('[role="dialog"]');

      // Check for dropdowns or popover elements
      const dropdownElements = document.querySelectorAll(
        '[data-state="open"], [data-radix-popper-content-wrapper]',
      );

      // Check if target is a file input or inside one
      const isFileInputTarget = Array.from(fileInputs).some(
        (input) => input === e.target || input.contains(e.target as Node),
      );

      // Check if the click is inside a dropdown
      const isInsideDropdown = Array.from(dropdownElements).some((dropdown) =>
        dropdown.contains(e.target as Node),
      );

      // Don't close if clicking within interactive elements
      if (
        modalContent?.contains(e.target as Node) ||
        selectContent?.contains(e.target as Node) ||
        cropperUI?.contains(e.target as Node) ||
        isFileInputTarget ||
        isInsideDropdown ||
        // Check if click target is within any dialog
        Array.from(modalDialogs).some((dialog) =>
          dialog.contains(e.target as Node),
        ) ||
        // Don't close when cropper is open
        isCropperOpen
      ) {
        return;
      }

      onClose();
    };

    // Add the event listener
    document.addEventListener('mousedown', handleClickOutside);

    // Clean up
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose, isCropperOpen, blockOutsideClicks]);

  // Wrap fetchUserSettings in useCallback
  const fetchUserSettings = React.useCallback(async () => {
    if (!session?.user) return;

    try {
      setLoading(true);
      const response = await fetch('/api/user-settings');

      if (response.ok) {
        const data = await response.json();

        const fetchedSettings = {
          notificationsEnabled: data.notificationsEnabled ?? true,
          language: data.language ?? 'english',
          fontSize: data.fontSize ?? 'medium',
          displayName: data.displayName ?? '',
          companyName: data.companyName ?? '',
          companyType: data.companyType ?? '',
          companyDescription: data.companyDescription ?? '',
          profilePicture: data.profilePicture ?? '',
          googleCalendarConnected: data.googleCalendarConnected ?? false,
        };

        // Set settings from database
        setSettings(fetchedSettings);

        // Also update UI settings with font size
        if (updateUISettings && fetchedSettings.fontSize) {
          updateUISettings((prev) => ({
            ...prev,
            fontSize: fetchedSettings.fontSize || 'medium',
          }));
        }
      }
    } catch (error) {
      console.error('Failed to fetch user settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, [session?.user, updateUISettings]);

  React.useEffect(() => {
    if (isOpen && session?.user) {
      fetchUserSettings();
      setEmail(session.user.email || '');
    }
  }, [isOpen, session, fetchUserSettings]);

  const handleSaveChanges = async () => {
    if (!session?.user) {
      toast.error('You must be logged in to save settings');
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
        toast.success('Settings saved successfully!');

        // Apply UI updates for font size
        if (updateUISettings) {
          updateUISettings((prev) => ({
            ...prev,
            fontSize: settings.fontSize || 'medium',
          }));
        }

        // Force a session update if display name was changed
        if (settings.displayName) {
          await updateSession({ displayName: settings.displayName });
        }

        onClose();
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save settings');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to save settings',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async () => {
    // Reset error state
    setPasswordError('');

    // Validation
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords don't match");
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return;
    }

    if (!currentPassword) {
      setPasswordError('Current password is required');
      return;
    }

    try {
      setLoading(true);

      const response = await fetch('/api/account/update-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      if (response.ok) {
        toast.success('Password updated successfully');

        // Reset password fields
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
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

  const handleUpdateEmail = async () => {
    if (!email || email === session?.user?.email) return;

    try {
      setLoading(true);

      const response = await fetch('/api/account/update-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      if (response.ok) {
        toast.success('Email updated successfully. Please sign in again.');

        // Force reload of session after email change
        router.refresh();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to update email');
      }
    } catch (error) {
      console.error('Error updating email:', error);
      toast.error('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Add a wrapped onClose handler that checks if we're in the middle of a profile picture edit
  const handleCloseRequest = () => {
    // If cropper is open or upload is in progress, ask for confirmation
    if (isCropperOpen || uploadingImage) {
      const confirmClose = window.confirm(
        'You are in the middle of editing your profile picture. Are you sure you want to close?',
      );

      if (!confirmClose) {
        return; // Don't close if user cancels
      }

      // Clean up resources if user confirms
      if (cropperImage) {
        URL.revokeObjectURL(cropperImage);
        setCropperImage(null);
      }
      setIsCropperOpen(false);
    }

    // Proceed with normal close
    onClose();

    // Dispatch event to notify that settings modal has closed
    window.dispatchEvent(new CustomEvent('settingsModalClosed'));
  };

  // Add a function to handle Google Calendar authentication
  const handleGoogleCalendarAuth = async () => {
    try {
      // Store current window location before redirecting
      localStorage.setItem('calendarAuthReturnTo', window.location.href);

      // Redirect to Google OAuth in the same window instead of opening a new tab
      window.location.href = '/api/calendar/auth';

      // Show a toast message
      toast.success('Redirecting to Google authentication...');
    } catch (error) {
      console.error('Failed to initiate Google Calendar auth:', error);
      toast.error('Failed to connect to Google Calendar');
    }
  };

  // Add a function to disconnect Google Calendar
  const handleGoogleCalendarDisconnect = async () => {
    try {
      setLoading(true);

      const response = await fetch('/api/calendar/disconnect', {
        method: 'POST',
      });

      if (response.ok) {
        updateSetting('googleCalendarConnected', false);
        toast.success('Google Calendar has been disconnected');
      } else {
        throw new Error('Failed to disconnect Google Calendar');
      }
    } catch (error) {
      console.error('Failed to disconnect Google Calendar:', error);
      toast.error('Failed to disconnect Google Calendar');
    } finally {
      setLoading(false);
    }
  };

  // Check Google Calendar connection status during fetch
  React.useEffect(() => {
    const checkCalendarConnection = async () => {
      try {
        const response = await fetch('/api/calendar/status');
        if (response.ok) {
          const { connected } = await response.json();
          updateSetting('googleCalendarConnected', connected);
        }
      } catch (error) {
        console.error('Failed to check Google Calendar status:', error);
      }
    };

    if (isOpen && session?.user) {
      checkCalendarConnection();
    }
  }, [isOpen, session]);

  React.useEffect(() => {
    if (isOpen) {
      // Check for success or error messages in URL
      const success = searchParams.get('success');
      const error = searchParams.get('error');

      if (success) {
        toast.success(success);

        // Refresh settings to show updated connection status
        fetchUserSettings();

        // Clear the query params
        const url = new URL(window.location.href);
        url.searchParams.delete('success');
        window.history.replaceState({}, '', url);
      }

      if (error) {
        toast.error(error);

        // Clear the query params
        const url = new URL(window.location.href);
        url.searchParams.delete('error');
        window.history.replaceState({}, '', url);
      }
    }
  }, [isOpen, searchParams]);

  // Add this effect to ensure proper return from OAuth
  React.useEffect(() => {
    // Check if we need to preserve the current URL for returning from OAuth
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const storedReturnTo = localStorage.getItem('calendarAuthReturnTo');

      // If we're navigating away and there's already a stored return URL
      // but the current page isn't the Google auth page, we should update it
      if (
        storedReturnTo &&
        !window.location.pathname.includes('/api/calendar/auth')
      ) {
        localStorage.setItem('calendarAuthReturnTo', window.location.href);
      }
    };

    // Only add this listener if the settings modal is open
    if (isOpen) {
      window.addEventListener('beforeunload', handleBeforeUnload);
    }

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isOpen]);

  return (
    <AnimatedModal
      isOpen={isOpen}
      onClose={handleCloseRequest}
      preventAutoClose={blockOutsideClicks || isCropperOpen}
    >
      {cropperImage && isCropperOpen && (
        <ImageCropper
          image={cropperImage}
          onCropComplete={handleCroppedImageUpload}
          onCancel={handleCropperClose}
        />
      )}
      <div
        ref={settingsContainerRef}
        className={cn(
          'p-6 pb-4',
          styles.wrapper,
          styles.enhancedModal,
          styles.modalContent,
        )}
      >
        <AlertDialogHeader>
          <AlertDialogTitle className={cn('text-xl', styles.headerText)}>
            Account Settings
          </AlertDialogTitle>
        </AlertDialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className={cn('w-full grid grid-cols-4', styles.tabList)}>
            <TabsTrigger
              value="profile"
              className={cn(
                styles.tabTrigger,
                activeTab === 'profile' && styles.tabActive,
              )}
            >
              Profile
            </TabsTrigger>
            <TabsTrigger
              value="preferences"
              className={cn(
                styles.tabTrigger,
                activeTab === 'preferences' && styles.tabActive,
              )}
            >
              Preferences
            </TabsTrigger>
            <TabsTrigger
              value="company"
              className={cn(
                styles.tabTrigger,
                activeTab === 'company' && styles.tabActive,
              )}
            >
              Company
            </TabsTrigger>
            <TabsTrigger
              value="integrations"
              className={cn(
                styles.tabTrigger,
                activeTab === 'integrations' && styles.tabActive,
              )}
            >
              Integrations
            </TabsTrigger>
          </TabsList>

          <div className={cn('mt-4 px-1', styles.fixedHeight)}>
            <AnimatePresence mode="wait">
              {activeTab === 'profile' && (
                <TabsContent
                  value="profile"
                  key="profile"
                  forceMount
                  className="w-full"
                >
                  <motion.div
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    variants={containerVariants}
                    className="space-y-6 pb-4"
                  >
                    {/* Profile and Account Overview in a cohesive layout */}
                    <div className="flex flex-col md:flex-row gap-6">
                      {/* Profile Picture Column */}
                      <motion.div
                        className="flex flex-col items-center space-y-3"
                        variants={itemVariants}
                      >
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleProfilePictureChange}
                          accept="image/*"
                          className="hidden"
                        />
                        <div className="relative">
                          <div
                            className={cn(
                              'h-28 w-28 rounded-full overflow-hidden border-2 border-border',
                              'transition-all duration-200 hover:shadow-md',
                              'flex items-center justify-center bg-muted/20',
                              'dark:border-muted',
                            )}
                            style={{
                              objectFit: 'cover',
                              borderRadius: '50%',
                            }}
                          >
                            {settings.profilePicture ? (
                              <Image
                                src={settings.profilePicture}
                                alt="Profile"
                                fill
                                className="object-cover rounded-full"
                                onError={(e) => {
                                  // If image fails to load, fall back to placeholder
                                  e.currentTarget.src =
                                    'https://via.placeholder.com/150?text=Profile';
                                }}
                              />
                            ) : (
                              <UserCircle className="h-20 w-20 text-muted-foreground/60" />
                            )}
                          </div>
                          <Button
                            size="sm"
                            className="absolute bottom-1 right-1 rounded-full size-8 p-0 shadow-md hover:shadow-lg transition-shadow"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploadingImage}
                          >
                            {uploadingImage ? (
                              <span className="animate-spin">↻</span>
                            ) : (
                              <span>✎</span>
                            )}
                          </Button>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs rounded-full px-3"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadingImage}
                        >
                          {uploadingImage ? 'Uploading...' : 'Change Photo'}
                        </Button>

                        {/* Account Type Badge */}
                        <div
                          className={cn(
                            'mt-2 px-3 py-1 rounded-full text-xs font-medium',
                            session?.user?.type !== 'guest'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200'
                              : 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-200',
                          )}
                        >
                          {session?.user?.type === 'guest'
                            ? 'Guest Account'
                            : 'Premium Account'}
                        </div>
                      </motion.div>

                      {/* Account Details Column */}
                      <motion.div
                        className="flex-1 space-y-4"
                        variants={itemVariants}
                      >
                        <div className="space-y-2">
                          <h3
                            className={cn(
                              'text-lg font-medium',
                              styles.headerText,
                            )}
                          >
                            Profile Information
                          </h3>
                          <div className="grid gap-4">
                            <motion.div
                              className="grid gap-2"
                              variants={itemVariants}
                            >
                              <Label
                                htmlFor="display-name"
                                className={styles.formLabel}
                              >
                                Display Name
                              </Label>
                              <Input
                                id="display-name"
                                placeholder="Your display name"
                                value={settings.displayName}
                                onChange={(e) =>
                                  updateSetting('displayName', e.target.value)
                                }
                                disabled={loading}
                                className="transition-shadow focus:shadow-sm"
                              />
                              <p className={cn(styles.mutedText, 'text-xs')}>
                                This is how your name will appear throughout the
                                application.
                              </p>
                            </motion.div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 mt-4">
                          <div className="bg-muted/10 rounded-lg p-3 border border-muted/20">
                            <div className="flex justify-between items-start">
                              <h4
                                className={cn(
                                  'text-sm font-medium',
                                  styles.headerText,
                                )}
                              >
                                Email
                              </h4>
                              {session?.user?.type !== 'guest' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 text-xs"
                                  onClick={() => {
                                    const emailField =
                                      document.getElementById('email');
                                    if (emailField) {
                                      emailField.focus();
                                    }
                                  }}
                                >
                                  Change
                                </Button>
                              )}
                            </div>
                            <p className={cn(styles.normalText, 'mt-1')}>
                              {session?.user?.email}
                            </p>
                          </div>

                          <div className="bg-muted/10 rounded-lg p-3 border border-muted/20">
                            <h4
                              className={cn(
                                'text-sm font-medium',
                                styles.headerText,
                              )}
                            >
                              Account ID
                            </h4>
                            <p
                              className={cn(
                                'text-xs mt-1 font-mono',
                                styles.mutedText,
                              )}
                            >
                              {session?.user?.id}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    </div>

                    {session?.user?.type === 'guest' && (
                      <motion.div
                        className="rounded-md border-dashed border border-yellow-300 bg-yellow-50 dark:bg-yellow-950 dark:border-yellow-800 p-4"
                        variants={itemVariants}
                      >
                        <div className="flex items-start">
                          <div className="shrink-0 mr-3">
                            <svg
                              width="20"
                              height="20"
                              viewBox="0 0 20 20"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <path
                                d="M9.99999 6.66669V10M9.99999 13.3334H10.0083M18.3333 10C18.3333 14.6024 14.6024 18.3334 9.99999 18.3334C5.39762 18.3334 1.66666 14.6024 1.66666 10C1.66666 5.39765 5.39762 1.66669 9.99999 1.66669C14.6024 1.66669 18.3333 5.39765 18.3333 10Z"
                                stroke="#D97706"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </div>
                          <div>
                            <h4
                              className={cn(
                                'font-medium text-sm',
                                styles.headerText,
                              )}
                            >
                              Limited Guest Account
                            </h4>
                            <p className={cn('text-sm mt-1', styles.mutedText)}>
                              You&apos;re using a temporary guest account. To
                              save your data permanently and access all
                              features, please register for a full account.
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* Email change section */}
                    <motion.div
                      className="space-y-4 pt-2"
                      variants={itemVariants}
                    >
                      <div className="flex items-center justify-between">
                        <h3
                          className={cn(
                            'text-lg font-medium',
                            styles.headerText,
                          )}
                        >
                          Email Address
                        </h3>
                        {session?.user?.type === 'guest' && (
                          <div className="bg-muted/20 text-xs px-2 py-1 rounded-full">
                            Locked
                          </div>
                        )}
                      </div>
                      <div className="grid gap-4">
                        <motion.div
                          className="grid gap-2"
                          variants={itemVariants}
                        >
                          <div className="flex space-x-2">
                            <Input
                              id="email"
                              type="email"
                              placeholder="Your email"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              disabled={
                                loading || session?.user?.type === 'guest'
                              }
                              className="transition-shadow focus:shadow-sm"
                            />
                            <Button
                              onClick={handleUpdateEmail}
                              disabled={
                                loading ||
                                email === session?.user?.email ||
                                session?.user?.type === 'guest'
                              }
                            >
                              Update
                            </Button>
                          </div>
                          {session?.user?.type === 'guest' && (
                            <p
                              className={cn(styles.mutedText, 'text-xs italic')}
                            >
                              Guest accounts cannot change their email. Please
                              register for a full account.
                            </p>
                          )}
                        </motion.div>
                      </div>
                    </motion.div>

                    <motion.div variants={itemVariants}>
                      <Separator className="my-4" />
                    </motion.div>

                    <motion.div className="space-y-4" variants={itemVariants}>
                      <div className="flex items-center justify-between">
                        <h3
                          className={cn(
                            'text-lg font-medium',
                            styles.headerText,
                          )}
                        >
                          Password
                        </h3>
                        {(session?.user?.type === 'guest' ||
                          session?.user?.email?.includes('guest-')) && (
                          <div className="bg-muted/20 text-xs px-2 py-1 rounded-full">
                            Locked
                          </div>
                        )}
                      </div>

                      {session?.user?.type === 'guest' ||
                      session?.user?.email?.includes('guest-') ? (
                        <p
                          className={cn(
                            styles.mutedText,
                            'text-sm bg-muted/10 rounded-lg p-3 border border-muted/20',
                          )}
                        >
                          Guest accounts cannot change their password. Please
                          register for a full account.
                        </p>
                      ) : (
                        <>
                          {passwordError && (
                            <div className="rounded-md bg-destructive/15 p-3">
                              <p className="text-sm text-destructive">
                                {passwordError}
                              </p>
                            </div>
                          )}
                          <div className="grid gap-4 bg-muted/10 rounded-lg p-4 border border-muted/20">
                            <motion.div
                              className="grid gap-2"
                              variants={itemVariants}
                            >
                              <Label
                                htmlFor="current-password"
                                className={styles.formLabel}
                              >
                                Current Password
                              </Label>
                              <Input
                                id="current-password"
                                type="password"
                                value={currentPassword}
                                onChange={(e) =>
                                  setCurrentPassword(e.target.value)
                                }
                                disabled={loading}
                                className="transition-shadow focus:shadow-sm"
                              />
                            </motion.div>

                            <motion.div
                              className="grid gap-2"
                              variants={itemVariants}
                            >
                              <Label
                                htmlFor="new-password"
                                className={styles.formLabel}
                              >
                                New Password
                              </Label>
                              <Input
                                id="new-password"
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                disabled={loading}
                                className="transition-shadow focus:shadow-sm"
                              />
                            </motion.div>

                            <motion.div
                              className="grid gap-2"
                              variants={itemVariants}
                            >
                              <Label
                                htmlFor="confirm-password"
                                className={styles.formLabel}
                              >
                                Confirm New Password
                              </Label>
                              <Input
                                id="confirm-password"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) =>
                                  setConfirmPassword(e.target.value)
                                }
                                disabled={loading}
                                className="transition-shadow focus:shadow-sm"
                              />
                            </motion.div>

                            <motion.div variants={itemVariants}>
                              <Button
                                onClick={handleUpdatePassword}
                                disabled={
                                  loading ||
                                  !currentPassword ||
                                  !newPassword ||
                                  !confirmPassword
                                }
                                className="mt-1"
                              >
                                Update Password
                              </Button>
                            </motion.div>
                          </div>
                        </>
                      )}
                    </motion.div>
                  </motion.div>
                </TabsContent>
              )}

              {activeTab === 'preferences' && (
                <TabsContent
                  value="preferences"
                  key="preferences"
                  forceMount
                  className="w-full"
                >
                  <motion.div
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    variants={containerVariants}
                    className="space-y-6 pb-4"
                  >
                    {/* Notifications Section */}
                    <motion.div className="space-y-4" variants={itemVariants}>
                      <h3
                        className={cn('text-lg font-medium', styles.headerText)}
                      >
                        Notifications
                      </h3>
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label
                            htmlFor="notification-toggle"
                            className={styles.formLabel}
                          >
                            Allow Notifications
                          </Label>
                          <p className={cn(styles.mutedText, 'text-xs')}>
                            Receive notifications for important updates
                          </p>
                        </div>
                        <Switch
                          id="notification-toggle"
                          checked={settings.notificationsEnabled}
                          onCheckedChange={(checked) =>
                            updateSetting('notificationsEnabled', checked)
                          }
                          disabled={loading}
                        />
                      </div>
                    </motion.div>

                    {/* Font Size Section */}
                    <motion.div
                      className="space-y-4 mt-6"
                      variants={itemVariants}
                    >
                      <h3
                        className={cn('text-lg font-medium', styles.headerText)}
                      >
                        Appearance
                      </h3>
                      <div className="grid gap-4">
                        {/* Font Size Setting - Updated to apply changes */}
                        <motion.div
                          className="grid gap-2"
                          variants={itemVariants}
                        >
                          <Label
                            htmlFor="fontSize"
                            className={styles.formLabel}
                          >
                            Font Size
                          </Label>
                          <Select
                            value={settings.fontSize}
                            onValueChange={(value) => {
                              updateSetting('fontSize', value);

                              // Apply the font size change immediately for preview
                              if (settingsContainerRef.current) {
                                settingsContainerRef.current.classList.remove(
                                  'text-sm',
                                  'text-base',
                                  'text-lg',
                                );

                                switch (value) {
                                  case 'small':
                                    settingsContainerRef.current.classList.add(
                                      'text-sm',
                                    );
                                    break;
                                  case 'medium':
                                    settingsContainerRef.current.classList.add(
                                      'text-base',
                                    );
                                    break;
                                  case 'large':
                                    settingsContainerRef.current.classList.add(
                                      'text-lg',
                                    );
                                    break;
                                }
                              }
                            }}
                            disabled={loading}
                          >
                            <SelectTrigger id="fontSize" className="w-full">
                              <SelectValue placeholder="Select font size" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="small">Small</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="large">Large</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className={cn(styles.mutedText, 'text-xs')}>
                            Changes the font size throughout the application.
                          </p>
                        </motion.div>

                        {/* Dark Mode Toggle */}
                        <motion.div
                          className="grid gap-2 mt-2"
                          variants={itemVariants}
                        >
                          <Label
                            htmlFor="theme-mode"
                            className={styles.formLabel}
                          >
                            Theme Mode
                          </Label>
                          <Select
                            value={currentTheme}
                            onValueChange={(value) => {
                              setCurrentTheme(value);
                              if (value === 'dark') {
                                document.documentElement.classList.add('dark');
                                localStorage.setItem('theme', 'dark');
                              } else if (value === 'light') {
                                document.documentElement.classList.remove(
                                  'dark',
                                );
                                localStorage.setItem('theme', 'light');
                              } else {
                                // System preference
                                localStorage.removeItem('theme');
                                if (
                                  window.matchMedia(
                                    '(prefers-color-scheme: dark)',
                                  ).matches
                                ) {
                                  document.documentElement.classList.add(
                                    'dark',
                                  );
                                } else {
                                  document.documentElement.classList.remove(
                                    'dark',
                                  );
                                }
                              }
                            }}
                          >
                            <SelectTrigger id="theme-mode">
                              <SelectValue placeholder="Select theme mode" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="light">Light</SelectItem>
                              <SelectItem value="dark">Dark</SelectItem>
                              <SelectItem value="system">
                                System Default
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <p className={cn(styles.mutedText, 'text-xs')}>
                            Choose between light, dark, or use your system
                            preference
                          </p>
                        </motion.div>
                      </div>
                    </motion.div>
                  </motion.div>
                </TabsContent>
              )}

              {activeTab === 'company' && (
                <TabsContent
                  value="company"
                  key="company"
                  forceMount
                  className="w-full"
                >
                  <motion.div
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    variants={containerVariants}
                    className="space-y-4"
                  >
                    <motion.div variants={itemVariants}>
                      <h3
                        className={cn('text-lg font-medium', styles.headerText)}
                      >
                        Company Context
                      </h3>
                    </motion.div>

                    <motion.div
                      className="grid gap-4"
                      variants={containerVariants}
                    >
                      <motion.div
                        className="grid gap-2"
                        variants={itemVariants}
                      >
                        <Label
                          htmlFor="company-name"
                          className={styles.formLabel}
                        >
                          Company Name
                        </Label>
                        <Input
                          id="company-name"
                          placeholder="Enter your company name"
                          value={settings.companyName}
                          onChange={(e) =>
                            updateSetting('companyName', e.target.value)
                          }
                          disabled={loading}
                        />
                      </motion.div>

                      <motion.div
                        className="grid gap-2"
                        variants={itemVariants}
                      >
                        <Label
                          htmlFor="company-type"
                          className={styles.formLabel}
                        >
                          Company Type
                        </Label>
                        <Select
                          value={settings.companyType}
                          onValueChange={(value) =>
                            updateSetting('companyType', value)
                          }
                          disabled={loading}
                        >
                          <SelectTrigger id="company-type">
                            <SelectValue placeholder="Select company type" />
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
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </motion.div>

                      <motion.div
                        className="grid gap-2"
                        variants={itemVariants}
                      >
                        <Label
                          htmlFor="company-description"
                          className={styles.formLabel}
                        >
                          About Your Company
                        </Label>
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
                      </motion.div>
                    </motion.div>
                  </motion.div>
                </TabsContent>
              )}

              {activeTab === 'integrations' && (
                <TabsContent
                  value="integrations"
                  key="integrations"
                  forceMount
                  className="w-full"
                >
                  <motion.div
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    variants={containerVariants}
                    className="space-y-6"
                  >
                    <motion.div variants={itemVariants}>
                      <h3
                        className={cn('text-lg font-medium', styles.headerText)}
                      >
                        External Integrations
                      </h3>
                      <p className={cn('text-sm', styles.mutedText)}>
                        Connect your accounts to enable additional AI features
                      </p>
                    </motion.div>

                    <motion.div
                      className="space-y-6"
                      variants={containerVariants}
                    >
                      {/* Google Calendar Integration Card */}
                      <motion.div
                        className="rounded-lg border border-border p-4 bg-muted/10"
                        variants={itemVariants}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                              <Calendar className="h-6 w-6 text-primary" />
                            </div>
                            <div>
                              <h4
                                className={cn(
                                  'text-base font-medium',
                                  styles.headerText,
                                )}
                              >
                                Google Calendar
                              </h4>
                              <p className={cn('text-sm', styles.mutedText)}>
                                {settings.googleCalendarConnected
                                  ? 'Connected. The AI can access and manage your calendar.'
                                  : 'Connect to allow the AI to check and update your calendar.'}
                              </p>
                            </div>
                          </div>
                          <div>
                            {settings.googleCalendarConnected ? (
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={handleGoogleCalendarDisconnect}
                                disabled={loading}
                              >
                                Disconnect
                              </Button>
                            ) : (
                              <Button
                                variant="default"
                                size="sm"
                                onClick={handleGoogleCalendarAuth}
                                disabled={
                                  loading || session?.user?.type === 'guest'
                                }
                                className="flex items-center gap-2"
                              >
                                <ExternalLink className="h-4 w-4" />
                                Connect
                              </Button>
                            )}
                          </div>
                        </div>

                        {settings.googleCalendarConnected && (
                          <div className="mt-3 pt-3 border-t border-border">
                            <div className="flex items-center justify-between">
                              <span
                                className={cn('text-sm', styles.normalText)}
                              >
                                Calendar access
                              </span>
                              <span className="text-xs px-2 py-1 rounded-full bg-green-500/10 text-green-600 dark:text-green-400">
                                Active
                              </span>
                            </div>
                          </div>
                        )}

                        {session?.user?.type === 'guest' &&
                          !settings.googleCalendarConnected && (
                            <div className="mt-3 pt-3 border-t border-border">
                              <p
                                className={cn(
                                  'text-xs italic',
                                  styles.mutedText,
                                )}
                              >
                                Guest accounts cannot connect to Google
                                Calendar. Please register for a full account.
                              </p>
                            </div>
                          )}
                      </motion.div>

                      {/* Information Card */}
                      <motion.div
                        className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4"
                        variants={itemVariants}
                      >
                        <div className="flex space-x-3">
                          <div className="flex-shrink-0">
                            <svg
                              width="20"
                              height="20"
                              viewBox="0 0 20 20"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <path
                                d="M9.99999 6.66669V10M9.99999 13.3334H10.0083M18.3333 10C18.3333 14.6024 14.6024 18.3334 9.99999 18.3334C5.39762 18.3334 1.66666 14.6024 1.66666 10C1.66666 5.39765 5.39762 1.66669 9.99999 1.66669C14.6024 1.66669 18.3333 5.39765 18.3333 10Z"
                                stroke="#D97706"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </div>
                          <div>
                            <h4
                              className={cn(
                                'text-sm font-medium',
                                styles.headerText,
                              )}
                            >
                              About Calendar Integration
                            </h4>
                            <p className={cn('text-xs mt-1', styles.mutedText)}>
                              When connected, the AI can check your calendar for
                              free times, schedule meetings, and help manage
                              your events when asked. Your calendar data is only
                              accessed when you explicitly ask for
                              calendar-related help.
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    </motion.div>
                  </motion.div>
                </TabsContent>
              )}
            </AnimatePresence>
          </div>
        </Tabs>

        <AlertDialogFooter>
          <Button
            variant="outline"
            onClick={handleCloseRequest}
            disabled={loading}
            className={cn(styles.cancelButton)}
          >
            Cancel
          </Button>
          <Button onClick={handleSaveChanges} disabled={loading}>
            {loading ? 'Saving...' : 'Save Changes'}
          </Button>
        </AlertDialogFooter>
      </div>
    </AnimatedModal>
  );
}
