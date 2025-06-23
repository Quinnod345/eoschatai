import { useState, useCallback, useRef } from 'react';
import {
  MentionService,
  type MentionResource,
  type MentionInstance,
  type MentionContext,
  type MentionSuggestion,
  type MentionFilter,
  type MentionCategory,
} from '@/lib/mentions';

interface UseEnhancedMentionsOptions {
  userId: string;
  chatId?: string;
  personaId?: string;
  onMentionSelect?: (mention: MentionResource | MentionInstance) => void;
  maxSuggestions?: number;
}

export function useEnhancedMentions({
  userId,
  chatId,
  personaId,
  onMentionSelect,
  maxSuggestions = 10,
}: UseEnhancedMentionsOptions) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<MentionSuggestion[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedMentions, setSelectedMentions] = useState<
    (MentionResource | MentionInstance)[]
  >([]);
  const [activeCategory, setActiveCategory] = useState<MentionCategory | 'all'>(
    'all',
  );
  const [filters, setFilters] = useState<MentionFilter[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [recentMessages, setRecentMessages] = useState<string[]>([]);

  const mentionService = useRef(MentionService.getInstance());
  const cursorPositionRef = useRef<number>(0);
  const mentionStartRef = useRef<number | null>(null);

  // Build context for mention service
  const context: MentionContext = {
    userId,
    currentChat: chatId,
    selectedPersona: personaId,
    currentTime: new Date(),
    recentMessages,
    searchQuery: query,
    filters,
  };

  // Fetch dynamic data for specific mention types
  const fetchDynamicData = useCallback(
    async (resourceType: string, searchTerm: string) => {
      switch (resourceType) {
        case 'calendar':
          try {
            const response = await fetch(
              `/api/calendar/events?${new URLSearchParams({
                searchTerm,
                maxResults: '5',
              })}`,
            );
            if (response.ok) {
              const events = await response.json();
              return events.map((event: any) => ({
                id: `event-${event.id}`,
                name: event.summary,
                description: `${new Date(event.start.dateTime || event.start.date).toLocaleString()}`,
                preview: event.location || 'No location',
                metadata: { event },
              }));
            }
          } catch (error) {
            console.error('Error fetching calendar events:', error);
          }
          break;

        case 'document':
          try {
            const response = await fetch(
              `/api/documents?${new URLSearchParams({
                search: searchTerm,
                limit: '5',
              })}`,
            );
            if (response.ok) {
              const docs = await response.json();
              return docs.map((doc: any) => ({
                id: `doc-${doc.id}`,
                name: doc.title,
                description: doc.kind,
                preview: `${doc.content?.substring(0, 100)}...`,
                metadata: { document: doc },
              }));
            }
          } catch (error) {
            console.error('Error fetching documents:', error);
          }
          break;

        case 'team':
          // This would fetch team members from your user/team API
          return [];
      }
      return [];
    },
    [],
  );

  // Enhanced suggestion fetching with dynamic data
  const fetchSuggestions = useCallback(
    async (searchQuery: string) => {
      setIsLoading(true);
      try {
        // Get base suggestions from service
        let baseSuggestions = await mentionService.current.getSuggestions(
          searchQuery,
          context,
          maxSuggestions,
        );

        // Apply category filter
        if (activeCategory !== 'all') {
          baseSuggestions = baseSuggestions.filter(
            (s) =>
              'category' in s.resource &&
              s.resource.category === activeCategory,
          );
        }

        // Apply additional filters
        if (filters.length > 0) {
          baseSuggestions = mentionService.current.applyFilters(
            baseSuggestions,
            filters,
          );
        }

        // Enhance with dynamic data for top suggestions
        const enhancedSuggestions = await Promise.all(
          baseSuggestions.slice(0, 3).map(async (suggestion) => {
            if (
              'isDynamic' in suggestion.resource &&
              suggestion.resource.isDynamic
            ) {
              const dynamicInstances = await fetchDynamicData(
                suggestion.resource.type,
                searchQuery,
              );

              // Add dynamic instances as separate suggestions
              const instanceSuggestions = dynamicInstances.map(
                (instance: any) => ({
                  resource: {
                    ...instance,
                    type:
                      'type' in suggestion.resource
                        ? suggestion.resource.type
                        : 'document',
                    category:
                      'category' in suggestion.resource
                        ? suggestion.resource.category
                        : 'resource',
                    icon:
                      'icon' in suggestion.resource
                        ? suggestion.resource.icon
                        : 'document',
                    color:
                      'color' in suggestion.resource
                        ? suggestion.resource.color
                        : undefined,
                  } as MentionInstance,
                  relevanceScore: suggestion.relevanceScore * 0.9,
                  reason: 'Specific item',
                  context: instance.preview,
                }),
              );

              return [suggestion, ...instanceSuggestions];
            }
            return [suggestion];
          }),
        );

        // Flatten and combine with remaining suggestions
        const allSuggestions = [
          ...enhancedSuggestions.flat(),
          ...baseSuggestions.slice(3),
        ];

        setSuggestions(allSuggestions.slice(0, maxSuggestions));
        setSelectedIndex(0);
      } catch (error) {
        console.error('Error fetching suggestions:', error);
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    },
    [activeCategory, filters, context, maxSuggestions, fetchDynamicData],
  );

  // Handle mention selection
  const selectMention = useCallback(
    (suggestion: MentionSuggestion) => {
      const mention = suggestion.resource;

      // Record usage for learning
      mentionService.current.recordMentionUsage(userId, mention);

      // Add to selected mentions
      setSelectedMentions((prev) => [...prev, mention]);

      // Call optional callback
      onMentionSelect?.(mention);

      // Reset state
      setIsOpen(false);
      setQuery('');
      setSuggestions([]);
      mentionStartRef.current = null;
    },
    [userId, onMentionSelect],
  );

  // Remove a selected mention
  const removeMention = useCallback((index: number) => {
    setSelectedMentions((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Clear all mentions
  const clearMentions = useCallback(() => {
    setSelectedMentions([]);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(0, prev - 1));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) =>
            Math.min(suggestions.length - 1, prev + 1),
          );
          break;
        case 'Enter':
          e.preventDefault();
          if (suggestions[selectedIndex]) {
            selectMention(suggestions[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setIsOpen(false);
          break;
        case 'Tab': {
          e.preventDefault();
          // Cycle through categories
          const categories = [
            'all',
            ...mentionService.current.getCategories(),
          ] as const;
          const currentIndex = categories.indexOf(activeCategory);
          const nextIndex = (currentIndex + 1) % categories.length;
          setActiveCategory(categories[nextIndex] as MentionCategory | 'all');
          break;
        }
      }
    },
    [isOpen, suggestions, selectedIndex, selectMention, activeCategory],
  );

  // Detect mentions in text
  const detectMention = useCallback(
    (text: string, cursorPosition: number) => {
      const textBeforeCursor = text.substring(0, cursorPosition);
      const lastAtIndex = textBeforeCursor.lastIndexOf('@');

      if (lastAtIndex !== -1 && cursorPosition > lastAtIndex) {
        const query = textBeforeCursor.substring(lastAtIndex + 1);
        const hasSpaceAfterAt = query.includes(' ');

        if (!hasSpaceAfterAt) {
          mentionStartRef.current = lastAtIndex;
          setQuery(query);
          setIsOpen(true);
          fetchSuggestions(query);
          return true;
        }
      }

      mentionStartRef.current = null;
      setIsOpen(false);
      setQuery('');
      return false;
    },
    [fetchSuggestions],
  );

  // Get the mention position for dropdown placement
  const getMentionPosition = useCallback(() => {
    return mentionStartRef.current;
  }, []);

  // Format mentions for backend processing
  const formatMentionsForSubmission = useCallback(
    (text: string) => {
      let formattedText = text;
      const mentionData: Array<{ type: string; id: string; name: string }> = [];

      selectedMentions.forEach((mention) => {
        // Add mention marker to text if not already present
        const mentionMarker = `@${(mention as any).type || 'unknown'}:${mention.id}`;
        if (!formattedText.includes(mentionMarker)) {
          formattedText += ` ${mentionMarker}`;
        }

        // Collect mention data
        mentionData.push({
          type: (mention as any).type || 'unknown',
          id: mention.id,
          name: mention.name,
        });
      });

      return {
        text: formattedText,
        mentions: mentionData,
      };
    },
    [selectedMentions],
  );

  // Update recent messages for context
  const updateRecentMessages = useCallback((messages: string[]) => {
    setRecentMessages(messages.slice(-5)); // Keep last 5 messages
  }, []);

  // Add custom filter
  const addFilter = useCallback((filter: MentionFilter) => {
    setFilters((prev) => [...prev, filter]);
  }, []);

  // Remove filter
  const removeFilter = useCallback((index: number) => {
    setFilters((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setFilters([]);
  }, []);

  return {
    // State
    isOpen,
    query,
    suggestions,
    selectedIndex,
    selectedMentions,
    activeCategory,
    filters,
    isLoading,

    // Actions
    setIsOpen,
    setQuery,
    setSelectedIndex,
    setActiveCategory,
    selectMention,
    removeMention,
    clearMentions,
    detectMention,
    getMentionPosition,
    formatMentionsForSubmission,
    updateRecentMessages,
    addFilter,
    removeFilter,
    clearFilters,

    // Handlers
    handleKeyDown,
  };
}
