'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { Button, type ButtonProps } from './button';
import { cn } from '@/lib/utils';

export interface LoadingButtonProps extends ButtonProps {
  loading?: boolean;
  loadingText?: string;
  spinnerPosition?: 'left' | 'right';
  spinnerSize?: 'sm' | 'md' | 'lg';
}

const spinnerSizes = { sm: 'h-3 w-3', md: 'h-4 w-4', lg: 'h-5 w-5' };

const LoadingButton = React.forwardRef<HTMLButtonElement, LoadingButtonProps>(
  ({ children, loading = false, loadingText, spinnerPosition = 'left', spinnerSize = 'md', disabled, className, ...props }, ref) => {
    const isDisabled = disabled || loading;
    const spinner = <Loader2 className={cn('animate-spin', spinnerSizes[spinnerSize])} aria-hidden="true" />;
    const content = loading ? (
      <>{spinnerPosition === 'left' && spinner}<span>{loadingText || children}</span>{spinnerPosition === 'right' && spinner}</>
    ) : children;
    return (
      <Button ref={ref} disabled={isDisabled} className={cn('relative transition-all', loading && 'cursor-wait', className)} aria-busy={loading} {...props}>
        {content}
      </Button>
    );
  }
);

LoadingButton.displayName = 'LoadingButton';
export { LoadingButton };
