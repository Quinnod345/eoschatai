'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search,
  X,
  Calendar,
  FileText,
  User,
  Hash,
  Filter,
  ChevronDown,
  Pin,
  Bookmark,
  MessageSquare,
  Mic,
  Clock,
  Users,
  Sparkles,
  ArrowRight,
  FileAudio,
  PlayCircle,
  XCircle,
  RotateCcw,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useDebounceValue } from 'usehooks-ts';
import { marked } from 'marked';
import RecordingModal from '@/components/recording-modal';
import {
  LoadingSpinner,
  LoadingOverlay,
} from '@/components/ui/loading-spinner';
import { useLoading } from '@/hooks/use-loading';
import { useOptimizedNavigation } from '@/hooks/use-optimized-navigation';

interface SearchResult {
  id: string;
  type: 'chat' | 'message' | 'document' | 'recording';
  title: string;
  preview: string;
  createdAt: Date;
  chatId?: string;
  documentType?: string;
  personaName?: string;
  matches?: string[];
  source?: 'user' | 'user-rag' | 'persona-rag';
  score?: number;
  hasPinnedMessages?: boolean;
  hasBookmarkedMessages?: boolean;
  // Recording-specific fields
  speakers?: number;
  duration?: number;
  summary?: string;
  transcript?: string;
  segments?: any[];
  recordingData?: any;
}

interface SearchFilters {
  dateRange: 'all' | 'today' | 'week' | 'month';
  types: ('chat' | 'message' | 'document' | 'recording')[];
  personas: string[];
  documentTypes: string[];
  hasBookmarks: boolean | null;
  hasPins: boolean | null;
}

interface QuickFilter {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  query?: string;
  filters?: Partial<SearchFilters>;
}

const quickFilters: QuickFilter[] = [
  {
    id: 'recent-chats',
    label: 'Recent Chats',
    icon: MessageSquare,
    filters: { types: ['chat'], dateRange: 'week' },
  },
  {
    id: 'recordings',
    label: 'Recordings',
    icon: Mic,
    filters: { types: ['recording'] },
  },
  {
    id: 'documents',
    label: 'Documents',
    icon: FileText,
    filters: { types: ['document'] },
  },
  {
    id: 'bookmarked',
    label: 'Bookmarked',
    icon: Bookmark,
    filters: { hasBookmarks: true },
  },
  {
    id: 'pinned',
    label: 'Pinned',
    icon: Pin,
    filters: { hasPins: true },
  },
];

const searchSuggestions = [
  { query: 'L10 meeting', icon: Users, label: 'L10 meetings' },
  { query: 'scorecard', icon: FileText, label: 'Scorecards' },
  { query: 'quarterly rocks', icon: Pin, label: 'Quarterly rocks' },
  { query: 'action items', icon: ArrowRight, label: 'Action items' },
];

