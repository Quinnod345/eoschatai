import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => {
      const {
        initial: _initial,
        animate: _animate,
        transition: _transition,
        whileHover: _whileHover,
        whileTap: _whileTap,
        ...rest
      } = props;
      return <div {...rest}>{children}</div>;
    },
  },
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

vi.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: any) => <div>{children}</div>,
  Tooltip: ({ children }: any) => <div>{children}</div>,
  TooltipTrigger: ({ children }: any) => <div>{children}</div>,
  TooltipContent: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: any) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
  DialogDescription: ({ children }: any) => <p>{children}</p>,
}));

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: () => <div>loading...</div>,
}));

import { ContextIndicatorBadge } from '@/components/context-indicator-badge';
import { ContextSourcesDialog } from '@/components/context-sources-dialog';

describe('context UI semantics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses retrieval wording and memory split counts in badge tooltip', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        hasContext: true,
        sources: [
          {
            type: 'documents',
            label: 'Your Documents',
            count: 1,
          },
          {
            type: 'memory',
            label: 'Your Memories',
            count: 2,
            breakdown: { semantic: 1, recent: 1 },
          },
        ],
      }),
    }) as any;

    render(<ContextIndicatorBadge messageId="message-1" />);

    await waitFor(() => {
      expect(screen.getByText('Retrieved Context')).toBeInTheDocument();
    });

    expect(
      screen.getByText('Retrieved 2 context sources:'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('• Your Memories (2 chunks) — semantic: 1, recent: 1'),
    ).toBeInTheDocument();
  });

  it('uses retrieval wording and memory breakdown in context dialog', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        hasContext: true,
        sources: [
          {
            type: 'memory',
            icon: 'Brain',
            label: 'Your Memories',
            description: 'Retrieved for response context (semantic: 1, recent: 2)',
            count: 3,
            breakdown: { semantic: 1, recent: 2, unembedded: 0 },
            items: [
              {
                id: 'mem-1',
                name: 'Growth target',
                category: 'company',
                content: '3-year growth target is 2x',
              },
            ],
          },
        ],
        stats: {
          totalChunks: 3,
          tokens: 120,
        },
      }),
    }) as any;

    render(
      <ContextSourcesDialog
        messageId="message-2"
        open
        onOpenChange={() => {}}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByText(
          'The assistant retrieved the following context while generating this response',
        ),
      ).toBeInTheDocument();
    });

    expect(screen.getByText('semantic: 1 | recent: 2')).toBeInTheDocument();
    expect(screen.getByText('Total retrieved context chunks:')).toBeInTheDocument();
  });
});
