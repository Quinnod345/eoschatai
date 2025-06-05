# Immediate Improvements for EOS Chat AI

## 🚀 **Quick Wins (1-2 Days Implementation)**

### **1. Enhanced Message Actions**
Add interactive message actions that appear on hover:

```typescript
// components/enhanced-message-actions.tsx
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Pin, MessageCircle, Copy, Share, Bookmark, ThumbsUp } from 'lucide-react';

interface MessageActionsProps {
  messageId: string;
  content: string;
  onPin?: (messageId: string) => void;
  onReply?: (messageId: string) => void;
  onBookmark?: (messageId: string) => void;
}

export function MessageActions({ messageId, content, onPin, onReply, onBookmark }: MessageActionsProps) {
  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    // Add toast notification
  };

  const handleShare = () => {
    // Implement share functionality
  };

  return (
    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => onPin?.(messageId)}>
            <Pin className="h-3 w-3" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Pin message</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => onReply?.(messageId)}>
            <MessageCircle className="h-3 w-3" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Reply</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={handleCopy}>
            <Copy className="h-3 w-3" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Copy</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => onBookmark?.(messageId)}>
            <Bookmark className="h-3 w-3" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Bookmark</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={handleShare}>
            <Share className="h-3 w-3" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Share</TooltipContent>
      </Tooltip>
    </div>
  );
}
```

### **2. Smart Chat Templates**
Add EOS-specific conversation starters:

```typescript
// components/chat-templates.tsx
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Users, Target, BarChart3, Calendar, Lightbulb } from 'lucide-react';

const templates = [
  {
    id: 'l10-prep',
    title: 'L10 Meeting Prep',
    description: 'Prepare for your Level 10 meeting',
    prompt: 'Help me prepare for our L10 meeting. I need to review our scorecard, discuss issues, and set priorities.',
    icon: Calendar,
    category: 'Meetings'
  },
  {
    id: 'scorecard-review',
    title: 'Scorecard Analysis',
    description: 'Review quarterly metrics',
    prompt: 'Let\'s review our quarterly scorecard. Help me analyze our key metrics and identify areas for improvement.',
    icon: BarChart3,
    category: 'Analytics'
  },
  {
    id: 'accountability-chart',
    title: 'Accountability Chart',
    description: 'Create or update org chart',
    prompt: 'I need help creating an accountability chart for our organization. Walk me through the process.',
    icon: Users,
    category: 'Structure'
  },
  {
    id: 'vision-traction',
    title: 'Vision/Traction Organizer',
    description: 'Work on company vision',
    prompt: 'Help me work on our Vision/Traction Organizer. I want to clarify our core values and 10-year target.',
    icon: Target,
    category: 'Vision'
  },
  {
    id: 'process-documentation',
    title: 'Process Documentation',
    description: 'Document core processes',
    prompt: 'I need to document one of our core processes. Guide me through creating clear, actionable process documentation.',
    icon: FileText,
    category: 'Processes'
  },
  {
    id: 'issue-solving',
    title: 'Issue Solving',
    description: 'Solve business issues',
    prompt: 'I have a business issue that needs solving. Help me use the EOS Issue Solving Track to work through it.',
    icon: Lightbulb,
    category: 'Problem Solving'
  }
];

interface ChatTemplatesProps {
  onSelectTemplate: (prompt: string) => void;
}

export function ChatTemplates({ onSelectTemplate }: ChatTemplatesProps) {
  const categories = [...new Set(templates.map(t => t.category))];

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold mb-2">EOS Conversation Starters</h3>
        <p className="text-muted-foreground text-sm">
          Choose a template to get started with common EOS tasks
        </p>
      </div>

      {categories.map(category => (
        <div key={category} className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            {category}
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {templates
              .filter(template => template.category === category)
              .map(template => {
                const Icon = template.icon;
                return (
                  <Card 
                    key={template.id} 
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => onSelectTemplate(template.prompt)}
                  >
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-sm">
                        <Icon className="h-4 w-4 text-eos-orange" />
                        {template.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground">
                        {template.description}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
          </div>
        </div>
      ))}
    </div>
  );
}
```

