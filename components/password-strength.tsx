'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface PasswordStrengthProps {
  password: string;
  className?: string;
}

export function PasswordStrength({
  password,
  className,
}: PasswordStrengthProps) {
  const strength = useMemo(() => {
    if (!password) return 0;

    let score = 0;

    // Length check
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;

    // Character variety checks
    if (/[a-z]/.test(password)) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;

    // Common patterns to avoid
    if (!/(.)\1{2,}/.test(password)) score += 1; // No repeating characters
    if (!/^(123|abc|password|qwerty)/i.test(password)) score += 1; // No common patterns

    // Normalize to percentage
    return Math.min(100, (score / 8) * 100);
  }, [password]);

  const strengthLabel = useMemo(() => {
    if (strength === 0) return '';
    if (strength < 25) return 'Weak';
    if (strength < 50) return 'Fair';
    if (strength < 75) return 'Good';
    return 'Strong';
  }, [strength]);

  const strengthColor = useMemo(() => {
    if (strength === 0) return '';
    if (strength < 25) return 'bg-red-500';
    if (strength < 50) return 'bg-orange-500';
    if (strength < 75) return 'bg-yellow-500';
    return 'bg-green-500';
  }, [strength]);

  const requirements = [
    { met: password.length >= 8, text: 'At least 8 characters' },
    {
      met: /[a-z]/.test(password) && /[A-Z]/.test(password),
      text: 'Both uppercase and lowercase letters',
    },
    { met: /[0-9]/.test(password), text: 'At least one number' },
    {
      met: /[^A-Za-z0-9]/.test(password),
      text: 'At least one special character',
    },
  ];

  if (!password) return null;

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between text-sm">
        <span className="text-zinc-600 dark:text-zinc-400">
          Password strength
        </span>
        <span
          className={cn('font-medium', {
            'text-red-600 dark:text-red-400': strength < 25,
            'text-orange-600 dark:text-orange-400':
              strength >= 25 && strength < 50,
            'text-yellow-600 dark:text-yellow-400':
              strength >= 50 && strength < 75,
            'text-green-600 dark:text-green-400': strength >= 75,
          })}
        >
          {strengthLabel}
        </span>
      </div>

      <div className="h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full transition-all duration-300 ease-out',
            strengthColor,
          )}
          style={{ width: `${strength}%` }}
        />
      </div>

      <ul className="space-y-1 text-xs">
        {requirements.map((req) => (
          <li
            key={req.text}
            className={cn('flex items-center gap-2', {
              'text-green-600 dark:text-green-400': req.met,
              'text-zinc-500 dark:text-zinc-400': !req.met,
            })}
          >
            <span>{req.met ? '✓' : '○'}</span>
            <span>{req.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
