'use client';

import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
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
  className 
}: InlineCitationProps) {
  const handleClick = () => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <Tooltip
      content={
        <div className="max-w-xs p-2">
          <div className="font-medium text-sm mb-1">{title}</div>
          {snippet && (
            <div className="text-xs text-muted-foreground mb-2">{snippet}</div>
          )}
          <div className="text-xs text-blue-400 break-all">{url}</div>
        </div>
      }
    >
      <Button
        variant="ghost"
        size="sm"
        onClick={handleClick}
        className={cn(
          "inline-flex items-center gap-1 h-5 px-1.5 py-0 text-xs font-medium",
          "bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/30 dark:hover:bg-blue-950/50",
          "text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300",
          "border border-blue-200 dark:border-blue-800 rounded-sm",
          "transition-colors duration-200",
          className
        )}
      >
        [{sourceNumber}]
        <ExternalLink className="h-2.5 w-2.5" />
      </Button>
    </Tooltip>
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

export function CitationRenderer({ text, citations, className }: CitationRendererProps) {
  // Replace citation patterns [1], [2], etc. with clickable citation components
  const parts = text.split(/(\[\d+\])/g);
  
  return (
    <span className={className}>
      {parts.map((part, index) => {
        const citationMatch = part.match(/\[(\d+)\]/);
        if (citationMatch) {
          const sourceNumber = parseInt(citationMatch[1]);
          const citation = citations.find(c => c.number === sourceNumber);
          
          if (citation) {
            return (
              <InlineCitation
                key={index}
                sourceNumber={sourceNumber}
                title={citation.title}
                url={citation.url}
                snippet={citation.snippet}
              />
            );
          }
        }
        return part;
      })}
    </span>
  );
}