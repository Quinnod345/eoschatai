/**
 * @vitest-environment jsdom
 */

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { Switch } from '@/components/ui/switch';

afterEach(() => cleanup());

describe('Switch', () => {
  describe('rendering', () => {
    it('renders a switch', () => {
      render(<Switch />);
      expect(screen.getByRole('switch')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<Switch className="custom-class" />);
      expect(screen.getByRole('switch')).toHaveClass('custom-class');
    });
  });

  describe('checked state', () => {
    it('is unchecked by default', () => {
      render(<Switch />);
      expect(screen.getByRole('switch')).toHaveAttribute('data-state', 'unchecked');
    });

    it('can be checked by default', () => {
      render(<Switch defaultChecked />);
      expect(screen.getByRole('switch')).toHaveAttribute('data-state', 'checked');
    });

    it('toggles state when clicked', () => {
      render(<Switch />);
      const switchEl = screen.getByRole('switch');
      fireEvent.click(switchEl);
      expect(switchEl).toHaveAttribute('data-state', 'checked');
      fireEvent.click(switchEl);
      expect(switchEl).toHaveAttribute('data-state', 'unchecked');
    });

    it('handles controlled state', () => {
      const { rerender } = render(<Switch checked={false} onCheckedChange={() => {}} />);
      expect(screen.getByRole('switch')).toHaveAttribute('data-state', 'unchecked');
      rerender(<Switch checked={true} onCheckedChange={() => {}} />);
      expect(screen.getByRole('switch')).toHaveAttribute('data-state', 'checked');
    });
  });

  describe('onChange callback', () => {
    it('calls onCheckedChange when toggled on', () => {
      const handleChange = vi.fn();
      render(<Switch onCheckedChange={handleChange} />);
      fireEvent.click(screen.getByRole('switch'));
      expect(handleChange).toHaveBeenCalledWith(true);
    });
  });

  describe('disabled state', () => {
    it('applies disabled attribute', () => {
      render(<Switch disabled />);
      expect(screen.getByRole('switch')).toBeDisabled();
    });

    it('does not toggle when disabled', () => {
      const handleChange = vi.fn();
      render(<Switch disabled onCheckedChange={handleChange} />);
      fireEvent.click(screen.getByRole('switch'));
      expect(handleChange).not.toHaveBeenCalled();
    });

    it('applies disabled styling', () => {
      render(<Switch disabled />);
      expect(screen.getByRole('switch')).toHaveClass('disabled:opacity-50');
    });
  });

  describe('accessibility', () => {
    it('supports aria-label', () => {
      render(<Switch aria-label="Enable notifications" />);
      expect(screen.getByLabelText('Enable notifications')).toBeInTheDocument();
    });

    it('can be focused', () => {
      render(<Switch />);
      const switchEl = screen.getByRole('switch');
      switchEl.focus();
      expect(switchEl).toHaveFocus();
    });
  });
});
