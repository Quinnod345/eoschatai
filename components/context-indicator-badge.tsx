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

interface ContextIndicatorProps {
  messageId: string;
  variant?: 'subtle' | 'visible';
  onClick?: () => void;
}

export function ContextIndicatorBadge({
  messageId,
  variant = 'subtle',
  onClick,
}: ContextIndicatorProps) {
  const [hasContext, setHasContext] = React.useState(false);
  const [sources, setSources] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetchContextInfo();
  }, [messageId]);

  const fetchContextInfo = async () => {
    try {
      const response = await fetch(`/api/messages/${messageId}/context-sources`);
      if (response.ok) {
        const data = await response.json();
        setHasContext(data.hasContext);
        setSources(data.sources || []);
      }
    } catch (error) {
      console.error('Error checking context:', error);
    } finally {
      setLoading(false);
    }
  };

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
  );
}


