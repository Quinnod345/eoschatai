'use client';

import { useState } from 'react';
import { NexusSourcesPanel } from './nexus-sources-panel';
import { cn } from '@/lib/utils';

interface Source {
  url: string;
  title: string;
  snippet?: string;
  content?: string;
  relevanceScore?: number;
}

interface NexusMessageProps {
  content: string;
  sources: Source[];
  className?: string;
}

export function NexusMessage({
  content,
  sources,
  className,
}: NexusMessageProps) {
  const [showSourcesPanel, setShowSourcesPanel] = useState(false);

  return (
    <div className={cn('relative', className)}>
      {/* Message content */}
      <div className="prose prose-sm dark:prose-invert max-w-none">
        {content}
      </div>

      {/* Sources panel trigger and panel */}
      {sources.length > 0 && (
        <NexusSourcesPanel
          sources={sources}
          isOpen={showSourcesPanel}
          onClose={() => setShowSourcesPanel(!showSourcesPanel)}
        />
      )}
    </div>
  );
}

