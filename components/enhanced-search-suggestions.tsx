import { useState, useEffect } from 'react';
import {
  Search,
  FileText,
  MessageSquare,
  Users,
  Target,
  BarChart3,
  Calendar,
} from 'lucide-react';

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
          category: 'Meetings',
        },
        {
          id: '2',
          text: 'Quarterly scorecard review',
          type: 'popular',
          icon: <FileText className="h-4 w-4" />,
          category: 'Analytics',
        },
        {
          id: '3',
          text: 'Team accountability chart',
          type: 'template',
          icon: <Users className="h-4 w-4" />,
          category: 'Structure',
        },
        {
          id: '4',
          text: 'Vision/Traction Organizer',
          type: 'popular',
          icon: <Target className="h-4 w-4" />,
          category: 'Vision',
        },
        {
          id: '5',
          text: 'Core process documentation',
          type: 'template',
          icon: <FileText className="h-4 w-4" />,
          category: 'Processes',
        },
      ]);
    } else {
      // AI-powered suggestions based on query
      generateAISuggestions(query).then(setSuggestions);
    }
  }, [query]);

  return suggestions;
}

async function generateAISuggestions(
  query: string,
): Promise<SearchSuggestion[]> {
  // This would call your AI service to generate contextual suggestions
  const eosKeywords = {
    meeting: [
      {
        text: 'L10 meeting preparation',
        icon: <Calendar className="h-4 w-4" />,
      },
      {
        text: 'Quarterly planning session',
        icon: <Calendar className="h-4 w-4" />,
      },
      {
        text: 'Annual planning retreat',
        icon: <Calendar className="h-4 w-4" />,
      },
    ],
    scorecard: [
      {
        text: 'Weekly scorecard metrics',
        icon: <BarChart3 className="h-4 w-4" />,
      },
      {
        text: 'Quarterly scorecard review',
        icon: <BarChart3 className="h-4 w-4" />,
      },
      {
        text: 'KPI tracking and analysis',
        icon: <BarChart3 className="h-4 w-4" />,
      },
    ],
    vision: [
      {
        text: 'Vision/Traction Organizer',
        icon: <Target className="h-4 w-4" />,
      },
      { text: '10-year target planning', icon: <Target className="h-4 w-4" /> },
      { text: 'Core values definition', icon: <Target className="h-4 w-4" /> },
    ],
    process: [
      {
        text: 'Core process documentation',
        icon: <FileText className="h-4 w-4" />,
      },
      {
        text: 'Process improvement workflow',
        icon: <FileText className="h-4 w-4" />,
      },
      {
        text: 'Standard operating procedures',
        icon: <FileText className="h-4 w-4" />,
      },
    ],
    issues: [
      {
        text: 'Issue solving track (IDS)',
        icon: <Search className="h-4 w-4" />,
      },
      {
        text: 'Problem resolution process',
        icon: <Search className="h-4 w-4" />,
      },
      { text: 'Root cause analysis', icon: <Search className="h-4 w-4" /> },
    ],
    people: [
      {
        text: 'People analyzer assessment',
        icon: <Users className="h-4 w-4" />,
      },
      {
        text: 'Accountability chart creation',
        icon: <Users className="h-4 w-4" />,
      },
      {
        text: 'Team structure optimization',
        icon: <Users className="h-4 w-4" />,
      },
    ],
    rocks: [
      {
        text: 'Quarterly rocks planning',
        icon: <Target className="h-4 w-4" />,
      },
      {
        text: 'Rock tracking and updates',
        icon: <Target className="h-4 w-4" />,
      },
      {
        text: 'Priority setting framework',
        icon: <Target className="h-4 w-4" />,
      },
    ],
  };

  const suggestions: SearchSuggestion[] = [];
  const queryLower = query.toLowerCase();

  Object.entries(eosKeywords).forEach(([keyword, items]) => {
    if (queryLower.includes(keyword)) {
      items.forEach((item, index) => {
        suggestions.push({
          id: `${keyword}-${index}`,
          text: item.text,
          type: 'ai-suggested',
          icon: item.icon,
          category: 'EOS Tools',
        });
      });
    }
  });

  // Add fuzzy matching for partial keywords
  if (suggestions.length === 0) {
    Object.entries(eosKeywords).forEach(([keyword, items]) => {
      if (
        keyword.includes(queryLower) ||
        queryLower.includes(keyword.substring(0, 3))
      ) {
        items.slice(0, 2).forEach((item, index) => {
          suggestions.push({
            id: `fuzzy-${keyword}-${index}`,
            text: item.text,
            type: 'ai-suggested',
            icon: item.icon,
            category: 'EOS Tools',
          });
        });
      }
    });
  }

  return suggestions.slice(0, 5);
}

// Search Suggestions Component
interface SearchSuggestionsProps {
  suggestions: SearchSuggestion[];
  onSelect: (suggestion: SearchSuggestion) => void;
  className?: string;
}

export function SearchSuggestions({
  suggestions,
  onSelect,
  className,
}: SearchSuggestionsProps) {
  if (suggestions.length === 0) {
    return null;
  }

  const groupedSuggestions = suggestions.reduce(
    (acc, suggestion) => {
      const category = suggestion.category || 'Other';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(suggestion);
      return acc;
    },
    {} as Record<string, SearchSuggestion[]>,
  );

  return (
    <div className={`space-y-2 ${className}`}>
      {Object.entries(groupedSuggestions).map(([category, items]) => (
        <div key={category}>
          {Object.keys(groupedSuggestions).length > 1 && (
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              {category}
            </h4>
          )}
          <div className="space-y-1">
            {items.map((suggestion) => (
              <button
                key={suggestion.id}
                type="button"
                onClick={() => onSelect(suggestion)}
                className="w-full flex items-center gap-3 p-2 text-left hover:bg-accent rounded-md transition-colors group"
              >
                <div className="flex-shrink-0 text-muted-foreground group-hover:text-eos-orange transition-colors">
                  {suggestion.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate group-hover:text-eos-orange transition-colors">
                    {suggestion.text}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        suggestion.type === 'recent'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                          : suggestion.type === 'popular'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                            : suggestion.type === 'ai-suggested'
                              ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
                              : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                      }`}
                    >
                      {suggestion.type === 'recent'
                        ? 'Recent'
                        : suggestion.type === 'popular'
                          ? 'Popular'
                          : suggestion.type === 'ai-suggested'
                            ? 'AI Suggested'
                            : 'Template'}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
