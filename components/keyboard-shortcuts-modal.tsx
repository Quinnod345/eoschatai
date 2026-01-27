'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

type KeyboardShortcut = {
  id: string;
  keys: string[];
  description: string;
  isNew?: boolean;
};

type ShortcutCategory = {
  name: string;
  shortcuts: KeyboardShortcut[];
};

const KEYBOARD_SHORTCUTS: ShortcutCategory[] = [
  {
    name: 'Navigation',
    shortcuts: [
      {
        id: 'open-search',
        keys: ['Cmd', 'K'],
        description: 'Open search',
        isNew: true,
      },
      {
        id: 'toggle-sidebar',
        keys: ['Cmd', 'B'],
        description: 'Toggle sidebar',
        isNew: true,
      },
      {
        id: 'focus-input',
        keys: ['Cmd', 'I'],
        description: 'Focus input field',
        isNew: true,
      },
      {
        id: 'escape-focus',
        keys: ['Escape'],
        description: 'Escape/Focus input',
        isNew: true,
      },
      {
        id: 'keyboard-shortcuts',
        keys: ['Cmd', '/'],
        description: 'Show keyboard shortcuts',
        isNew: true,
      },
    ],
  },
  {
    name: 'Chat',
    shortcuts: [
      {
        id: 'new-chat',
        keys: ['Cmd', 'N'],
        description: 'Create new chat',
        isNew: true,
      },
      {
        id: 'send-message',
        keys: ['Cmd', 'Enter'],
        description: 'Send message',
        isNew: true,
      },
      {
        id: 'clear-chat',
        keys: ['Cmd', 'Shift', 'C'],
        description: 'Clear current chat',
        isNew: true,
      },
      {
        id: 'send-message-basic',
        keys: ['Enter'],
        description: 'Send message (basic)',
      },
      {
        id: 'new-line',
        keys: ['Shift', 'Enter'],
        description: 'Insert new line in message',
      },
      {
        id: 'stop-response',
        keys: ['Escape'],
        description: 'Stop AI response',
      },
    ],
  },
  {
    name: 'AI & Personas',
    shortcuts: [
      {
        id: 'switch-persona',
        keys: ['Cmd', 'Shift', 'P'],
        description: 'Switch persona',
        isNew: true,
      },
    ],
  },
  {
    name: 'Interface',
    shortcuts: [
      {
        id: 'toggle-theme',
        keys: ['Cmd', 'Shift', 'D'],
        description: 'Toggle dark/light theme',
        isNew: true,
      },
    ],
  },
  {
    name: 'Mentions & Autocomplete',
    shortcuts: [
      {
        id: 'mentions-down',
        keys: ['ArrowDown'],
        description: 'Navigate down in mentions dropdown',
      },
      {
        id: 'mentions-up',
        keys: ['ArrowUp'],
        description: 'Navigate up in mentions dropdown',
      },
      {
        id: 'mentions-select',
        keys: ['Enter'],
        description: 'Select mention',
      },
      {
        id: 'mentions-close',
        keys: ['Escape'],
        description: 'Close mentions dropdown',
      },
    ],
  },
];

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function KeyboardShortcutsModal({
  isOpen,
  onClose,
}: KeyboardShortcutsModalProps) {
  const [activeTab, setActiveTab] = useState<string>(
    KEYBOARD_SHORTCUTS[0].name,
  );

  // Detect if user is on Mac for displaying correct modifier keys
  const isMac =
    typeof window !== 'undefined' &&
    navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  const formatKey = (key: string) => {
    if (key === 'Cmd' && !isMac) return 'Ctrl';
    if (key === 'Cmd' && isMac) return '⌘';
    if (key === 'Shift') return '⇧';
    if (key === 'Alt') return '⌥';
    if (key === 'Ctrl') return isMac ? '⌃' : 'Ctrl';
    if (key === 'Enter') return '↵';
    if (key === 'Escape') return 'Esc';
    if (key === 'ArrowDown') return '↓';
    if (key === 'ArrowUp') return '↑';
    return key;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent size="lg" className="flex flex-col p-0">
        <div className="px-6 pt-6 pb-2">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              Keyboard Shortcuts
              <span className="text-xs bg-eos-orange text-white px-2 py-1 rounded-full">
                Enhanced
              </span>
            </DialogTitle>
            <DialogDescription>
              Keyboard shortcuts to help you navigate and use EOSAI more
              efficiently.
              <span className="text-eos-orange font-medium">
                {' '}
                New shortcuts are highlighted!
              </span>
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-6">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full mt-4"
          >
            <TabsList className="w-full justify-start mb-4 overflow-x-auto">
              {KEYBOARD_SHORTCUTS.map((category) => (
                <TabsTrigger
                  key={category.name}
                  value={category.name}
                  className="relative"
                >
                  {category.name}
                  {category.shortcuts.some((s) => s.isNew) && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-eos-orange rounded-full" />
                  )}
                </TabsTrigger>
              ))}
            </TabsList>

            {KEYBOARD_SHORTCUTS.map((category) => (
              <TabsContent key={category.name} value={category.name}>
                <div className="grid gap-3">
                  {category.shortcuts.map((shortcut) => (
                    <div
                      key={shortcut.id}
                      className={cn(
                        'flex items-center justify-between py-3 px-3 rounded-lg transition-colors',
                        shortcut.isNew
                          ? 'bg-eos-orange/5 border border-eos-orange/20'
                          : 'hover:bg-accent/50',
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {shortcut.description}
                        </span>
                        {shortcut.isNew && (
                          <span className="text-xs bg-eos-orange text-white px-1.5 py-0.5 rounded-full font-medium">
                            NEW
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {shortcut.keys.map((key, keyIndex, keys) => (
                          <span
                            key={`${shortcut.id}-${key}-${keyIndex}`}
                            className="flex items-center"
                          >
                            <kbd
                              className={cn(
                                'px-2 py-1 text-xs font-semibold border rounded shadow min-w-[24px] text-center',
                                shortcut.isNew
                                  ? 'bg-eos-orange/10 border-eos-orange/30 text-eos-orange'
                                  : 'bg-background border-border',
                              )}
                            >
                              {formatKey(key)}
                            </kbd>
                            {keyIndex < keys.length - 1 && (
                              <span className="mx-1 text-muted-foreground">
                                +
                              </span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>
            ))}
          </Tabs>

          <div className="mt-6 p-4 bg-muted/50 rounded-lg">
            <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
              💡 Pro Tips
            </h4>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>
                • Use{' '}
                <kbd className="px-1 py-0.5 bg-background border rounded text-xs">
                  Cmd+K
                </kbd>{' '}
                to quickly search through your chats and documents
              </li>
              <li>
                • Press{' '}
                <kbd className="px-1 py-0.5 bg-background border rounded text-xs">
                  Cmd+Shift+P
                </kbd>{' '}
                to switch between different EOS personas
              </li>
              <li>
                • Use{' '}
                <kbd className="px-1 py-0.5 bg-background border rounded text-xs">
                  Escape
                </kbd>{' '}
                to quickly focus the input field from anywhere
              </li>
              <li>
                • All shortcuts work across the entire application for
                consistent experience
              </li>
            </ul>
          </div>
        </div>

        <div className="px-6 pb-6 pt-4 border-t">
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
