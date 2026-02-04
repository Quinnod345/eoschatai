/**
 * @vitest-environment jsdom
 */

import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { Skeleton } from '@/components/ui/skeleton';

afterEach(() => cleanup());

describe('Skeleton', () => {
  describe('rendering', () => {
    it('renders a div element', () => {
      render(<Skeleton data-testid="skeleton" />);
      expect(screen.getByTestId('skeleton')).toBeInTheDocument();
    });

    it('applies base styles', () => {
      render(<Skeleton data-testid="skeleton" />);
      expect(screen.getByTestId('skeleton')).toHaveClass('animate-pulse', 'rounded-md', 'bg-muted');
    });

    it('applies custom className', () => {
      render(<Skeleton data-testid="skeleton" className="w-full h-4" />);
      expect(screen.getByTestId('skeleton')).toHaveClass('w-full', 'h-4');
    });

    it('merges custom className with base styles', () => {
      render(<Skeleton data-testid="skeleton" className="w-20 h-20" />);
      expect(screen.getByTestId('skeleton')).toHaveClass('animate-pulse', 'rounded-md', 'bg-muted', 'w-20', 'h-20');
    });
  });

  describe('common use cases', () => {
    it('works as a text placeholder', () => {
      render(<Skeleton className="h-4 w-[250px]" data-testid="text-skeleton" />);
      expect(screen.getByTestId('text-skeleton')).toBeInTheDocument();
    });

    it('works as an avatar placeholder', () => {
      render(<Skeleton className="h-12 w-12 rounded-full" data-testid="avatar-skeleton" />);
      expect(screen.getByTestId('avatar-skeleton')).toHaveClass('rounded-full');
    });
  });

  describe('HTML attributes', () => {
    it('passes through standard div attributes', () => {
      render(<Skeleton data-testid="skeleton" id="my-skeleton" title="Loading content" />);
      const skeleton = screen.getByTestId('skeleton');
      expect(skeleton).toHaveAttribute('id', 'my-skeleton');
      expect(skeleton).toHaveAttribute('title', 'Loading content');
    });

    it('supports role attribute for accessibility', () => {
      render(<Skeleton data-testid="skeleton" role="progressbar" />);
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });
  });
});
