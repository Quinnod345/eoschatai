'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Calendar,
  FileText,
  BarChart,
  Target,
  Mountain,
  Users,
  Search,
  TrendingUp,
  HelpCircle,
  List,
  Clock,
  Star,
  History,
  Command,
  Sparkles,
  X,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  MentionService,
  type MentionResource,
  type MentionInstance,
  type MentionSuggestion,
  type MentionCategory,
  type MentionContext,
} from '@/lib/mentions';

interface EnhancedMentionInputProps {
  value: string;
  onChange: (value: string) => void;
  onMentionsChange?: (mentions: (MentionResource | MentionInstance)[]) => void;
  placeholder?: string;
  disabled?: boolean;
  userId: string;
  context?: Partial<MentionContext>;
}

// Icon mapping for mention types
const iconMap = {
  Calendar,
  FileText,
  BarChart,
  Target,
  Mountain,
  Users,
  Search,
  TrendingUp,
  HelpCircle,
  List,
  Clock,
  Star,
  History,
  Command,
  Terminal: Command,
};

export function EnhancedMentionInput({
  value,
  onChange,
  onMentionsChange,
  placeholder,
  disabled,
  userId,
  context: externalContext,
}: EnhancedMentionInputProps) {
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [suggestions, setSuggestions] = useState<MentionSuggestion[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedMentions, setSelectedMentions] = useState<
    (MentionResource | MentionInstance)[]
  >([]);
  const [activeCategory, setActiveCategory] = useState<MentionCategory | 'all'>(
    'all',
  );
  const [isLoading, setIsLoading] = useState(false);
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const mentionStartRef = useRef<number | null>(null);
  const mentionService = useRef(MentionService.getInstance());

  // Build context for mention service
  const context: MentionContext = {
    currentTime: new Date(),
    userId,
    ...externalContext,
  };

  // Detect @ mentions in input
  useEffect(() => {
    const handleMentionDetection = () => {
      if (!inputRef.current) return;

      const cursorPosition = inputRef.current.selectionStart;
      const textBeforeCursor = value.substring(0, cursorPosition);
      const lastAtIndex = textBeforeCursor.lastIndexOf('@');

      if (lastAtIndex !== -1 && cursorPosition > lastAtIndex) {
        const query = textBeforeCursor.substring(lastAtIndex);
        const hasSpaceAfterAt = query.includes(' ');

        if (!hasSpaceAfterAt) {
          mentionStartRef.current = lastAtIndex;
          setMentionQuery(query);
          setShowMentions(true);
          updateMentionPosition();
          fetchSuggestions(query.substring(1)); // Remove @ for search
        } else {
          closeMentions();
        }
      } else if (showMentions) {
        closeMentions();
      }
    };

    handleMentionDetection();
  }, [value]);

  // Update mention dropdown position
  const updateMentionPosition = () => {
    if (!inputRef.current || mentionStartRef.current === null) return;

    // Calculate position based on cursor
    const rect = inputRef.current.getBoundingClientRect();
    const lineHeight = 24; // Approximate line height
    const charsPerLine = Math.floor(rect.width / 8); // Approximate char width

    const textBeforeMention = value.substring(0, mentionStartRef.current);
    const lines = Math.ceil(textBeforeMention.length / charsPerLine);
    const charPosInLine = textBeforeMention.length % charsPerLine;

    setMentionPosition({
      top: rect.top + lines * lineHeight - 200, // Position above cursor
      left: rect.left + charPosInLine * 8,
    });
  };

  // Fetch suggestions from mention service
  const fetchSuggestions = async (query: string) => {
    setIsLoading(true);
    try {
      const results = await mentionService.current.getSuggestions(
        query,
        context,
      );

      // Filter by active category if not 'all'
      const filtered =
        activeCategory === 'all'
          ? results
          : results.filter((s) => {
              // Only MentionResource has category, not MentionInstance
              if ('category' in s.resource) {
                return s.resource.category === activeCategory;
              }
              return false;
            });

      setSuggestions(filtered);
      setSelectedIndex(0);
    } catch (error) {
      console.error('Error fetching mention suggestions:', error);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle mention selection
  const selectMention = (suggestion: MentionSuggestion) => {
    if (!inputRef.current || mentionStartRef.current === null) return;

    const { resource } = suggestion;

    // Record usage for learning
    mentionService.current.recordMentionUsage(userId, resource);

    // Handle special commands
    if (
      'type' in resource &&
      resource.type === 'help' &&
      resource.id.startsWith('@')
    ) {
      // Execute command instead of adding as mention
      handleCommand(resource.id);
      return;
    }

    // Remove @ mention text from input
    const beforeMention = value.substring(0, mentionStartRef.current);
    const afterMention = value.substring(inputRef.current.selectionStart);
    const newValue = beforeMention + afterMention;
    onChange(newValue);

    // Add to selected mentions
    const newMentions = [...selectedMentions, resource];
    setSelectedMentions(newMentions);
    onMentionsChange?.(newMentions);

    // Close mention dropdown
    closeMentions();

    // Focus back on input
    setTimeout(() => {
      inputRef.current?.focus();
      const newCursorPos = beforeMention.length;
      inputRef.current?.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  // Handle special commands
  const handleCommand = async (command: string) => {
    try {
      const result = await mentionService.current.executeCommand(
        command,
        [],
        context,
      );
      console.log('Command result:', result);
      // Handle command result (e.g., show help modal, display recent items)
    } catch (error) {
      console.error('Command error:', error);
    }
    closeMentions();
  };

  // Close mentions dropdown
  const closeMentions = () => {
    setShowMentions(false);
    setMentionQuery('');
    setSuggestions([]);
    setSelectedIndex(0);
    mentionStartRef.current = null;
  };

  // Remove a selected mention
  const removeMention = (index: number) => {
    const newMentions = selectedMentions.filter((_, i) => i !== index);
    setSelectedMentions(newMentions);
    onMentionsChange?.(newMentions);
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showMentions) return;

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(0, prev - 1));
        break;
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(suggestions.length - 1, prev + 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (suggestions[selectedIndex]) {
          selectMention(suggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        closeMentions();
        break;
      case 'Tab': {
        e.preventDefault();
        // Cycle through categories
        const categories = ['all', ...mentionService.current.getCategories()];
        const currentIndex = categories.indexOf(activeCategory);
        const nextIndex = (currentIndex + 1) % categories.length;
        setActiveCategory(categories[nextIndex] as MentionCategory | 'all');
        break;
      }
    }
  };

  // Get icon component
  const getIcon = (iconName: string) => {
    const Icon = iconMap[iconName as keyof typeof iconMap] || FileText;
    return Icon;
  };

  // Get category color
  const getCategoryColor = (category: MentionCategory) => {
    const colors: Record<string, string> = {
      resource: 'purple',
      calendar: 'blue',
      person: 'teal',
      tool: 'orange',
      command: 'gray',
      template: 'indigo',
      history: 'yellow',
      insight: 'red',
      composer: 'blue',
    };
    return colors[category] || 'gray';
  };

  return (
    <div className="relative w-full">
      {/* Selected mentions display */}
      {selectedMentions.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {selectedMentions.map((mention, index) => {
            const Icon = getIcon('icon' in mention ? mention.icon : 'FileText');
            return (
              <Badge
                key={`${mention.id}-${index}`}
                variant="secondary"
                className={cn(
                  'flex items-center gap-1.5 pr-1',
                  `text-${'color' in mention && mention.color ? mention.color : 'gray'}-600 dark:text-${'color' in mention && mention.color ? mention.color : 'gray'}-400`,
                )}
              >
                <Icon className="h-3 w-3" />
                <span>{mention.name}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 hover:bg-transparent"
                  onClick={() => removeMention(index)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            );
          })}
        </div>
      )}

      {/* Main input */}
      <textarea
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          'w-full min-h-[100px] p-3 rounded-lg',
          'bg-background border border-input',
          'focus:outline-none focus:ring-2 focus:ring-ring',
          'resize-none',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
      />

      {/* Enhanced mention dropdown */}
      {showMentions && (
        <div
          className="absolute z-50 w-96 max-h-96 overflow-hidden rounded-lg border bg-popover shadow-lg"
          style={{
            top: `${mentionPosition.top}px`,
            left: `${mentionPosition.left}px`,
          }}
        >
          {/* Header with search and filters */}
          <div className="border-b p-3 space-y-3">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">
                {mentionQuery || 'Type to search...'}
              </span>
              {isLoading && (
                <div className="ml-auto">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              )}
            </div>

            {/* Category tabs */}
            <Tabs
              value={activeCategory}
              onValueChange={(v) =>
                setActiveCategory(v as MentionCategory | 'all')
              }
            >
              <TabsList className="grid grid-cols-4 h-8">
                <TabsTrigger value="all" className="text-xs">
                  All
                </TabsTrigger>
                <TabsTrigger value="resource" className="text-xs">
                  Resources
                </TabsTrigger>
                <TabsTrigger value="calendar" className="text-xs">
                  Calendar
                </TabsTrigger>
                <TabsTrigger value="tool" className="text-xs">
                  Tools
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Suggestions list */}
          <div className="max-h-64 overflow-y-auto">
            {suggestions.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                {isLoading ? 'Searching...' : 'No suggestions found'}
              </div>
            ) : (
              <div className="py-1">
                {suggestions.map((suggestion, index) => {
                  const Icon = getIcon(
                    'icon' in suggestion.resource
                      ? suggestion.resource.icon
                      : 'FileText',
                  );
                  const isSelected = index === selectedIndex;
                  const color =
                    ('color' in suggestion.resource &&
                      suggestion.resource.color) ||
                    ('category' in suggestion.resource
                      ? getCategoryColor(suggestion.resource.category)
                      : 'gray');

                  return (
                    <button
                      key={suggestion.resource.id}
                      type="button"
                      className={cn(
                        'w-full px-3 py-2 text-left flex items-start gap-3',
                        'hover:bg-accent transition-colors',
                        isSelected && 'bg-accent',
                      )}
                      onClick={() => selectMention(suggestion)}
                      onMouseEnter={() => setSelectedIndex(index)}
                    >
                      <div
                        className={cn(
                          'mt-0.5 p-1.5 rounded',
                          `bg-${color}-100 dark:bg-${color}-900/20`,
                        )}
                      >
                        <Icon
                          className={cn(
                            'h-4 w-4',
                            `text-${color}-600 dark:text-${color}-400`,
                          )}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">
                            {suggestion.resource.name}
                          </span>
                          {'shortcut' in suggestion.resource &&
                            suggestion.resource.shortcut && (
                              <code className="text-xs px-1 py-0.5 rounded bg-muted">
                                {suggestion.resource.shortcut}
                              </code>
                            )}
                          {suggestion.relevanceScore > 0.8 && (
                            <Sparkles className="h-3 w-3 text-yellow-500" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {'description' in suggestion.resource
                            ? suggestion.resource.description
                            : ''}
                        </p>
                        {suggestion.reason && (
                          <p className="text-xs text-muted-foreground mt-1 italic">
                            {suggestion.reason}
                          </p>
                        )}
                        {suggestion.resource.preview && (
                          <p className="text-xs text-muted-foreground mt-1 truncate">
                            {suggestion.resource.preview}
                          </p>
                        )}
                      </div>
                      {isSelected && (
                        <ChevronRight className="h-4 w-4 text-muted-foreground mt-0.5" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer with tips */}
          <div className="border-t p-2 bg-muted/50">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                ↑↓ Navigate • Enter Select • Tab Categories • Esc Close
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                onClick={() => handleCommand('@help')}
              >
                <HelpCircle className="h-3 w-3 mr-1" />
                Help
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
