'use client';

import { ExternalLink, FileText, Globe } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface CitationButtonProps {
  number: number;
  title: string;
  url: string;
  inline?: boolean;
  className?: string;
}

export function CitationButton({
  number,
  title,
  url,
  inline = false,
  className,
}: CitationButtonProps) {
  const [isHovered, setIsHovered] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Ensure URL is properly formatted
    let targetUrl = url.trim();
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = `https://${targetUrl}`;
    }

    console.log('[CitationButton] Opening URL:', targetUrl);
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  };

  if (inline) {
    // Inline citation style [1] that appears within text
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={handleClick}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              className={cn(
                'inline-flex items-center gap-0.5 px-1.5 py-0.5 mx-0.5',
                'text-xs font-medium rounded-md',
                'bg-primary/10 text-primary hover:bg-primary/20',
                'transition-all duration-200 cursor-pointer',
                'border border-primary/20 hover:border-primary/40',
                isHovered && 'shadow-sm scale-105',
                className,
              )}
            >
              <span className="font-semibold">[{number}]</span>
              <ExternalLink className="h-2.5 w-2.5 opacity-60" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-sm">
            <div className="space-y-1">
              <p className="font-medium text-sm">{title}</p>
              <p className="text-xs text-muted-foreground truncate">
                {(() => {
                  try {
                    const formattedUrl = url.startsWith('http')
                      ? url
                      : `https://${url}`;
                    return new URL(formattedUrl).hostname;
                  } catch {
                    return url;
                  }
                })()}
              </p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Full citation card style for references section
  return (
    <button
      type="button"
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        'group flex items-start gap-3 p-3 w-full text-left',
        'rounded-lg border bg-card hover:bg-accent/50',
        'transition-all duration-200 cursor-pointer',
        'hover:shadow-md hover:border-primary/30',
        className,
      )}
    >
      {/* Citation number badge */}
      <div className="flex-shrink-0">
        <div
          className={cn(
            'flex items-center justify-center',
            'w-8 h-8 rounded-full',
            'bg-primary/10 text-primary font-semibold text-sm',
            'group-hover:bg-primary group-hover:text-primary-foreground',
            'transition-colors duration-200',
          )}
        >
          {number}
        </div>
      </div>

      {/* Citation content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-sm line-clamp-2 group-hover:text-primary transition-colors">
              {title}
            </h4>
            <div className="flex items-center gap-1 mt-1">
              <Globe className="h-3 w-3 text-muted-foreground" />
              <p className="text-xs text-muted-foreground truncate">
                {(() => {
                  try {
                    const formattedUrl = url.startsWith('http')
                      ? url
                      : `https://${url}`;
                    return new URL(formattedUrl).hostname;
                  } catch {
                    return url;
                  }
                })()}
              </p>
            </div>
          </div>
          <ExternalLink
            className={cn(
              'h-4 w-4 flex-shrink-0 text-muted-foreground',
              'group-hover:text-primary transition-colors',
            )}
          />
        </div>
      </div>
    </button>
  );
}

// Component to render citation references section
export function CitationReferences({
  citations,
  className,
}: {
  citations: Array<{ number: number; title: string; url: string }>;
  className?: string;
}) {
  if (!citations || citations.length === 0) return null;

  return (
    <div className={cn('mt-8 space-y-3', className)}>
      <div className="flex items-center gap-2 mb-4">
        <FileText className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Sources & References</h3>
        <span className="text-sm text-muted-foreground">
          ({citations.length})
        </span>
      </div>
      <div className="grid gap-2">
        {citations.map((citation) => (
          <CitationButton
            key={`${citation.number}-${citation.url}`}
            number={citation.number}
            title={citation.title}
            url={citation.url}
          />
        ))}
      </div>
    </div>
  );
}
