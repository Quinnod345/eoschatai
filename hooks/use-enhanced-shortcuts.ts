import { useEffect } from 'react';

interface ShortcutAction {
  key: string;
  action: () => void;
  description: string;
  category: string;
}

export function useEnhancedShortcuts(actions: ShortcutAction[]) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const { key, metaKey, ctrlKey, shiftKey, altKey } = event;
      const modifier = metaKey || ctrlKey;

      // Find matching shortcut
      const shortcut = actions.find((action) => {
        const parts = action.key.toLowerCase().split('+');
        const expectedKey = parts[parts.length - 1];
        const hasCmd = parts.includes('cmd') || parts.includes('ctrl');
        const hasShift = parts.includes('shift');
        const hasAlt = parts.includes('alt');

        return (
          key.toLowerCase() === expectedKey &&
          modifier === hasCmd &&
          shiftKey === hasShift &&
          altKey === hasAlt
        );
      });

      if (shortcut) {
        event.preventDefault();
        shortcut.action();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [actions]);
}

// Enhanced shortcuts for chat
export const createChatShortcuts = (callbacks: {
  openSearch?: () => void;
  newChat?: () => void;
  sendMessage?: () => void;
  openPersonaSelector?: () => void;
  showShortcuts?: () => void;
  toggleSidebar?: () => void;
  toggleTheme?: () => void;
  focusInput?: () => void;
  clearChat?: () => void;
}): ShortcutAction[] => [
  {
    key: 'cmd+k',
    action: () => callbacks.openSearch?.(),
    description: 'Open search',
    category: 'Navigation',
  },
  {
    key: 'cmd+n',
    action: () => callbacks.newChat?.(),
    description: 'New chat',
    category: 'Chat',
  },
  {
    key: 'cmd+enter',
    action: () => callbacks.sendMessage?.(),
    description: 'Send message',
    category: 'Chat',
  },
  {
    key: 'cmd+shift+p',
    action: () => callbacks.openPersonaSelector?.(),
    description: 'Switch persona',
    category: 'AI',
  },
  {
    key: 'cmd+/',
    action: () => callbacks.showShortcuts?.(),
    description: 'Show shortcuts',
    category: 'Help',
  },
  {
    key: 'cmd+b',
    action: () => callbacks.toggleSidebar?.(),
    description: 'Toggle sidebar',
    category: 'Navigation',
  },
  {
    key: 'cmd+shift+d',
    action: () => callbacks.toggleTheme?.(),
    description: 'Toggle theme',
    category: 'Interface',
  },
  {
    key: 'cmd+i',
    action: () => callbacks.focusInput?.(),
    description: 'Focus input',
    category: 'Chat',
  },
  {
    key: 'cmd+shift+c',
    action: () => callbacks.clearChat?.(),
    description: 'Clear chat',
    category: 'Chat',
  },
  {
    key: 'escape',
    action: () => {
      // Close any open modals or focus input
      const activeElement = document.activeElement as HTMLElement;
      activeElement?.blur?.();
      callbacks.focusInput?.();
    },
    description: 'Escape/Focus input',
    category: 'Navigation',
  },
];

// Enhanced navigation shortcuts
export const navigationShortcuts: ShortcutAction[] = [
  {
    key: 'cmd+[',
    action: () => {}, // Handled by useChatKeyboardNavigation
    description: 'Previous chat',
    category: 'Navigation',
  },
  {
    key: 'cmd+]',
    action: () => {}, // Handled by useChatKeyboardNavigation
    description: 'Next chat',
    category: 'Navigation',
  },
  {
    key: 'cmd+shift+[',
    action: () => {}, // Handled by useChatKeyboardNavigation
    description: 'First chat',
    category: 'Navigation',
  },
  {
    key: 'cmd+shift+]',
    action: () => {}, // Handled by useChatKeyboardNavigation
    description: 'Last chat',
    category: 'Navigation',
  },
];

export const getShortcutsByCategory = (shortcuts: ShortcutAction[]) => {
  return shortcuts.reduce(
    (acc, shortcut) => {
      if (!acc[shortcut.category]) {
        acc[shortcut.category] = [];
      }
      acc[shortcut.category].push(shortcut);
      return acc;
    },
    {} as Record<string, ShortcutAction[]>,
  );
};
