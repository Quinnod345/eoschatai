'use client';

import * as React from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check } from 'lucide-react';

import { cn } from '@/lib/utils';

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      'checkbox-root peer inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-md border border-zinc-300 bg-background text-foreground ring-offset-background transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:border-primary/60 hover:shadow-[0_0_0_2px_rgba(59,130,246,0.12)] disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:hover:shadow-[0_0_0_2px_rgba(59,130,246,0.18)] data-[state=checked]:bg-gradient-to-br data-[state=checked]:from-primary data-[state=checked]:to-primary/80 data-[state=checked]:text-primary-foreground data-[state=checked]:border-primary data-[state=checked]:shadow-[0_6px_14px_-6px_rgba(59,130,246,0.55)]',
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator
      className={cn(
        'flex items-center justify-center text-current transition-transform duration-150 ease-out',
      )}
    >
      <Check className="h-3.5 w-3.5 drop-shadow-[0_1px_1px_rgba(0,0,0,0.18)]" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
