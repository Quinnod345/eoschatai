'use client';

import { ExternalLink, Search, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';

interface SearchResult {
  position: number;
  title: string;
  url: string;
  snippet: string;
  content?: string;
}

interface SearchResultsProps {
  results: SearchResult[];
  query?: string;
}

export function SearchResults({ results, query }: SearchResultsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!results || results.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="my-4"
    >
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm shadow-sm overflow-visible">
        {/* Collapsible Header - Always Visible */}
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full p-4 flex items-center gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors text-left rounded-t-lg"
        >
          {/* Animated Chevron */}
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="flex-shrink-0"
          >
            <ChevronDown className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
          </motion.div>

          {/* Search Icon */}
          <Search className="w-4 h-4 text-zinc-500 dark:text-zinc-400 flex-shrink-0" />

          {/* Title and Query */}
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 block">
              Web Search Results
            </span>
            {query && (
              <span className="text-xs text-zinc-500 dark:text-zinc-400 truncate block mt-0.5">
                &quot;{query}&quot;
              </span>
            )}
          </div>

          {/* Result Count Badge */}
          <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300 flex-shrink-0 px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
            {results.length}
          </span>
        </button>

        {/* Expandable Content */}
        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{
                duration: 0.3,
                ease: [0.4, 0, 0.2, 1],
                opacity: { duration: 0.2 },
              }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 border-t border-zinc-200 dark:border-zinc-800">
                {/* Results List */}
                <div className="space-y-2 mt-4">
                  {results.map((result, index) => (
                    <motion.a
                      key={result.url}
                      href={result.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{
                        duration: 0.2,
                        delay: index * 0.05,
                        ease: [0.4, 0, 0.2, 1],
                      }}
                      className="block group"
                    >
                      <div className="p-3 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-all duration-200 border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700 hover:shadow-sm">
                        {/* Title and URL */}
                        <div className="flex items-start gap-2.5 mb-1.5">
                          {/* Position Number */}
                          <span className="text-xs font-mono text-zinc-400 dark:text-zinc-500 mt-1 flex-shrink-0 w-4">
                            {result.position}
                          </span>

                          <div className="flex-1 min-w-0">
                            {/* Title */}
                            <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors mb-1.5 leading-snug line-clamp-2">
                              {result.title}
                            </h3>

                            {/* Domain and External Link Icon */}
                            <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                              <span className="truncate">
                                {new URL(result.url).hostname}
                              </span>
                              <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                            </div>
                          </div>
                        </div>

                        {/* Snippet */}
                        {result.snippet && (
                          <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2 ml-6 leading-relaxed">
                            {result.snippet}
                          </p>
                        )}
                      </div>
                    </motion.a>
                  ))}
                </div>

                {/* Footer Note */}
                <div className="mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 text-center">
                    Click any result to open in a new tab
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
