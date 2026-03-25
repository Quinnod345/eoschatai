'use client';

import * as React from 'react';
import { Sparkles, FileText, Brain, Database, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { springSnappy } from '@/lib/motion/presets';

interface ContextIndicatorProps {
  messageId: string;
  chatId?: string;
  variant?: 'subtle' | 'visible';
  onClick?: () => void;
}

export function ContextIndicatorBadge({
  messageId,
  chatId,
  variant = 'subtle',
  onClick,
}: ContextIndicatorProps) {
  const [hasContext, setHasContext] = React.useState(false);
  const [sources, setSources] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const hasContextRef = React.useRef(false);

  const fetchContextInfo = React.useCallback(async (): Promise<boolean> => {
    if (hasContextRef.current) return true;
    try {
      const url = chatId
        ? `/api/messages/${messageId}/context-sources?chatId=${chatId}`
        : `/api/messages/${messageId}/context-sources`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        const found = data.hasContext && (data.sources || []).length > 0;
        setHasContext(data.hasContext);
        setSources(data.sources || []);
        hasContextRef.current = found;
        return found;
      }
    } catch (error) {
      console.error('Error checking context:', error);
    } finally {
      setLoading(false);
    }
    return false;
  }, [messageId, chatId]);

  // This component only mounts AFTER streaming completes (MessageActions
  // returns null while isLoading is true). So by the time we mount,
  // chatStatus is already 'ready'. We fetch immediately, and if it returns
  // empty (onFinish may still be writing the context log), we poll with
  // back-off until we find data or give up.
  React.useEffect(() => {
    hasContextRef.current = false;
    setHasContext(false);
    setSources([]);
    setLoading(true);

    let cancelled = false;

    const fetchWithRetry = async () => {
      const found = await fetchContextInfo();
      if (found || cancelled) return;

      // Context log may not be written yet (async onFinish).
      // Poll with increasing delays.
      const delays = [800, 2000, 4000, 7000];
      for (const delay of delays) {
        if (cancelled || hasContextRef.current) return;
        await new Promise((r) => setTimeout(r, delay));
        if (cancelled || hasContextRef.current) return;
        const retryFound = await fetchContextInfo();
        if (retryFound) return;
      }
    };

    fetchWithRetry();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only run when messageId changes
  }, [messageId]);

  if (loading || !hasContext || sources.length === 0) {
    return null;
  }

  // Determine which icon to show based on primary source
  const getIcon = () => {
    if (sources.some((s) => s.type === 'documents')) return FileText;
    if (sources.some((s) => s.type === 'memory')) return Brain;
    if (sources.some((s) => s.type === 'persona')) return User;
    if (sources.some((s) => s.type === 'system')) return Database;
    return Sparkles;
  };

  const Icon = getIcon();

  // Generate label
  const getLabel = () => {
    const types = sources.map((s) => s.type);
    if (types.includes('documents') && types.includes('memory')) {
      return 'Retrieved Context';
    }
    if (types.includes('documents')) {
      return 'Doc Context';
    }
    if (types.includes('memory')) {
      return 'Memory Context';
    }
    if (types.includes('persona')) {
      return 'Persona Knowledge';
    }
    if (types.includes('system')) {
      return 'Expert Knowledge';
    }
    return 'Enhanced';
  };

  const label = getLabel();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: 4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={springSnappy}
    >
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="outline"
              className={cn(
                'cursor-pointer transition-all text-muted-foreground hover:bg-eos-orange/10 border-border bg-transparent',
                variant === 'subtle' &&
                  'text-muted-foreground',
                variant === 'visible' &&
                  'text-foreground',
              )}
              onClick={onClick}
            >
              <Icon className="h-3 w-3 mr-1" />
              <span className="text-xs font-medium">{label}</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <div className="space-y-1">
              <p className="font-medium text-xs">
                Retrieved {sources.length} context source
                {sources.length !== 1 ? 's' : ''}:
              </p>
              <ul className="text-xs space-y-0.5">
                {sources.map((source) => (
                  <li key={`${source.type}-${source.label}-${source.count}`}>
                    • {source.label} ({source.count})
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground mt-2">
                Click to view details
              </p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </motion.div>
  );
}


