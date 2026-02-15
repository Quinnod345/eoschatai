'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  FileText,
  User,
  Database,
  Brain,
  MessageSquare,
  Building2,
  Info,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface ContextSource {
  type: 'documents' | 'persona' | 'system' | 'memory' | 'conversation' | 'org';
  icon: string;
  label: string;
  description?: string;
  count: number;
  items: Array<{
    id: string;
    name: string;
    category?: string;
    content?: string;
  }>;
}

interface ContextSourcesDialogProps {
  messageId: string;
  chatId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const iconMap = {
  FileText,
  User,
  Database,
  Brain,
  MessageSquare,
  Building2,
};

export function ContextSourcesDialog({
  messageId,
  chatId,
  open,
  onOpenChange,
}: ContextSourcesDialogProps) {
  const [loading, setLoading] = React.useState(true);
  const [sources, setSources] = React.useState<ContextSource[]>([]);
  const isFetchingRef = React.useRef(false);

  React.useEffect(() => {
    if (open && messageId) {
      fetchContextSources();
    }
  }, [open, messageId]);

  const fetchContextSources = async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setLoading(true);
    try {
      const url = chatId
        ? `/api/messages/${messageId}/context-sources?chatId=${chatId}`
        : `/api/messages/${messageId}/context-sources`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setSources(data.sources || []);
      }
    } catch (error) {
      console.error('Error fetching context sources:', error);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="default">
        <DialogHeader>
          <DialogTitle>Context Sources</DialogTitle>
          <DialogDescription>
            What was used to generate this response
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          {loading ? (
            <div className="space-y-6 py-2">
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <div className="flex flex-wrap gap-2">
                  <Skeleton className="h-7 w-40 rounded-full" />
                  <Skeleton className="h-7 w-32 rounded-full" />
                </div>
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <div className="flex flex-wrap gap-2">
                  <Skeleton className="h-7 w-36 rounded-full" />
                </div>
              </div>
            </div>
          ) : sources.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Info className="h-10 w-10 text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">
                No context was retrieved for this response
              </p>
            </div>
          ) : (
            <div className="space-y-5 py-1">
              {sources.map((source, idx) => {
                const Icon =
                  iconMap[source.icon as keyof typeof iconMap] || null;

                return (
                  <div key={`${source.type}-${source.label}`}>
                    {idx > 0 && (
                      <div className="border-t border-border/20 mb-5" />
                    )}

                    <div className="flex items-center gap-2 mb-3">
                      {Icon && (
                        <Icon className="h-3.5 w-3.5 text-muted-foreground/70" />
                      )}
                      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {source.label}
                      </span>
                    </div>

                    {source.items && source.items.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {source.items.map((item) => (
                          <span
                            key={`${source.type}-${item.id}`}
                            className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-accent/60 text-foreground/90 border border-border/30"
                          >
                            {item.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {source.count} item{source.count !== 1 ? 's' : ''}{' '}
                        retrieved
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
