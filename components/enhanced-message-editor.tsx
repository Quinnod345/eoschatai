'use client';

import type { Message } from 'ai';
import { Button } from './ui/button';
import {
  type Dispatch,
  type SetStateAction,
  useEffect,
  useRef,
  useState,
  useCallback,
} from 'react';
import { Textarea } from './ui/textarea';
import { deleteTrailingMessages } from '@/app/(chat)/actions';
import type { UseChatHelpers } from '@ai-sdk/react';
import { motion, } from 'framer-motion';
import {
  X,
  Check,
  Undo2,
  Redo2,
  Type,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useDebounceValue } from 'usehooks-ts';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { Badge } from './ui/badge';

export type EnhancedMessageEditorProps = {
  message: Message;
  setMode: Dispatch<SetStateAction<'view' | 'edit'>>;
  setMessages: UseChatHelpers['setMessages'];
  reload: UseChatHelpers['reload'];
  allMessages?: Message[];
};

interface EditHistory {
  content: string;
  timestamp: number;
}

export function EnhancedMessageEditor({
  message,
  setMode,
  setMessages,
  reload,
  allMessages = [],
}: EnhancedMessageEditorProps) {
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [draftContent, setDraftContent] = useState<string>(message.content);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [editHistory, setEditHistory] = useState<EditHistory[]>([
    { content: message.content, timestamp: Date.now() },
  ]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const [wordCount, setWordCount] = useState<number>(0);
  const [charCount, setCharCount] = useState<number>(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [debouncedContent] = useDebounceValue(draftContent, 1000);

  // Calculate statistics
  useEffect(() => {
    const words = draftContent
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0);
    setWordCount(words.length);
    setCharCount(draftContent.length);
  }, [draftContent]);

  // Auto-save functionality
  useEffect(() => {
    if (debouncedContent !== message.content && debouncedContent.trim()) {
      handleAutoSave();
    }
  }, [debouncedContent]);

  // Initial setup
  useEffect(() => {
    if (textareaRef.current) {
      adjustHeight();
      textareaRef.current.focus();
      // Place cursor at the end
      textareaRef.current.setSelectionRange(
        textareaRef.current.value.length,
        textareaRef.current.value.length,
      );
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Submit on Cmd/Ctrl + Enter
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !isSubmitting) {
        e.preventDefault();
        handleSubmit();
      }

      // Cancel on Escape
      if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
      }

      // Undo on Cmd/Ctrl + Z
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }

      // Redo on Cmd/Ctrl + Shift + Z
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'z') {
        e.preventDefault();
        handleRedo();
      }

      // Save on Cmd/Ctrl + S
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleAutoSave();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [draftContent, isSubmitting, historyIndex, editHistory]);

  const adjustHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight + 2,
        window.innerHeight * 0.5, // Max 50% of viewport height
      )}px`;
    }
  };

  const handleInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = event.target.value;
    setDraftContent(newContent);
    adjustHeight();

    // Add to history if significant change
    const lastHistoryContent = editHistory[historyIndex]?.content || '';
    if (
      Math.abs(newContent.length - lastHistoryContent.length) > 10 ||
      newContent.split(' ').length !== lastHistoryContent.split(' ').length
    ) {
      const newHistory = [
        ...editHistory.slice(0, historyIndex + 1),
        {
          content: newContent,
          timestamp: Date.now(),
        },
      ];
      setEditHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
    }
  };

  const handleAutoSave = useCallback(() => {
    setIsSaving(true);

    // Save to localStorage as backup
    const saveKey = `message-edit-${message.id}`;
    const saveData = {
      content: draftContent,
      timestamp: Date.now(),
      messageId: message.id,
    };

    try {
      localStorage.setItem(saveKey, JSON.stringify(saveData));
      setLastSaved(new Date());
      setIsSaving(false);

      // Clean up old saves (older than 24 hours)
      const allKeys = Object.keys(localStorage);
      const messageEditKeys = allKeys.filter((key) =>
        key.startsWith('message-edit-'),
      );
      const now = Date.now();
      const dayInMs = 24 * 60 * 60 * 1000;

      messageEditKeys.forEach((key) => {
        try {
          const data = JSON.parse(localStorage.getItem(key) || '{}');
          if (now - data.timestamp > dayInMs) {
            localStorage.removeItem(key);
          }
        } catch {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.error('Failed to auto-save:', error);
      setIsSaving(false);
    }
  }, [draftContent, message.id]);

  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setDraftContent(editHistory[newIndex].content);
      adjustHeight();
    }
  };

  const handleRedo = () => {
    if (historyIndex < editHistory.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setDraftContent(editHistory[newIndex].content);
      adjustHeight();
    }
  };

  const handleCancel = () => {
    // Check if there are unsaved changes
    if (draftContent !== message.content) {
      const confirmCancel = window.confirm(
        'You have unsaved changes. Are you sure you want to cancel?',
      );
      if (!confirmCancel) return;
    }

    // Clean up localStorage
    localStorage.removeItem(`message-edit-${message.id}`);
    setMode('view');
  };

  const handleSubmit = async () => {
    if (!draftContent.trim()) {
      toast.error('Message cannot be empty');
      return;
    }

    setIsSubmitting(true);

    try {
      // Try to delete trailing messages
      try {
        await deleteTrailingMessages({
          id: message.id,
        });
      } catch (deleteError: any) {
        // Check if error is due to pinned messages
        if (
          deleteError?.message?.includes('PinnedMessage') ||
          deleteError?.code === '23503'
        ) {
          const shouldContinue = window.confirm(
            'This will remove responses that may contain pinned messages. ' +
              'The pins will be removed. Do you want to continue?',
          );
          if (!shouldContinue) {
            setIsSubmitting(false);
            return;
          }
          // If user confirms, the server-side delete already handles unpinning
        } else {
          throw deleteError;
        }
      }

      // @ts-expect-error todo: support UIMessage in setMessages
      setMessages((messages) => {
        const index = messages.findIndex((m) => m.id === message.id);

        if (index !== -1) {
          const updatedMessage = {
            ...message,
            content: draftContent.trim(),
            parts: [{ type: 'text', text: draftContent.trim() }],
            edited: true,
            editedAt: new Date().toISOString(),
          };

          return [...messages.slice(0, index), updatedMessage];
        }

        return messages;
      });

      // Clean up localStorage
      localStorage.removeItem(`message-edit-${message.id}`);

      toast.success('Message updated successfully');
      setMode('view');
      reload();
    } catch (error) {
      console.error('Failed to update message:', error);
      toast.error('Failed to update message. Please try again.');
      setIsSubmitting(false);
    }
  };

  // Check for recovered draft on mount
  useEffect(() => {
    const saveKey = `message-edit-${message.id}`;
    try {
      const savedData = localStorage.getItem(saveKey);
      if (savedData) {
        const { content, timestamp } = JSON.parse(savedData);
        const hourAgo = Date.now() - 60 * 60 * 1000;

        if (timestamp > hourAgo && content !== message.content) {
          const useRecovered = window.confirm(
            'Found an auto-saved draft. Would you like to restore it?',
          );
          if (useRecovered) {
            setDraftContent(content);
            setEditHistory([
              { content: message.content, timestamp: Date.now() - 1000 },
              { content, timestamp },
            ]);
            setHistoryIndex(1);
            toast.success('Draft restored');
          } else {
            localStorage.removeItem(saveKey);
          }
        }
      }
    } catch (error) {
      console.error('Failed to recover draft:', error);
    }
  }, [message.id, message.content]);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < editHistory.length - 1;
  const hasChanges = draftContent !== message.content;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col gap-3 w-full"
    >
      {/* Editor Header */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <Badge variant="secondary" className="gap-1">
            <Type className="h-3 w-3" />
            Editing
          </Badge>

          <div className="flex items-center gap-2">
            <span>{wordCount} words</span>
            <span>•</span>
            <span>{charCount} characters</span>
          </div>

          {lastSaved && (
            <div className="flex items-center gap-1">
              <Check className="h-3 w-3 text-green-500" />
              <span>Saved {lastSaved.toLocaleTimeString()}</span>
            </div>
          )}

          {isSaving && (
            <div className="flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Saving...</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={handleUndo}
                disabled={!canUndo}
              >
                <Undo2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Undo
              <kbd className="ml-1 text-xs opacity-60">⌘Z</kbd>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={handleRedo}
                disabled={!canRedo}
              >
                <Redo2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Redo
              <kbd className="ml-1 text-xs opacity-60">⌘⇧Z</kbd>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Main Editor */}
      <div className="relative">
        <Textarea
          data-testid="message-editor"
          ref={textareaRef}
          className={cn(
            'bg-background/50 backdrop-blur-sm',
            'border-2 transition-all duration-200',
            'outline-none overflow-hidden resize-none !text-base rounded-xl w-full p-4',
            'focus:border-primary/50 focus:bg-background',
            hasChanges && 'border-orange-500/30',
          )}
          value={draftContent}
          onChange={handleInput}
          placeholder="Edit your message..."
          spellCheck
          autoComplete="off"
        />

        {/* Character limit warning */}
        {charCount > 4000 && (
          <div className="absolute bottom-2 right-2 flex items-center gap-1 text-xs text-orange-500">
            <AlertCircle className="h-3 w-3" />
            <span>Message is very long ({charCount}/4096)</span>
          </div>
        )}
      </div>

      {/* Editor Footer */}
      <div className="flex flex-col sm:flex-row gap-2 justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <kbd className="px-1.5 py-0.5 rounded bg-muted">Esc</kbd>
          <span>Cancel</span>
          <span>•</span>
          <kbd className="px-1.5 py-0.5 rounded bg-muted">⌘</kbd>
          <span>+</span>
          <kbd className="px-1.5 py-0.5 rounded bg-muted">Enter</kbd>
          <span>Submit</span>
        </div>

        <div className="flex gap-2 self-end">
          <Button
            variant="outline"
            className="h-fit py-2 px-3 gap-2"
            onClick={handleCancel}
            disabled={isSubmitting}
          >
            <X className="h-4 w-4" />
            Cancel
          </Button>

          <Button
            data-testid="message-editor-send-button"
            variant="default"
            className={cn(
              'h-fit py-2 px-3 gap-2 transition-all',
              hasChanges && 'bg-primary shadow-lg',
            )}
            disabled={isSubmitting || !draftContent.trim() || !hasChanges}
            onClick={handleSubmit}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Updating...
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                Update Message
              </>
            )}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
