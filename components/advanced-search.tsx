'use client';

import { useState, useEffect, useRef } from 'react';
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
} from 'lucide-react';
import { motion } from 'framer-motion';
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

interface SearchResult {
  id: string;
  type: 'chat' | 'message' | 'document';
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
}

interface SearchFilters {
  dateRange: 'all' | 'today' | 'week' | 'month' | 'custom';
  types: ('chat' | 'message' | 'document')[];
  personas: string[];
  documentTypes: string[];
  hasBookmarks: boolean | null;
  hasPins: boolean | null;
}

export function AdvancedSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({
    dateRange: 'all',
    types: ['chat', 'message', 'document'],
    personas: [],
    documentTypes: [],
    hasBookmarks: null,
    hasPins: null,
  });
  const [availablePersonas, setAvailablePersonas] = useState<string[]>([]);
  const [activeFilterCount, setActiveFilterCount] = useState(0);
  const [selectedDocument, setSelectedDocument] = useState<SearchResult | null>(
    null,
  );
  const [showDocumentPreview, setShowDocumentPreview] = useState(false);

  const [debouncedQuery] = useDebounceValue(query, 300);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch available filters
  useEffect(() => {
    if (isOpen) {
      fetchAvailableFilters();
    }
  }, [isOpen]);

  // Update active filter count
  useEffect(() => {
    let count = 0;
    if (filters.dateRange !== 'all') count++;
    if (filters.types.length < 3) count++;
    if (filters.hasBookmarks !== null) count++;
    if (filters.hasPins !== null) count++;
    if (filters.personas.length > 0) count++;
    if (filters.documentTypes.length > 0) count++;
    setActiveFilterCount(count);
  }, [filters]);

  // Perform search when query or filters change
  useEffect(() => {
    if (
      debouncedQuery ||
      filters.dateRange !== 'all' ||
      filters.types.length < 3 ||
      filters.hasBookmarks !== null ||
      filters.hasPins !== null
    ) {
      performSearch();
    } else {
      setResults([]);
    }
  }, [debouncedQuery, filters]);

  const fetchAvailableFilters = async () => {
    try {
      const response = await fetch('/api/search/filters');
      const data = await response.json();
      setAvailablePersonas(data.personas || []);
    } catch (error) {
      console.error('Error fetching filters:', error);
    }
  };

  const clearAllFilters = () => {
    setFilters({
      dateRange: 'all',
      types: ['chat', 'message', 'document'],
      personas: [],
      documentTypes: [],
      hasBookmarks: null,
      hasPins: null,
    });
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

      const response = await fetch(`/api/search?${params}`);
      const data = await response.json();

      setResults(data.results || []);
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResultClick = async (result: SearchResult) => {
    if (result.type === 'document') {
      setSelectedDocument(result);
      setShowDocumentPreview(true);
    } else {
      setIsOpen(false);
      if (result.type === 'chat' || result.type === 'message') {
        router.push(`/chat/${result.chatId || result.id}`);
      }
    }
  };

  const getResultIcon = (type: string) => {
    switch (type) {
      case 'chat':
        return <Hash className="h-3 w-3" />;
      case 'message':
        return <User className="h-3 w-3" />;
      case 'document':
        return <FileText className="h-3 w-3" />;
      default:
        return <Search className="h-3 w-3" />;
    }
  };

  const highlightMatches = (text: string, matches?: string[]) => {
    if (!matches || matches.length === 0) return text;

    let highlighted = text;
    matches.forEach((match) => {
      const regex = new RegExp(`(${match})`, 'gi');
      highlighted = highlighted.replace(regex, '<mark>$1</mark>');
    });

    return <span dangerouslySetInnerHTML={{ __html: highlighted }} />;
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
        className="p-2 h-fit"
        onClick={() => setIsOpen(true)}
      >
        <Search size={18} />
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-[100vw] sm:max-w-3xl p-0 gap-0 h-[100vh] sm:h-[80vh] md:h-[700px] flex flex-col w-full border-0 sm:rounded-xl rounded-none shadow-2xl bg-background/95 backdrop-blur-xl [&>button]:hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>Search</DialogTitle>
          </DialogHeader>

          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-eos-orange/20 via-transparent to-eos-navy/20 rounded-t-xl" />
            <div className="relative bg-background/80 backdrop-blur-sm border-b border-border/50 rounded-t-xl">
              <div className="flex items-center px-3 sm:px-4 py-2 sm:py-3 gap-2">
                <div className="flex items-center flex-1 bg-muted/30 rounded-lg px-3 py-2 border border-border/30 backdrop-blur-sm transition-all duration-200 hover:border-eos-orange/30 focus-within:border-eos-orange/50 focus-within:bg-background/50">
                  <Search className="h-3 w-3 text-muted-foreground mr-2 flex-shrink-0" />
                  <input
                    ref={inputRef}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Type to search..."
                    className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
                  />
                  {query && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 rounded-full hover:bg-muted/50 transition-colors ml-1"
                      onClick={() => setQuery('')}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 rounded-lg hover:bg-muted/50 transition-colors"
                  onClick={() => setIsOpen(false)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>

              <div className="px-4 sm:px-6 pb-4">
                <div className="flex items-center gap-2 mb-4">
                  <Filter className="h-4 w-4 text-eos-orange" />
                  <span className="text-sm font-medium">Filters</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                          'h-9 px-3 py-2 border-2 transition-all duration-200 text-sm font-medium w-full justify-between',
                          filters.dateRange !== 'all'
                            ? 'border-eos-orange bg-eos-orange/10 text-eos-orange hover:bg-eos-orange/20'
                            : 'border-border bg-background hover:border-eos-orange/50',
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          <span>
                            {filters.dateRange === 'all'
                              ? 'Any time'
                              : filters.dateRange === 'today'
                                ? 'Today'
                                : filters.dateRange === 'week'
                                  ? 'This week'
                                  : filters.dateRange === 'month'
                                    ? 'This month'
                                    : filters.dateRange}
                          </span>
                        </div>
                        <ChevronDown className="h-4 w-4 opacity-50" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-[150px]">
                      <DropdownMenuLabel>Date Range</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {['all', 'today', 'week', 'month'].map((range) => (
                        <DropdownMenuItem
                          key={range}
                          onClick={() =>
                            setFilters({ ...filters, dateRange: range as any })
                          }
                        >
                          {range === 'all'
                            ? 'Any time'
                            : range.charAt(0).toUpperCase() + range.slice(1)}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                          'h-9 px-3 py-2 border-2 transition-all duration-200 text-sm font-medium w-full justify-between',
                          filters.types.length < 3
                            ? 'border-eos-orange bg-eos-orange/10 text-eos-orange hover:bg-eos-orange/20'
                            : 'border-border bg-background hover:border-eos-orange/50',
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <Filter className="h-4 w-4" />
                          <span>Content Types ({filters.types.length})</span>
                        </div>
                        <ChevronDown className="h-4 w-4 opacity-50" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-[150px]">
                      <DropdownMenuLabel>Content Types</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {['chat', 'message', 'document'].map((type) => (
                        <DropdownMenuCheckboxItem
                          key={type}
                          checked={filters.types.includes(type as any)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setFilters({
                                ...filters,
                                types: [...filters.types, type as any],
                              });
                            } else {
                              setFilters({
                                ...filters,
                                types: filters.types.filter((t) => t !== type),
                              });
                            }
                          }}
                        >
                          {type.charAt(0).toUpperCase() + type.slice(1)}s
                        </DropdownMenuCheckboxItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                          'h-9 px-3 py-2 border-2 transition-all duration-200 text-sm font-medium w-full justify-between',
                          filters.hasBookmarks !== null ||
                            filters.hasPins !== null
                            ? 'border-eos-orange bg-eos-orange/10 text-eos-orange hover:bg-eos-orange/20'
                            : 'border-border bg-background hover:border-eos-orange/50',
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <Bookmark className="h-4 w-4" />
                          <span>Saved Content</span>
                          {(filters.hasBookmarks !== null ||
                            filters.hasPins !== null) && (
                            <span className="ml-1 bg-eos-orange/20 text-eos-orange px-1 py-0.5 rounded text-xs font-semibold">
                              {(filters.hasBookmarks ? 1 : 0) +
                                (filters.hasPins ? 1 : 0)}
                            </span>
                          )}
                        </div>
                        <ChevronDown className="h-4 w-4 opacity-50" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-[180px]">
                      <DropdownMenuLabel>Saved Messages</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuCheckboxItem
                        checked={filters.hasBookmarks === true}
                        onCheckedChange={(checked) => {
                          setFilters({
                            ...filters,
                            hasBookmarks: checked ? true : null,
                          });
                        }}
                      >
                        <Bookmark className="mr-1 h-3 w-3 text-blue-500" />
                        Has Bookmarks
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuCheckboxItem
                        checked={filters.hasPins === true}
                        onCheckedChange={(checked) => {
                          setFilters({
                            ...filters,
                            hasPins: checked ? true : null,
                          });
                        }}
                      >
                        <Pin className="mr-1 h-3 w-3 text-eos-orange" />
                        Has Pins
                      </DropdownMenuCheckboxItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {availablePersonas.length > 0 && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className={cn(
                            'h-9 px-3 py-2 border-2 transition-all duration-200 text-sm font-medium w-full justify-between',
                            filters.personas.length > 0
                              ? 'border-eos-orange bg-eos-orange/10 text-eos-orange hover:bg-eos-orange/20'
                              : 'border-border bg-background hover:border-eos-orange/50',
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            <span>Personas</span>
                            {filters.personas.length > 0 && (
                              <span className="ml-1 bg-eos-orange/20 text-eos-orange px-1 py-0.5 rounded text-xs font-semibold">
                                {filters.personas.length}
                              </span>
                            )}
                          </div>
                          <ChevronDown className="h-4 w-4 opacity-50" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-[200px]">
                        <DropdownMenuLabel>Personas</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {availablePersonas.map((persona) => (
                          <DropdownMenuCheckboxItem
                            key={persona}
                            checked={filters.personas.includes(persona)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setFilters({
                                  ...filters,
                                  personas: [...filters.personas, persona],
                                });
                              } else {
                                setFilters({
                                  ...filters,
                                  personas: filters.personas.filter(
                                    (p) => p !== persona,
                                  ),
                                });
                              }
                            }}
                          >
                            {persona}
                          </DropdownMenuCheckboxItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}

                  {activeFilterCount > 0 && (
                    <div className="col-span-full flex items-center justify-between mt-2 pt-2 border-t border-border/20">
                      <Badge
                        variant="secondary"
                        className="text-xs bg-eos-orange/10 text-eos-orange border-eos-orange/30 py-1 px-2"
                      >
                        {activeFilterCount} filter
                        {activeFilterCount !== 1 ? 's' : ''} active
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs text-muted-foreground hover:text-eos-orange hover:bg-eos-orange/10 transition-colors font-medium"
                        onClick={clearAllFilters}
                      >
                        Clear all filters
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="px-3 sm:px-4 py-3">
                {isLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2 p-3 rounded-xl border border-border/30 bg-muted/20"
                      >
                        <Skeleton className="h-5 w-5 mt-1 rounded-lg" />
                        <div className="space-y-2 flex-1">
                          <Skeleton className="h-5 w-3/4 rounded-lg" />
                          <Skeleton className="h-4 w-full rounded-lg" />
                          <Skeleton className="h-4 w-1/2 rounded-lg" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : results.length > 0 ? (
                  <div className="space-y-4">
                    {results.map((result) => (
                      <motion.div
                        key={result.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        whileHover={{ scale: 1.01 }}
                        transition={{ duration: 0.15 }}
                        className="group flex items-start gap-2 rounded-xl p-3 cursor-pointer transition-all duration-200 border border-border/30 bg-background/50 backdrop-blur-sm hover:border-eos-orange/30 hover:bg-eos-orange/5"
                        onClick={() => handleResultClick(result)}
                      >
                        <div className="mt-1 p-2 rounded-lg bg-muted/30 group-hover:bg-eos-orange/10 transition-colors">
                          {getResultIcon(result.type)}
                        </div>
                        <div className="flex-1 overflow-hidden">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-semibold text-base truncate group-hover:text-eos-orange transition-colors">
                              {highlightMatches(result.title, result.matches)}
                            </span>
                            {result.hasPinnedMessages && (
                              <Pin className="h-3 w-3 text-eos-orange flex-shrink-0" />
                            )}
                            {result.hasBookmarkedMessages && (
                              <Bookmark className="h-3 w-3 text-blue-500 flex-shrink-0" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2 mb-2 leading-relaxed">
                            {highlightMatches(result.preview, result.matches)}
                          </p>
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-muted-foreground">
                              {format(
                                new Date(result.createdAt),
                                'MMM d, yyyy',
                              )}
                            </p>
                            {result.score && (
                              <span className="text-xs text-muted-foreground bg-muted/30 px-2 py-0.5 rounded-md">
                                {Math.round(result.score * 100)}% match
                              </span>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : query ||
                  filters.dateRange !== 'all' ||
                  filters.types.length < 3 ? (
                  <div className="text-center py-16">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-muted/30 flex items-center justify-center">
                      <Search className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-foreground mb-2 font-medium">
                      No results found
                    </p>
                    <div className="space-y-2 mt-4">
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
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-gradient-to-br from-eos-orange/20 to-eos-navy/20 flex items-center justify-center">
                      <Search className="h-6 w-6 text-eos-orange" />
                    </div>
                    <p className="text-sm text-foreground font-medium mb-2">
                      What are you looking for?
                    </p>
                    <p className="text-xs text-muted-foreground mb-4">
                      Search across all your conversations, messages, and
                      documents
                    </p>
                    <div className="flex flex-wrap gap-2 justify-center max-w-md mx-auto">
                      <Badge
                        variant="outline"
                        className="cursor-pointer hover:bg-eos-orange/10 hover:text-eos-orange hover:border-eos-orange/30 transition-all"
                        onClick={() => setQuery('L10 meeting')}
                      >
                        <MessageSquare className="h-3 w-3 mr-1" />
                        L10 meetings
                      </Badge>
                      <Badge
                        variant="outline"
                        className="cursor-pointer hover:bg-eos-orange/10 hover:text-eos-orange hover:border-eos-orange/30 transition-all"
                        onClick={() => setQuery('scorecard')}
                      >
                        <FileText className="h-3 w-3 mr-1" />
                        Scorecards
                      </Badge>
                      <Badge
                        variant="outline"
                        className="cursor-pointer hover:bg-eos-orange/10 hover:text-eos-orange hover:border-eos-orange/30 transition-all"
                        onClick={() => setQuery('quarterly rocks')}
                      >
                        <Pin className="h-3 w-3 mr-1" />
                        Quarterly rocks
                      </Badge>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          <div className="border-t border-border/30 bg-muted/20 backdrop-blur-sm rounded-b-xl">
            <div className="px-3 sm:px-4 py-3 flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <span className="hidden sm:flex items-center gap-1 text-muted-foreground">
                  <kbd className="pointer-events-none inline-flex h-6 select-none items-center gap-1 rounded-md border border-border/30 bg-background/50 px-2 font-mono text-xs font-medium">
                    ↑↓
                  </kbd>
                  Navigate
                </span>
                <span className="hidden sm:flex items-center gap-1 text-muted-foreground">
                  <kbd className="pointer-events-none inline-flex h-6 select-none items-center gap-1 rounded-md border border-border/30 bg-background/50 px-2 font-mono text-xs font-medium">
                    ↵
                  </kbd>
                  Open
                </span>
                <span className="flex items-center gap-1 text-muted-foreground">
                  <kbd className="pointer-events-none inline-flex h-6 select-none items-center gap-1 rounded-md border border-border/30 bg-background/50 px-2 font-mono text-xs font-medium">
                    esc
                  </kbd>
                  <span className="hidden sm:inline">Close</span>
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
