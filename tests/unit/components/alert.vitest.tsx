/**
 * @vitest-environment jsdom
 */

import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

afterEach(() => cleanup());

describe('Alert', () => {
  describe('rendering', () => {
    it('renders with role="alert"', () => {
      render(<Alert>Alert content</Alert>);
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('renders children correctly', () => {
      render(<Alert>Alert message</Alert>);
      expect(screen.getByText('Alert message')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<Alert className="custom-alert">Alert</Alert>);
      expect(screen.getByRole('alert')).toHaveClass('custom-alert');
    });
  });

  describe('variants', () => {
    it('applies default variant styling', () => {
      render(<Alert variant="default">Default alert</Alert>);
      expect(screen.getByRole('alert')).toHaveClass('bg-background', 'text-foreground');
    });

    it('applies destructive variant styling', () => {
      render(<Alert variant="destructive">Error alert</Alert>);
      expect(screen.getByRole('alert')).toHaveClass('text-destructive');
    });
  });

  describe('base styles', () => {
    it('applies rounded border styles', () => {
      render(<Alert>Alert</Alert>);
      expect(screen.getByRole('alert')).toHaveClass('rounded-lg', 'border');
    });

    it('applies padding styles', () => {
      render(<Alert>Alert</Alert>);
      expect(screen.getByRole('alert')).toHaveClass('px-4', 'py-3');
    });
  });
});

describe('AlertTitle', () => {
  it('renders as an h5 element', () => {
    render(<AlertTitle>Title</AlertTitle>);
    expect(screen.getByRole('heading', { level: 5 })).toBeInTheDocument();
  });

  it('renders children correctly', () => {
    render(<AlertTitle>Alert Title</AlertTitle>);
    expect(screen.getByText('Alert Title')).toBeInTheDocument();
  });

  it('applies font styles', () => {
    render(<AlertTitle>Title</AlertTitle>);
    expect(screen.getByRole('heading')).toHaveClass('font-medium');
  });
});

describe('AlertDescription', () => {
  it('renders children correctly', () => {
    render(<AlertDescription>Description text</AlertDescription>);
    expect(screen.getByText('Description text')).toBeInTheDocument();
  });

  it('applies text styling', () => {
    render(<AlertDescription>Description</AlertDescription>);
    expect(screen.getByText('Description')).toHaveClass('text-sm');
  });
});

describe('composition', () => {
  it('renders a complete alert structure', () => {
    render(
      <Alert>
        <AlertTitle>Warning</AlertTitle>
        <AlertDescription>This is a warning message</AlertDescription>
      </Alert>
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Warning' })).toBeInTheDocument();
    expect(screen.getByText('This is a warning message')).toBeInTheDocument();
  });
});
