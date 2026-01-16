import React, { memo } from 'react';
import { Markdown } from './markdown';
import { useSmoothStream } from '@/hooks/use-smooth-stream';

interface SmoothMarkdownProps {
  children: string;
  citations?: any[];
  isStreaming?: boolean;
}

export const SmoothMarkdown = memo(
  ({ children, citations, isStreaming = false }: SmoothMarkdownProps) => {
    // Only apply smoothing if we are actively streaming
    const smoothedContent = useSmoothStream(children, isStreaming);

    // Check if we're still "typing"
    const isTyping = isStreaming && smoothedContent.length < children.length;

    // Append a special cursor token if typing
    const contentWithCursor = isTyping
      ? `${smoothedContent}$$CURSOR$$`
      : smoothedContent;

    return <Markdown citations={citations}>{contentWithCursor}</Markdown>;
  },
);

SmoothMarkdown.displayName = 'SmoothMarkdown';