### **3. Enhanced Keyboard Shortcuts**
Improve the existing keyboard shortcuts:

```typescript
// hooks/use-enhanced-shortcuts.ts
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
      const shortcut = actions.find(action => {
        const [modifierKey, ...keys] = action.key.split('+');
        const expectedKey = keys.join('+').toLowerCase();
        const hasModifier = modifierKey.includes('cmd') || modifierKey.includes('ctrl');
        const hasShift = modifierKey.includes('shift');
        const hasAlt = modifierKey.includes('alt');

        return (
          key.toLowerCase() === expectedKey &&
          modifier === hasModifier &&
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
export const chatShortcuts: ShortcutAction[] = [
  {
    key: 'cmd+k',
    action: () => {/* Open search */},
    description: 'Open search',
    category: 'Navigation'
  },
  {
    key: 'cmd+n',
    action: () => {/* New chat */},
    description: 'New chat',
    category: 'Chat'
  },
  {
    key: 'cmd+enter',
    action: () => {/* Send message */},
    description: 'Send message',
    category: 'Chat'
  },
  {
    key: 'cmd+shift+p',
    action: () => {/* Open persona selector */},
    description: 'Switch persona',
    category: 'AI'
  },
  {
    key: 'cmd+/',
    action: () => {/* Show shortcuts */},
    description: 'Show shortcuts',
    category: 'Help'
  },
  {
    key: 'cmd+b',
    action: () => {/* Toggle sidebar */},
    description: 'Toggle sidebar',
    category: 'Navigation'
  },
  {
    key: 'cmd+shift+d',
    action: () => {/* Toggle dark mode */},
    description: 'Toggle theme',
    category: 'Interface'
  }
];
```

### **4. Smart Notifications System**
Add contextual notifications:

```typescript
// components/smart-notifications.tsx
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Bell, FileText, Users, AlertCircle, CheckCircle } from 'lucide-react';

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

  const addNotification = (notification: Omit<Notification, 'id' | 'timestamp'>) => {
    const newNotification: Notification = {
      ...notification,
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date()
    };

    setNotifications(prev => [newNotification, ...prev.slice(0, 9)]);

    // Show toast
    const icon = {
      info: <Bell className="h-4 w-4" />,
      success: <CheckCircle className="h-4 w-4" />,
      warning: <AlertCircle className="h-4 w-4" />,
      error: <AlertCircle className="h-4 w-4" />
    }[notification.type];

    toast(notification.title, {
      description: notification.message,
      icon,
      action: notification.action ? {
        label: notification.action.label,
        onClick: notification.action.onClick
      } : undefined
    });
  };

  // Smart notification triggers
  const notifyDocumentRelevance = (documentName: string, relevanceScore: number) => {
    if (relevanceScore > 0.8) {
      addNotification({
        type: 'info',
        title: 'Relevant Document Found',
        message: `"${documentName}" might be helpful for your current conversation.`,
        action: {
          label: 'View Document',
          onClick: () => {/* Open document */}
        }
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
          onClick: () => {/* Open action items */}
        }
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
        onClick: () => {/* Open meeting prep */}
      }
    });
  };

  return {
    notifications,
    addNotification,
    notifyDocumentRelevance,
    notifyActionItems,
    notifyMeetingReminder
  };
}
```

### **5. Enhanced Search Suggestions**
Improve search with AI-powered suggestions:

