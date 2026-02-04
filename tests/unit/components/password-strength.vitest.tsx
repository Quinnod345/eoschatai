import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PasswordStrength } from '@/components/password-strength';

describe('PasswordStrength', () => {
  it('renders nothing when password is empty', () => {
    const { container } = render(<PasswordStrength password="" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders when password has content', () => {
    render(<PasswordStrength password="a" />);
    expect(screen.getByText('Password strength')).toBeInTheDocument();
  });

  it('shows "Fair" for simple 8-char passwords', () => {
    render(<PasswordStrength password="abcdefgh" />);
    expect(screen.getByText('Fair')).toBeInTheDocument();
  });

  it('shows "Strong" for high complexity passwords', () => {
    render(<PasswordStrength password="MyP@ssw0rd123!" />);
    expect(screen.getByText('Strong')).toBeInTheDocument();
  });

  it('shows all requirement items', () => {
    render(<PasswordStrength password="a" />);
    expect(screen.getByText('At least 8 characters')).toBeInTheDocument();
    expect(screen.getByText('Both uppercase and lowercase letters')).toBeInTheDocument();
    expect(screen.getByText('At least one number')).toBeInTheDocument();
    expect(screen.getByText('At least one special character')).toBeInTheDocument();
  });

  it('shows checkmark for met requirements', () => {
    render(<PasswordStrength password="12345678" />);
    const lengthItem = screen.getByText('At least 8 characters').closest('li');
    expect(lengthItem).toHaveTextContent('✓');
  });
});
