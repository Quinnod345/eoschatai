'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ExternalLink, Globe, FileText } from 'lucide-react';
import { Button } from './ui/button';

interface CitationReference {
  number: number;
  title: string;
  url: string;
  snippet?: string;
}

interface SourcesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  citations: CitationReference[];
}

export function SourcesDialog({
  open,
  onOpenChange,
  citations,
}: SourcesDialogProps) {
  if (!citations || citations.length === 0) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" className="flex flex-col p-0">
        <div className="p-6 pb-4 flex-shrink-0">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Sources & References
            </DialogTitle>
            <DialogDescription>
              {citations.length} source{citations.length !== 1 ? 's' : ''} used
              in this response
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6">
          <div className="space-y-3 pb-4">
            {citations.map((citation) => (
              <button
                key={`${citation.number}-${citation.url}`}
                type="button"
                onClick={() =>
                  window.open(citation.url, '_blank', 'noopener,noreferrer')
                }
                className="group flex items-start gap-3 p-4 w-full text-left rounded-lg border bg-card hover:bg-accent/50 transition-all duration-200 cursor-pointer hover:shadow-md hover:border-primary/30"
              >
                {/* Citation number badge */}
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold text-sm group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-200">
                    {citation.number}
                  </div>
                </div>

                {/* Citation content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm line-clamp-2 group-hover:text-primary transition-colors mb-1">
                        {citation.title}
                      </h4>
                      <div className="flex items-center gap-1.5 mb-2">
                        <Globe className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        <p className="text-xs text-muted-foreground truncate">
                          {new URL(citation.url).hostname}
                        </p>
                      </div>
                      {citation.snippet && (
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                          {citation.snippet}
                        </p>
                      )}
                    </div>
                    <ExternalLink className="h-4 w-4 flex-shrink-0 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end p-6 pt-4 border-t flex-shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
