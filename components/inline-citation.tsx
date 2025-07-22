'use client';

import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface InlineCitationProps {
  sourceNumber: number;
  title: string;
  url: string;
  snippet?: string;
  className?: string;
}

export function InlineCitation({
  sourceNumber,
  title,
  url,
  snippet,
  className,
}: InlineCitationProps) {
  const handleClick = () => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClick}
            className={cn(
              'inline-flex items-center gap-1 h-5 px-1.5 py-0 text-xs font-medium',
              'bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/30 dark:hover:bg-blue-950/50',
              'text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300',
              'border border-blue-200 dark:border-blue-800 rounded-sm',
              'transition-colors duration-200',
              className,
            )}
          >
            [{sourceNumber}]
            <ExternalLink className="h-2.5 w-2.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-md p-0 overflow-hidden">
          <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 p-4">
            <div className="flex items-start gap-2 mb-2">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center">
                <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                  {sourceNumber}
                </span>
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-sm text-gray-900 dark:text-gray-100 line-clamp-2">
                  {title}
                </h4>
              </div>
            </div>

            {snippet && (
              <div className="mb-3 p-3 bg-white/60 dark:bg-gray-800/60 rounded-md">
                <p className="text-xs text-gray-700 dark:text-gray-300 line-clamp-4">
                  {snippet}
                </p>
              </div>
            )}

            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {new URL(url).hostname}
                </p>
              </div>
              <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                <span className="text-xs">View source</span>
                <ExternalLink className="h-3 w-3" />
              </div>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface CitationReference {
  number: number;
  title: string;
  url: string;
  snippet?: string;
}

interface CitationRendererProps {
  text: string;
  citations: CitationReference[];
  className?: string;
}

export function CitationRenderer({
  text,
  citations,
  className,
}: CitationRendererProps) {
  // Replace citation patterns [1], [2], etc. with clickable citation components
  const parts = text.split(/(\[\d+\])/g);

  // Track citation occurrences for unique keys
  const citationOccurrences = new Map<number, number>();
  let textPartCounter = 0;

  return (
    <span className={className}>
      {parts.map((part, index) => {
        const citationMatch = part.match(/\[(\d+)\]/);
        if (citationMatch) {
          const sourceNumber = Number.parseInt(citationMatch[1], 10);
          const citation = citations.find((c) => c.number === sourceNumber);

          if (citation) {
            // Track occurrence count for this citation number
            const occurrenceCount =
              (citationOccurrences.get(sourceNumber) || 0) + 1;
            citationOccurrences.set(sourceNumber, occurrenceCount);

            return (
              <InlineCitation
                key={`citation-${sourceNumber}-occurrence-${occurrenceCount}`}
                sourceNumber={sourceNumber}
                title={citation.title}
                url={citation.url}
                snippet={citation.snippet}
              />
            );
          }
        }
        // Use a counter for text parts to ensure unique keys
        textPartCounter += 1;
        return <span key={`text-part-${textPartCounter}`}>{part}</span>;
      })}
    </span>
  );
}
