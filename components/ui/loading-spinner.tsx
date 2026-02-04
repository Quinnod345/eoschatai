import * as React from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'default' | 'primary' | 'muted';
  className?: string;
  text?: string;
}

const sizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
  xl: 'h-12 w-12',
};

const variantClasses = {
  default: 'text-foreground',
  primary: 'text-eos-orange',
  muted: 'text-muted-foreground',
};

export function LoadingSpinner({
  size = 'md',
  variant = 'default',
  className,
  text,
}: LoadingSpinnerProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Loader2
        className={cn(
          'animate-spin',
          sizeClasses[size],
          variantClasses[variant],
        )}
      />
      {text && (
        <span className={cn('text-sm font-medium', variantClasses[variant])}>
          {text}
        </span>
      )}
    </div>
  );
}

export function LoadingOverlay({
  text = 'Loading...',
  variant = 'primary',
}: {
  text?: string;
  variant?: 'default' | 'primary' | 'muted';
}) {
  return (
    <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 rounded-lg">
      <div className="flex flex-col items-center gap-3">
        <LoadingSpinner size="lg" variant={variant} />
        <p className={cn('text-sm font-medium', variantClasses[variant])}>
          {text}
        </p>
      </div>
    </div>
  );
}

export function LoadingDots({
  variant = 'primary',
  className,
}: {
  variant?: 'default' | 'primary' | 'muted';
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-1', className)}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={cn(
            'w-2 h-2 rounded-full animate-pulse',
            variantClasses[variant],
            'bg-current',
          )}
          style={{
            animationDelay: `${i * 0.2}s`,
            animationDuration: '1s',
          }}
        />
      ))}
    </div>
  );
}

export function LoadingCard({ className }: { className?: string }) {
  return (
    <div
      className={cn('rounded-lg border bg-card p-6 animate-pulse', className)}
    >
      <div className="space-y-3">
        <div className="h-4 bg-muted rounded w-3/4" />
        <div className="h-4 bg-muted rounded w-1/2" />
        <div className="h-4 bg-muted rounded w-5/6" />
      </div>
    </div>
  );
}
