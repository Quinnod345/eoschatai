import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertTriangle, MessageSquareOff, Pin } from 'lucide-react';

interface EditConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  hasPinnedMessages?: boolean;
  messageCount?: number;
}

export function EditConfirmationDialog({
  open,
  onOpenChange,
  onConfirm,
  hasPinnedMessages = false,
  messageCount = 0,
}: EditConfirmationDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <AlertDialogTitle>Edit Message Confirmation</AlertDialogTitle>
          </div>
          <AlertDialogDescription>
            Editing this message will affect the conversation flow and remove
            all subsequent responses.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3 pt-2">
          {messageCount > 0 && (
            <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
              <MessageSquareOff className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                {messageCount} {messageCount === 1 ? 'response' : 'responses'}{' '}
                will be removed
              </span>
            </div>
          )}

          {hasPinnedMessages && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-md border border-amber-200 dark:border-amber-900">
              <Pin className="h-4 w-4 text-amber-600 dark:text-amber-500" />
              <span className="text-sm text-amber-800 dark:text-amber-200">
                Some of these responses contain pinned messages that will also
                be removed
              </span>
            </div>
          )}

          <p className="text-sm font-medium">
            Are you sure you want to continue?
          </p>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Edit Message
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
