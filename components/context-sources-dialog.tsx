'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  FileText,
  User,
  Database,
  Brain,
  MessageSquare,
  Sparkles,
  Info,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface ContextSource {
  type: 'documents' | 'persona' | 'system' | 'memory' | 'conversation';
  icon: string;
  label: string;
  description?: string;
  count: number;
  items: Array<{
    id: string;
    name: string;
    category?: string;
    content?: string; // For memories - show the actual content
  }>;
}

interface ContextSourcesDialogProps {
  messageId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const iconMap = {
  FileText,
  User,
  Database,
  Brain,
  MessageSquare,
  Sparkles,
};

export function ContextSourcesDialog({
  messageId,
  open,
  onOpenChange,
}: ContextSourcesDialogProps) {
  const [loading, setLoading] = React.useState(true);
  const [sources, setSources] = React.useState<ContextSource[]>([]);
  const [stats, setStats] = React.useState<any>(null);

  React.useEffect(() => {
    if (open && messageId) {
      fetchContextSources();
    }
  }, [open, messageId]);

  const fetchContextSources = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/messages/${messageId}/context-sources`);
      if (response.ok) {
        const data = await response.json();
        setSources(data.sources || []);
        setStats(data.stats || null);
      }
    } catch (error) {
      console.error('Error fetching context sources:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="default">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            Context Sources
          </DialogTitle>
          <DialogDescription>
            This response was personalized using the following sources
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : sources.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Info className="h-12 w-12 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">
                No additional context was used for this response
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sources.map((source, index) => {
                const Icon = iconMap[source.icon as keyof typeof iconMap] || Sparkles;
                
                return (
                  <div
                    key={index}
                    className="rounded-lg border border-border/30 bg-card p-3 space-y-2 hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        <Icon className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">
                            {source.label}
                          </div>
                          {source.description && (
                            <div className="text-xs text-muted-foreground">
                              {source.description}
                            </div>
                          )}
                        </div>
                      </div>
                      <Badge variant="secondary" className="text-xs flex-shrink-0">
                        {source.count} {source.count === 1 ? 'chunk' : 'chunks'}
                      </Badge>
                    </div>

                    {source.items && source.items.length > 0 && (
                      <div className="pl-6 space-y-1.5">
                        {source.items.map((item, itemIndex) => (
                          <div
                            key={itemIndex}
                            className="text-xs space-y-1"
                          >
                            <div className="text-muted-foreground flex items-center gap-2">
                              <span className="w-1 h-1 rounded-full bg-muted-foreground/40 flex-shrink-0" />
                              <span className="break-words flex-1 font-medium">
                                {item.name}
                              </span>
                              {item.category && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] h-4 px-1.5 flex-shrink-0"
                                >
                                  {item.category}
                                </Badge>
                              )}
                            </div>
                            {/* Show content preview for memories */}
                            {source.type === 'memory' && item.content && (
                              <div className="pl-3 text-[11px] text-muted-foreground/80 italic">
                                &quot;{item.content}...&quot;
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {stats && stats.totalChunks > 0 && (
                <div className="mt-4 pt-3 border-t border-border/20 text-xs text-muted-foreground space-y-1">
                  <div className="flex justify-between">
                    <span>Total context chunks:</span>
                    <span className="font-medium">{stats.totalChunks}</span>
                  </div>
                  {stats.tokens > 0 && (
                    <div className="flex justify-between">
                      <span>Context tokens:</span>
                      <span className="font-medium">
                        {stats.tokens.toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

