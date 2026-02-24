'use client';

import { useEffect, useRef, useState } from 'react';
import type { UIMessage } from 'ai';
import { Button } from './ui/button';
import { deleteTrailingMessages } from '@/app/(chat)/actions';
import { toast } from '@/lib/toast-system';
import { LoaderIcon } from 'lucide-react';
import { EditConfirmationDialog } from './edit-confirmation-dialog';

export type SimpleMessageEditorProps = {
  message: UIMessage;
  setMode: (mode: 'view' | 'edit') => void;
  setMessages: (
    messages: UIMessage[] | ((messages: UIMessage[]) => UIMessage[]),
  ) => void;
  reload: () => void;
};

export function SimpleMessageEditor({
  message,
  setMode,
  setMessages,
  reload,
}: SimpleMessageEditorProps) {
  const [draftContent, setDraftContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pinnedInfo, setPinnedInfo] = useState<{
    hasPinnedMessages: boolean;
    messageCount: number;
    pinnedCount: number;
  } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (message.parts && message.parts.length > 0) {
      const textParts = message.parts.filter((part) => part.type === 'text');
      const combinedText = textParts.map((part) => part.text).join('\n');
      // Strip embedded content markers from edit textarea for a cleaner editing experience
      const EMBEDDED_CONTENT_START = '[EMBEDDED_CONTENT_START]';
      const EMBEDDED_CONTENT_END = '[EMBEDDED_CONTENT_END]';
      const regex = new RegExp(
        `${EMBEDDED_CONTENT_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(.*?)${EMBEDDED_CONTENT_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
        'gs',
      );
      const cleaned = combinedText.replace(regex, '').trim();
      setDraftContent(cleaned);
    }
  }, [message.parts]);

  useEffect(() => {
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [draftContent]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      setMode('view');
    } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handlePreSubmit();
    }
  };

  const handleCancel = () => {
    setMode('view');
  };

  const handlePreSubmit = async () => {
    // Validate content is not empty
    const trimmedContent = draftContent.trim();
    if (!trimmedContent) {
      toast.error('Message cannot be empty');
      return;
    }

    // Check for pinned messages
    try {
      const response = await fetch('/api/messages/check-pinned', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId: message.id }),
      });

      if (response.ok) {
        const data = await response.json();
        setPinnedInfo(data);

        // If there are trailing messages, show confirmation dialog
        if (data.messageCount > 0) {
          setShowConfirmDialog(true);
        } else {
          // No trailing messages, proceed directly
          handleSubmit();
        }
      } else {
        // If check fails, proceed with old behavior
        handleSubmit();
      }
    } catch (error) {
      console.error('Failed to check pinned messages:', error);
      // Proceed with old behavior on error
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    // Validate content is not empty
    const trimmedContent = draftContent.trim();
    if (!trimmedContent) {
      toast.error('Message cannot be empty');
      return;
    }

    // Prevent double submission
    if (isSubmitting) return;

    setIsSubmitting(true);
    setShowConfirmDialog(false);

    try {
      // Try to delete trailing messages
      await deleteTrailingMessages({
        id: message.id,
      });

      // Update the message in the UI
      // @ts-expect-error todo: support UIMessage in setMessages
      setMessages((messages) => {
        const index = messages.findIndex((m) => m.id === message.id);

        if (index !== -1) {
          const updatedMessage = {
            ...message,
            content: trimmedContent,
            parts: [{ type: 'text', text: trimmedContent }],
            isEdited: true, // Mark as edited for UI purposes
            editedAt: new Date().toISOString(),
          };

          return [...messages.slice(0, index), updatedMessage];
        }

        return messages;
      });

      // Success feedback
      toast.success('Message updated successfully');

      setMode('view');
      reload();
    } catch (error: any) {
      console.error('Failed to update message:', error);

      // Check if it's a foreign key constraint error that wasn't caught
      const errorMessage = error?.message || '';
      if (
        errorMessage.includes('foreign key constraint') ||
        errorMessage.includes('PinnedMessage')
      ) {
        toast.error(
          'Failed to update message due to pinned responses. Please unpin them first.',
        );
      } else {
        toast.error('Failed to update message. Please try again.');
      }

      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="flex flex-col gap-2 w-full">
        <textarea
          ref={textareaRef}
          value={draftContent}
          onChange={(e) => setDraftContent(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full px-3 py-2 text-sm bg-background border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-primary min-h-[80px] overflow-hidden"
          placeholder="Type your message..."
          autoFocus
          disabled={isSubmitting}
        />

        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground">
            {isSubmitting
              ? 'Updating...'
              : 'Press Escape to cancel • Ctrl/Cmd + Enter to save'}
          </span>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handlePreSubmit}
              disabled={isSubmitting || !draftContent.trim()}
            >
              {isSubmitting ? (
                <>
                  <LoaderIcon className="animate-spin mr-2 h-3 w-3" />
                  Saving...
                </>
              ) : (
                'Save'
              )}
            </Button>
          </div>
        </div>
      </div>

      <EditConfirmationDialog
        open={showConfirmDialog}
        onOpenChange={setShowConfirmDialog}
        onConfirm={handleSubmit}
        hasPinnedMessages={pinnedInfo?.hasPinnedMessages || false}
        messageCount={pinnedInfo?.messageCount || 0}
      />
    </>
  );
}
