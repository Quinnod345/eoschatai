import { useState } from 'react';
import { toast } from '@/lib/toast-system';
import { Bell, AlertCircle, CheckCircle } from 'lucide-react';

interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  timestamp: Date;
}

export function useSmartNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = (
    notification: Omit<Notification, 'id' | 'timestamp'>,
  ) => {
    const newNotification: Notification = {
      ...notification,
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
    };

    setNotifications((prev) => [newNotification, ...prev.slice(0, 9)]);

    // Show toast
    const icon = {
      info: <Bell className="h-4 w-4" />,
      success: <CheckCircle className="h-4 w-4" />,
      warning: <AlertCircle className="h-4 w-4" />,
      error: <AlertCircle className="h-4 w-4" />,
    }[notification.type];

    const show =
      notification.type === 'success'
        ? toast.success
        : notification.type === 'error'
          ? toast.error
          : notification.type === 'warning'
            ? toast.warning
            : toast.info;

    show(notification.title, {
      description: notification.message,
      icon,
      action: notification.action
        ? {
            label: notification.action.label,
            onClick: notification.action.onClick,
          }
        : undefined,
    });
  };

  // Smart notification triggers
  const notifyDocumentRelevance = (
    documentName: string,
    relevanceScore: number,
  ) => {
    if (relevanceScore > 0.8) {
      addNotification({
        type: 'info',
        title: 'Relevant Document Found',
        message: `"${documentName}" might be helpful for your current conversation.`,
        action: {
          label: 'View Document',
          onClick: () => {
            // This would open the document modal or navigate to document
            console.log('Opening document:', documentName);
          },
        },
      });
    }
  };

  const notifyActionItems = (actionItems: string[]) => {
    if (actionItems.length > 0) {
      addNotification({
        type: 'warning',
        title: 'Action Items Detected',
        message: `Found ${actionItems.length} action item(s) in the conversation.`,
        action: {
          label: 'Review',
          onClick: () => {
            // This would open action items panel
            console.log('Opening action items:', actionItems);
          },
        },
      });
    }
  };

  const notifyMeetingReminder = (meetingName: string, timeUntil: string) => {
    addNotification({
      type: 'info',
      title: 'Meeting Reminder',
      message: `${meetingName} starts in ${timeUntil}.`,
      action: {
        label: 'Prepare',
        onClick: () => {
          // This would open meeting prep
          console.log('Preparing for meeting:', meetingName);
        },
      },
    });
  };

  const notifyPersonaSwitch = (personaName: string) => {
    addNotification({
      type: 'success',
      title: 'Persona Switched',
      message: `Now chatting with ${personaName}`,
    });
  };

  const notifyDocumentUploaded = (documentName: string) => {
    addNotification({
      type: 'success',
      title: 'Document Uploaded',
      message: `"${documentName}" has been added to your knowledge base.`,
      action: {
        label: 'View',
        onClick: () => {
          console.log('Viewing uploaded document:', documentName);
        },
      },
    });
  };

  const notifyEOSInsight = (insight: string) => {
    addNotification({
      type: 'info',
      title: 'EOS Insight',
      message: insight,
      action: {
        label: 'Learn More',
        onClick: () => {
          console.log('Learning more about insight:', insight);
        },
      },
    });
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  const removeNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  return {
    notifications,
    addNotification,
    notifyDocumentRelevance,
    notifyActionItems,
    notifyMeetingReminder,
    notifyPersonaSwitch,
    notifyDocumentUploaded,
    notifyEOSInsight,
    clearNotifications,
    removeNotification,
  };
}

// Notification Center Component
interface NotificationCenterProps {
  notifications: Notification[];
  onClear: () => void;
  onRemove: (id: string) => void;
}

export function NotificationCenter({
  notifications,
  onClear,
  onRemove,
}: NotificationCenterProps) {
  if (notifications.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No notifications</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-96 overflow-y-auto">
      <div className="flex items-center justify-between p-2 border-b">
        <h3 className="font-semibold">Notifications</h3>
        <button
          type="button"
          onClick={onClear}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Clear all
        </button>
      </div>

      {notifications.map((notification) => (
        <div
          key={notification.id}
          className="p-3 border rounded-lg bg-card hover:bg-accent/50 transition-colors"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                {notification.type === 'info' && (
                  <Bell className="h-4 w-4 text-blue-500" />
                )}
                {notification.type === 'success' && (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                )}
                {notification.type === 'warning' && (
                  <AlertCircle className="h-4 w-4 text-yellow-500" />
                )}
                {notification.type === 'error' && (
                  <AlertCircle className="h-4 w-4 text-red-500" />
                )}
                <h4 className="font-medium text-sm">{notification.title}</h4>
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                {notification.message}
              </p>
              {notification.action && (
                <button
                  type="button"
                  onClick={notification.action.onClick}
                  className="text-xs text-eos-orange hover:underline"
                >
                  {notification.action.label}
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => onRemove(notification.id)}
              className="text-muted-foreground hover:text-foreground"
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
