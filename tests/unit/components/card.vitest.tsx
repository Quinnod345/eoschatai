/**
 * @vitest-environment jsdom
 */

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, ...props }: any) => <div className={className} {...props}>{children}</div>,
  },
}));

afterEach(() => cleanup());

describe('Card', () => {
  describe('Card component', () => {
    it('renders children correctly', () => {
      render(<Card>Card Content</Card>);
      expect(screen.getByText('Card Content')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<Card className="custom-class">Card</Card>);
      expect(screen.getByText('Card')).toHaveClass('custom-class');
    });

    it('applies base card styles', () => {
      render(<Card>Card</Card>);
      expect(screen.getByText('Card')).toHaveClass('rounded-lg', 'border', 'shadow-sm');
    });
  });

  describe('CardHeader', () => {
    it('renders children correctly', () => {
      render(<CardHeader>Header Content</CardHeader>);
      expect(screen.getByText('Header Content')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<CardHeader className="custom-header">Header</CardHeader>);
      expect(screen.getByText('Header')).toHaveClass('custom-header');
    });

    it('applies flex and spacing styles', () => {
      render(<CardHeader>Header</CardHeader>);
      expect(screen.getByText('Header')).toHaveClass('flex', 'flex-col', 'p-6');
    });
  });

  describe('CardTitle', () => {
    it('renders children correctly', () => {
      render(<CardTitle>Card Title</CardTitle>);
      expect(screen.getByText('Card Title')).toBeInTheDocument();
    });

    it('applies title styles', () => {
      render(<CardTitle>Title</CardTitle>);
      expect(screen.getByText('Title')).toHaveClass('text-2xl', 'font-semibold');
    });
  });

  describe('CardDescription', () => {
    it('renders children correctly', () => {
      render(<CardDescription>Description text</CardDescription>);
      expect(screen.getByText('Description text')).toBeInTheDocument();
    });

    it('applies muted text styles', () => {
      render(<CardDescription>Description</CardDescription>);
      expect(screen.getByText('Description')).toHaveClass('text-sm', 'text-muted-foreground');
    });
  });

  describe('CardContent', () => {
    it('renders children correctly', () => {
      render(<CardContent>Content here</CardContent>);
      expect(screen.getByText('Content here')).toBeInTheDocument();
    });

    it('applies padding styles', () => {
      render(<CardContent>Content</CardContent>);
      expect(screen.getByText('Content')).toHaveClass('p-6', 'pt-0');
    });
  });

  describe('CardFooter', () => {
    it('renders children correctly', () => {
      render(<CardFooter>Footer content</CardFooter>);
      expect(screen.getByText('Footer content')).toBeInTheDocument();
    });

    it('applies flex and padding styles', () => {
      render(<CardFooter>Footer</CardFooter>);
      expect(screen.getByText('Footer')).toHaveClass('flex', 'items-center', 'p-6');
    });
  });

  describe('composition', () => {
    it('renders a complete card structure', () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>Test Card</CardTitle>
            <CardDescription>This is a test card</CardDescription>
          </CardHeader>
          <CardContent>Main content goes here</CardContent>
          <CardFooter>Footer actions</CardFooter>
        </Card>
      );
      expect(screen.getByText('Test Card')).toBeInTheDocument();
      expect(screen.getByText('This is a test card')).toBeInTheDocument();
      expect(screen.getByText('Main content goes here')).toBeInTheDocument();
      expect(screen.getByText('Footer actions')).toBeInTheDocument();
    });
  });
});