export function AdvancedSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({
    dateRange: 'all',
    types: ['chat', 'message', 'document', 'recording'],
    personas: [],
    documentTypes: [],
    hasBookmarks: null,
    hasPins: null,
  });
  const [availablePersonas, setAvailablePersonas] = useState<string[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<SearchResult | null>(
    null,
  );
  const [showDocumentPreview, setShowDocumentPreview] = useState(false);
  const [showRecordingModal, setShowRecordingModal] = useState(false);
  const [selectedRecording, setSelectedRecording] = useState<any>(null);
  const [activeQuickFilter, setActiveQuickFilter] = useState<string | null>(
    null,
  );
  const [isNavigating, setIsNavigating] = useState(false);

  const [debouncedQuery] = useDebounceValue(query, 300);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const { setLoading } = useLoading();
  const { navigateToChat } = useOptimizedNavigation();

  // Fetch available filters
  useEffect(() => {
    if (isOpen) {
      fetchAvailableFilters();
    }
  }, [isOpen]);

  // Perform search when query or filters change
  useEffect(() => {
    if (debouncedQuery.trim() || hasActiveFilters()) {
      performSearch();
    } else {
      setResults([]);
    }
  }, [debouncedQuery, filters]);

  const hasActiveFilters = useCallback(() => {
    return (
      filters.dateRange !== 'all' ||
      filters.types.length < 4 ||
      filters.hasBookmarks !== null ||
      filters.hasPins !== null ||
      filters.personas.length > 0 ||
      filters.documentTypes.length > 0
    );
  }, [filters]);

  const fetchAvailableFilters = async () => {
    try {
      const response = await fetch('/api/search/filters');
      const data = await response.json();
      setAvailablePersonas(data.personas || []);
    } catch (error) {
      console.error('Error fetching filters:', error);
    }
  };

  const performSearch = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        q: debouncedQuery,
        dateRange: filters.dateRange,
        types: filters.types.join(','),
        personas: filters.personas.join(','),
        documentTypes: filters.documentTypes.join(','),
      });

      if (filters.hasBookmarks !== null) {
        params.append('hasBookmarks', filters.hasBookmarks.toString());
      }
      if (filters.hasPins !== null) {
        params.append('hasPins', filters.hasPins.toString());
      }

      const [searchResponse, recordingsResponse] = await Promise.all([
        fetch(`/api/search?${params}`),
        filters.types.includes('recording')
          ? fetchRecordings(debouncedQuery)
          : Promise.resolve([]),
      ]);

      const searchData = await searchResponse.json();
      const recordingResults = await recordingsResponse;

      const allResults = [...(searchData.results || []), ...recordingResults];

      // Sort by relevance and date
      allResults.sort((a, b) => {
        if (a.score && b.score) return b.score - a.score;
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      });

      setResults(allResults);
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRecordings = async (
    searchQuery: string,
  ): Promise<SearchResult[]> => {
    try {
      // Get recordings from localStorage (this matches the recording modal's approach)
      const stored = localStorage.getItem('voiceRecordings');
      if (!stored) return [];

      const recordings = JSON.parse(stored);

      return recordings
        .filter((rec: any) => {
          if (!searchQuery.trim()) return true;

          const searchLower = searchQuery.toLowerCase();
          const titleMatch = new Date(rec.createdAt)
            .toLocaleDateString()
            .toLowerCase()
            .includes(searchLower);
          const transcriptMatch =
            rec.transcript?.toLowerCase().includes(searchLower) || false;
          const summaryMatch =
            rec.summary?.toLowerCase().includes(searchLower) || false;

          return titleMatch || transcriptMatch || summaryMatch;
        })
        .map((rec: any) => ({
          id: rec.id,
          type: 'recording' as const,
          title: `Recording - ${new Date(rec.createdAt).toLocaleDateString()}`,
          preview:
            rec.summary ||
            `${rec.transcript?.substring(0, 150)}...` ||
            'No transcript available',
          createdAt: new Date(rec.createdAt),
          speakers: rec.speakers,
          duration: rec.duration,
          summary: rec.summary,
          transcript: rec.transcript,
          segments: rec.segments,
          recordingData: rec,
          matches: searchQuery.trim() ? [searchQuery] : [],
        }));
    } catch (error) {
      console.error('Error fetching recordings:', error);
      return [];
    }
  };

  const handleResultClick = async (result: SearchResult) => {
    if (result.type === 'document') {
      setSelectedDocument(result);
      setShowDocumentPreview(true);
    } else if (result.type === 'recording') {
      setSelectedRecording(result.recordingData);
      setIsOpen(false);
      setShowRecordingModal(true);
    } else {
      setIsOpen(false);

      if (result.type === 'chat' || result.type === 'message') {
        const chatId = result.chatId || result.id;
        // Show loading immediately for better UX
        const { setLoading } = useLoading.getState();
        setLoading(true, 'Opening conversation...', 'chat');
        router.push(`/chat/${chatId}`);
      }
    }
  };

  const applyQuickFilter = (filter: QuickFilter) => {
    setActiveQuickFilter(activeQuickFilter === filter.id ? null : filter.id);

    if (activeQuickFilter === filter.id) {
      // Reset filters
      setFilters({
        dateRange: 'all',
        types: ['chat', 'message', 'document', 'recording'],
        personas: [],
        documentTypes: [],
        hasBookmarks: null,
        hasPins: null,
      });
    } else {
      // Apply filter
      setFilters((prev) => ({
        ...prev,
        ...filter.filters,
      }));

      if (filter.query) {
        setQuery(filter.query);
      }
    }
  };

  const clearAllFilters = () => {
    setFilters({
      dateRange: 'all',
      types: ['chat', 'message', 'document', 'recording'],
      personas: [],
      documentTypes: [],
      hasBookmarks: null,
      hasPins: null,
    });
    setActiveQuickFilter(null);
  };

  const getResultIcon = (type: string) => {
    switch (type) {
      case 'chat':
        return <Hash className="h-4 w-4" />;
      case 'message':
        return <MessageSquare className="h-4 w-4" />;
      case 'document':
        return <FileText className="h-4 w-4" />;
      case 'recording':
        return <FileAudio className="h-4 w-4" />;
      default:
        return <Search className="h-4 w-4" />;
    }
  };

  const highlightMatches = (text: string, matches?: string[]) => {
    if (!matches || matches.length === 0) return text;

    let highlighted = text;
    matches.forEach((match) => {
      const regex = new RegExp(`(${match})`, 'gi');
      highlighted = highlighted.replace(
        regex,
        '<mark class="bg-eos-orange/20 text-eos-orange">$1</mark>',
      );
    });

    return <span dangerouslySetInnerHTML={{ __html: highlighted }} />;
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Focus input when dialog opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  return (
    <>
      <Button
        variant="ghost"
        type="button"
        className="p-2 h-fit hover:bg-muted/50 transition-colors"
        onClick={() => setIsOpen(true)}
      >
        <Search size={18} />
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-4xl p-0 gap-0 h-[85vh] flex flex-col border-0 shadow-2xl bg-background/95 backdrop-blur-xl rounded-xl [&>button]:hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>Search</DialogTitle>
          </DialogHeader>

          {/* Header */}
          <div className="relative border-b bg-background/80 backdrop-blur-sm rounded-t-xl">
            <div className="absolute inset-0 bg-gradient-to-r from-eos-orange/10 via-transparent to-eos-navy/10 rounded-t-xl" />
            <div className="relative p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center flex-1 bg-muted/30 rounded-xl px-4 py-3 backdrop-blur-sm transition-all duration-200 hover:bg-muted/40 focus-within:bg-background/50 focus-within:shadow-[0_0_0_2px_rgba(255,118,0,0.2)] focus-within:border-transparent">
                  <Search className="h-5 w-5 text-muted-foreground mr-3 flex-shrink-0" />
                  <input
                    ref={inputRef}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search conversations, documents, recordings..."
                    className="flex-1 bg-transparent text-base outline-none border-0 focus:ring-0 focus:outline-none focus:border-0 focus:shadow-none placeholder:text-muted-foreground/70"
                    style={{
                      border: 'none',
                      outline: 'none',
                      boxShadow: 'none',
                    }}
                  />
                  {query && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 rounded-full hover:bg-muted/50 transition-colors"
                      onClick={() => setQuery('')}
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-10 w-10 p-0 rounded-xl hover:bg-muted/50 transition-colors"
                  onClick={() => setIsOpen(false)}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {/* Quick Filters */}
              <div className="flex items-center gap-2 mb-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Sparkles className="h-4 w-4" />
                  <span className="font-medium">Quick Filters</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {quickFilters.map((filter) => (
                  <Button
                    key={filter.id}
                    variant="outline"
                    size="sm"
                    className={cn(
                      'h-9 px-3 py-2 border transition-all duration-200 text-sm font-medium',
                      activeQuickFilter === filter.id
                        ? 'border-eos-orange bg-eos-orange/10 text-eos-orange hover:bg-eos-orange/20'
                        : 'border-border bg-background hover:border-eos-orange/30 hover:bg-eos-orange/5',
                    )}
                    onClick={() => applyQuickFilter(filter)}
                  >
                    <filter.icon className="h-4 w-4 mr-2" />
                    {filter.label}
                  </Button>
                ))}

                {hasActiveFilters() && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 text-xs text-muted-foreground hover:text-eos-orange hover:bg-eos-orange/10 transition-colors font-medium"
                    onClick={clearAllFilters}
                  >
                    Clear all
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Results */}
          <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-6">
                <AnimatePresence mode="wait">
                  {isLoading ? (
                    <motion.div
                      key="loading"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="space-y-3"
                    >
                      {[1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className="flex items-start gap-3 p-4 rounded-xl border border-border/30 bg-muted/20"
                        >
                          <Skeleton className="h-10 w-10 rounded-lg" />
                          <div className="space-y-2 flex-1">
                            <Skeleton className="h-5 w-3/4 rounded-lg" />
                            <Skeleton className="h-4 w-full rounded-lg" />
                            <Skeleton className="h-4 w-1/2 rounded-lg" />
                          </div>
                        </div>
                      ))}
                    </motion.div>
                  ) : results.length > 0 ? (
                    <motion.div
                      key="results"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="space-y-3"
                    >
                      {results.map((result, index) => (
                        <motion.div
                          key={result.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                          whileHover={{ scale: 1.01 }}
                          className="group flex items-start gap-3 rounded-xl p-4 cursor-pointer transition-all duration-200 border border-border/30 bg-background/50 backdrop-blur-sm hover:border-eos-orange/30 hover:bg-eos-orange/5 hover:shadow-md"
                          onClick={() => handleResultClick(result)}
                        >
                          <div
                            className={cn(
                              'mt-1 p-2.5 rounded-lg transition-colors flex-shrink-0',
                              result.type === 'recording'
                                ? 'bg-purple-100 dark:bg-purple-900/30 group-hover:bg-purple-200 dark:group-hover:bg-purple-900/50'
                                : result.type === 'document'
                                  ? 'bg-blue-100 dark:bg-blue-900/30 group-hover:bg-blue-200 dark:group-hover:bg-blue-900/50'
                                  : result.type === 'chat'
                                    ? 'bg-green-100 dark:bg-green-900/30 group-hover:bg-green-200 dark:group-hover:bg-green-900/50'
                                    : 'bg-orange-100 dark:bg-orange-900/30 group-hover:bg-orange-200 dark:group-hover:bg-orange-900/50',
                            )}
                          >
                            {getResultIcon(result.type)}
                          </div>

                          <div className="flex-1 overflow-hidden">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="font-semibold text-base truncate group-hover:text-eos-orange transition-colors">
                                {highlightMatches(result.title, result.matches)}
                              </span>

                              {result.type === 'recording' && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  {result.speakers && (
                                    <Badge
                                      variant="secondary"
                                      className="text-xs px-2 py-0"
                                    >
                                      <Users className="h-3 w-3 mr-1" />
                                      {result.speakers}
                                    </Badge>
                                  )}
                                  {result.duration && (
                                    <Badge
                                      variant="secondary"
                                      className="text-xs px-2 py-0"
                                    >
                                      <Clock className="h-3 w-3 mr-1" />
                                      {formatDuration(result.duration)}
                                    </Badge>
                                  )}
                                </div>
                              )}

                              {result.hasPinnedMessages && (
                                <Pin className="h-3 w-3 text-eos-orange flex-shrink-0" />
                              )}
                              {result.hasBookmarkedMessages && (
                                <Bookmark className="h-3 w-3 text-blue-500 flex-shrink-0" />
                              )}
                            </div>

                            <p className="text-sm text-muted-foreground line-clamp-2 mb-3 leading-relaxed">
                              {highlightMatches(result.preview, result.matches)}
                            </p>

                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                <span>
                                  {format(
                                    new Date(result.createdAt),
                                    'MMM d, yyyy',
                                  )}
                                </span>
                                {result.personaName && (
                                  <>
                                    <span>•</span>
                                    <span className="text-eos-orange">
                                      {result.personaName}
                                    </span>
                                  </>
                                )}
                              </div>

                              {result.score && (
                                <Badge variant="outline" className="text-xs">
                                  {Math.round(result.score * 100)}% match
                                </Badge>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </motion.div>
                  ) : query.trim() || hasActiveFilters() ? (
                    <motion.div
                      key="no-results"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="text-center py-16"
                    >
                      <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-muted/30 flex items-center justify-center">
                        <Search className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <p className="text-lg text-foreground mb-2 font-medium">
                        No results found
                      </p>
                      <div className="space-y-3 mt-6">
                        <p className="text-sm text-muted-foreground">
                          Try these search tips:
                        </p>
                        <ul className="text-sm text-muted-foreground space-y-1 max-w-sm mx-auto">
                          <li>• Use different keywords</li>
                          <li>• Check your spelling</li>
                          <li>• Try more general terms</li>
                          <li>• Remove some filters</li>
                        </ul>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="welcome"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="text-center py-16"
                    >
                      <div className="w-20 h-20 mx-auto mb-6 rounded-xl bg-gradient-to-br from-eos-orange/20 to-eos-navy/20 flex items-center justify-center">
                        <Search className="h-8 w-8 text-eos-orange" />
                      </div>
                      <p className="text-xl text-foreground font-semibold mb-2">
                        What are you looking for?
                      </p>
                      <p className="text-sm text-muted-foreground mb-8">
                        Search across all your conversations, messages,
                        documents, and recordings
                      </p>

                      <div className="space-y-4">
                        <p className="text-sm font-medium text-muted-foreground">
                          Try searching for:
                        </p>
                        <div className="flex flex-wrap gap-2 justify-center max-w-md mx-auto">
                          {searchSuggestions.map((suggestion) => (
                            <Badge
                              key={suggestion.query}
                              variant="outline"
                              className="cursor-pointer hover:bg-eos-orange/10 hover:text-eos-orange hover:border-eos-orange/30 transition-all px-3 py-1"
                              onClick={() => setQuery(suggestion.query)}
                            >
                              <suggestion.icon className="h-3 w-3 mr-1.5" />
                              {suggestion.label}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </ScrollArea>
          </div>

          {/* Footer */}
          <div className="border-t border-border/30 bg-muted/20 backdrop-blur-sm rounded-b-xl">
            <div className="px-6 py-4 flex items-center justify-between text-xs">
              <div className="flex items-center gap-4">
                <span className="hidden sm:flex items-center gap-1 text-muted-foreground">
                  <kbd className="pointer-events-none inline-flex h-6 select-none items-center gap-1 rounded-md border border-border/30 bg-background/50 px-2 font-mono text-xs font-medium">
                    ⌘K
                  </kbd>
                  Search
                </span>
                <span className="flex items-center gap-1 text-muted-foreground">
                  <kbd className="pointer-events-none inline-flex h-6 select-none items-center gap-1 rounded-md border border-border/30 bg-background/50 px-2 font-mono text-xs font-medium">
                    esc
                  </kbd>
                  Close
                </span>
              </div>
              {results.length > 0 && (
                <span className="text-muted-foreground font-medium">
                  {results.length} result{results.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Document Preview Modal */}
      {selectedDocument && showDocumentPreview && (
        <Dialog
          open={showDocumentPreview}
          onOpenChange={setShowDocumentPreview}
        >
          <DialogContent className="max-w-4xl h-[85vh] p-0 overflow-hidden flex flex-col">
            <DialogHeader className="px-4 py-3 border-b flex-shrink-0">
              <DialogTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-base font-semibold truncate">
                    {selectedDocument.title}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => {
                    setShowDocumentPreview(false);
                    setIsOpen(false);
                    router.push(
                      `/chat?userDocumentId=${selectedDocument.id}&documentTitle=${encodeURIComponent(selectedDocument.title)}`,
                    );
                  }}
                >
                  Open in Chat
                </Button>
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-hidden">
              <DocumentPreviewContent documentId={selectedDocument.id} />
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Recording Modal */}
      {showRecordingModal && (
        <RecordingModal
          isOpen={showRecordingModal}
          onClose={() => {
            setShowRecordingModal(false);
            setSelectedRecording(null);
          }}
          selectedRecordingId={selectedRecording?.id}
        />
      )}
    </>
  );
}

function DocumentPreviewContent({ documentId }: { documentId: string }) {
  const [document, setDocument] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDocument = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/user-documents`);

        if (!response.ok) {
          throw new Error('Failed to fetch documents');
        }

        const data = await response.json();
        const foundDocument = data.find((doc: any) => doc.id === documentId);

        if (!foundDocument) {
          throw new Error('Document not found');
        }

        setDocument(foundDocument);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to load document',
        );
      } finally {
        setIsLoading(false);
      }
    };

    if (documentId) {
      fetchDocument();
    }
  }, [documentId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="space-y-3">
          <Skeleton className="h-4 w-32 mx-auto" />
          <Skeleton className="h-32 w-64" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="text-center">
          <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>Failed to load document</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="text-center">
          <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>Document not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2 border-b bg-muted/20 flex-shrink-0">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{document.fileType}</span>
          <span>•</span>
          <span>{document.category}</span>
          <span>•</span>
          <span>{(document.fileSize / 1024).toFixed(1)} KB</span>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4">
          <div
            className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed"
            dangerouslySetInnerHTML={{
              __html: marked(document.content, {
                gfm: true,
                breaks: true,
              }),
            }}
          />
        </div>
      </ScrollArea>
    </div>
  );
}
