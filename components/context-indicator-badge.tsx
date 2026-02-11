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

interface ContextIndicatorProps {
  messageId: string;
  chatId?: string;
  variant?: 'subtle' | 'visible';
  onClick?: () => void;
  chatStatus?: string;
}

export function ContextIndicatorBadge({
  messageId,
  chatId,
  variant = 'subtle',
  onClick,
  chatStatus,
}: ContextIndicatorProps) {
  const [hasContext, setHasContext] = React.useState(false);
  const [sources, setSources] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const hasContextRef = React.useRef(false);

  const fetchContextInfo = React.useCallback(async (): Promise<boolean> => {
    // Skip if we already have context data
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

  // Reset ref when messageId changes so new messages fetch fresh
  React.useEffect(() => {
    hasContextRef.current = false;
    setHasContext(false);
    setSources([]);
    setLoading(true);
    fetchContextInfo();
  }, [messageId, fetchContextInfo]);

  // When chat status transitions to 'ready' (stream just finished),
  // fetch with a delay to give the server time to write context data.
  // Uses a single retry with early-exit to avoid wasteful duplicate fetches.
  React.useEffect(() => {
    if (chatStatus !== 'ready' || hasContextRef.current) return;
    let safetyTimer: ReturnType<typeof setTimeout> | null = null;

    const timer = setTimeout(async () => {
      const found = await fetchContextInfo();
      if (!found) {
        // Safety retry only if first attempt returned nothing
        safetyTimer = setTimeout(() => fetchContextInfo(), 3000);
      }
    }, 2000);

    return () => {
      clearTimeout(timer);
      if (safetyTimer) clearTimeout(safetyTimer);
    };
  }, [chatStatus, fetchContextInfo]);

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
      return 'Personalized';
    }
    if (types.includes('documents')) {
      return 'Using Your Docs';
    }
    if (types.includes('memory')) {
      return 'With Memory';
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
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
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
                This response used {sources.length} context source
                {sources.length !== 1 ? 's' : ''}:
              </p>
              <ul className="text-xs space-y-0.5">
                {sources.map((source, idx) => (
                  <li key={idx}>
                    • {source.label} ({source.count} chunks)
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


