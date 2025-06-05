import { useEffect, useCallback } from 'react';

interface UseEditShortcutsProps {
  onEditToggle?: () => void;
  onSave?: () => void;
  onCancel?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  isEditing?: boolean;
  enabled?: boolean;
}

export function useEditShortcuts({
  onEditToggle,
  onSave,
  onCancel,
  onUndo,
  onRedo,
  isEditing = false,
  enabled = true,
}: UseEditShortcutsProps) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modKey = isMac ? event.metaKey : event.ctrlKey;

      // Edit mode toggle: Cmd/Ctrl + E
      if (modKey && event.key === 'e' && !isEditing) {
        event.preventDefault();
        onEditToggle?.();
        return;
      }

      // Only process these shortcuts if in edit mode
      if (!isEditing) return;

      // Save: Cmd/Ctrl + S
      if (modKey && event.key === 's') {
        event.preventDefault();
        onSave?.();
        return;
      }

      // Submit: Cmd/Ctrl + Enter
      if (modKey && event.key === 'Enter') {
        event.preventDefault();
        onSave?.();
        return;
      }

      // Cancel: Escape
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel?.();
        return;
      }

      // Undo: Cmd/Ctrl + Z
      if (modKey && event.key === 'z' && !event.shiftKey) {
        event.preventDefault();
        onUndo?.();
        return;
      }

      // Redo: Cmd/Ctrl + Shift + Z or Cmd/Ctrl + Y
      if (
        (modKey && event.shiftKey && event.key === 'z') ||
        (modKey && event.key === 'y')
      ) {
        event.preventDefault();
        onRedo?.();
        return;
      }
    },
    [enabled, isEditing, onEditToggle, onSave, onCancel, onUndo, onRedo],
  );

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown, enabled]);

  // Return helper info for UI display
  const shortcuts = {
    edit: 'Cmd+E',
    save: 'Cmd+S',
    submit: 'Cmd+Enter',
    cancel: 'Esc',
    undo: 'Cmd+Z',
    redo: 'Cmd+Shift+Z',
  };

  const platformShortcuts = {
    edit: `${isMac() ? '⌘' : 'Ctrl+'}E`,
    save: `${isMac() ? '⌘' : 'Ctrl+'}S`,
    submit: `${isMac() ? '⌘' : 'Ctrl+'}↵`,
    cancel: 'Esc',
    undo: `${isMac() ? '⌘' : 'Ctrl+'}Z`,
    redo: `${isMac() ? '⌘⇧' : 'Ctrl+Shift+'}Z`,
  };

  return { shortcuts, platformShortcuts };
}

function isMac() {
  return navigator.platform.toUpperCase().indexOf('MAC') >= 0;
}