```typescript
// components/enhanced-search-suggestions.tsx
import { useState, useEffect } from 'react';
import { Search, Clock, FileText, MessageSquare, Users } from 'lucide-react';

interface SearchSuggestion {
  id: string;
  text: string;
  type: 'recent' | 'popular' | 'ai-suggested' | 'template';
  icon: React.ReactNode;
  category?: string;
}

export function useSearchSuggestions(query: string) {
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);

  useEffect(() => {
    if (!query) {
      // Show default suggestions when no query
      setSuggestions([
        {
          id: '1',
          text: 'L10 meeting agenda',
          type: 'template',
          icon: <MessageSquare className="h-4 w-4" />,
          category: 'Meetings'
        },
        {
          id: '2',
          text: 'Quarterly scorecard review',
          type: 'popular',
          icon: <FileText className="h-4 w-4" />,
          category: 'Analytics'
        },
        {
          id: '3',
          text: 'Team accountability chart',
          type: 'template',
          icon: <Users className="h-4 w-4" />,
          category: 'Structure'
        }
      ]);
    } else {
      // AI-powered suggestions based on query
      generateAISuggestions(query).then(setSuggestions);
    }
  }, [query]);

  return suggestions;
}

async function generateAISuggestions(query: string): Promise<SearchSuggestion[]> {
  // This would call your AI service to generate contextual suggestions
  const eosKeywords = {
    'meeting': ['L10 meeting', 'quarterly meeting', 'annual planning'],
    'scorecard': ['quarterly scorecard', 'weekly scorecard', 'KPI tracking'],
    'vision': ['vision/traction organizer', '10-year target', 'core values'],
    'process': ['core processes', 'process documentation', 'workflow'],
    'issues': ['issue solving', 'IDS process', 'problem resolution']
  };

  const suggestions: SearchSuggestion[] = [];
  
  Object.entries(eosKeywords).forEach(([keyword, items]) => {
    if (query.toLowerCase().includes(keyword)) {
      items.forEach((item, index) => {
        suggestions.push({
          id: `${keyword}-${index}`,
          text: item,
          type: 'ai-suggested',
          icon: <Search className="h-4 w-4" />,
          category: 'EOS Tools'
        });
      });
    }
  });

  return suggestions.slice(0, 5);
}
```

## 🎯 **Medium-term Improvements (1-2 Weeks)**

### **6. Voice Input/Output**
Add speech capabilities:

```typescript
// hooks/use-speech.ts
import { useState, useEffect } from 'react';

export function useSpeechRecognition() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
      const recognition = new (window as any).webkitSpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        setTranscript(finalTranscript);
      };

      recognition.onend = () => setIsListening(false);
      setRecognition(recognition);
    }
  }, []);

  const startListening = () => {
    if (recognition) {
      recognition.start();
      setIsListening(true);
    }
  };

  const stopListening = () => {
    if (recognition) {
      recognition.stop();
      setIsListening(false);
    }
  };

  return { isListening, transcript, startListening, stopListening };
}

export function useSpeechSynthesis() {
  const speak = (text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1;
      speechSynthesis.speak(utterance);
    }
  };

  return { speak };
}
```

### **7. Advanced Analytics Dashboard**
Create usage analytics:

```typescript
// components/analytics-dashboard.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, MessageSquare, Clock, TrendingUp } from 'lucide-react';

interface AnalyticsData {
  totalChats: number;
  totalMessages: number;
  avgResponseTime: number;
  topTopics: string[];
  usageByDay: { day: string; count: number }[];
}

export function AnalyticsDashboard({ data }: { data: AnalyticsData }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Chats</CardTitle>
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{data.totalChats}</div>
          <p className="text-xs text-muted-foreground">
            +12% from last month
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Messages Sent</CardTitle>
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{data.totalMessages}</div>
          <p className="text-xs text-muted-foreground">
            +8% from last month
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{data.avgResponseTime}s</div>
          <p className="text-xs text-muted-foreground">
            -2s from last month
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Productivity Gain</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">24%</div>
          <p className="text-xs text-muted-foreground">
            Time saved vs manual work
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
```

## 🔧 **Implementation Priority**

1. **Day 1**: Enhanced message actions + Chat templates
2. **Day 2**: Keyboard shortcuts + Smart notifications  
3. **Week 1**: Voice input/output + Search suggestions
4. **Week 2**: Analytics dashboard + Performance monitoring

These improvements will significantly enhance user experience and make your EOS Chat AI more engaging and productive! 🚀 