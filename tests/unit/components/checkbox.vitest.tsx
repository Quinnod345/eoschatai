// @ts-nocheck
/**
 * @vitest-environment jsdom
 */

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { Checkbox } from '@/components/ui/checkbox';

vi.mock('lucide-react', () => ({
  Check: () => <span data-testid="check-icon">✓</span>,
}));

afterEach(() => cleanup());

describe('Checkbox', () => {
  describe('rendering', () => {
    it('renders a checkbox button', () => {
      render(<Checkbox />);
      expect(screen.getByRole('checkbox')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<Checkbox className="custom-class" />);
      expect(screen.getByRole('checkbox')).toHaveClass('custom-class');
    });
  });

  describe('checked state', () => {
    it('is unchecked by default', () => {
      render(<Checkbox />);
      expect(screen.getByRole('checkbox')).not.toBeChecked();
    });

    it('can be checked by default', () => {
      render(<Checkbox defaultChecked />);
      expect(screen.getByRole('checkbox')).toBeChecked();
    });

    it('toggles checked state when clicked', () => {
      render(<Checkbox />);
      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);
      expect(checkbox).toBeChecked();
      fireEvent.click(checkbox);
      expect(checkbox).not.toBeChecked();
    });

    it('handles controlled checked state', () => {
      const { rerender } = render(<Checkbox checked={false} onCheckedChange={() => {}} />);
      expect(screen.getByRole('checkbox')).not.toBeChecked();
      rerender(<Checkbox checked={true} onCheckedChange={() => {}} />);
      expect(screen.getByRole('checkbox')).toBeChecked();
    });
  });

  describe('onChange callback', () => {
    it('calls onCheckedChange when clicked', () => {
      const handleChange = vi.fn();
      render(<Checkbox onCheckedChange={handleChange} />);
      fireEvent.click(screen.getByRole('checkbox'));
      expect(handleChange).toHaveBeenCalledWith(true);
    });
  });

  describe('disabled state', () => {
    it('applies disabled attribute', () => {
      render(<Checkbox disabled />);
      expect(screen.getByRole('checkbox')).toBeDisabled();
    });

    it('does not toggle when disabled', () => {
      const handleChange = vi.fn();
      render(<Checkbox disabled onCheckedChange={handleChange} />);
      fireEvent.click(screen.getByRole('checkbox'));
      expect(handleChange).not.toHaveBeenCalled();
    });
  });

  describe('accessibility', () => {
    it('supports aria-label', () => {
      render(<Checkbox aria-label="Accept terms" />);
      expect(screen.getByLabelText('Accept terms')).toBeInTheDocument();
    });

    it('can be focused', () => {
      render(<Checkbox />);
      const checkbox = screen.getByRole('checkbox');
      checkbox.focus();
      expect(checkbox).toHaveFocus();
    });
  });
});
