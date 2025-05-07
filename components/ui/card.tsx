import * as React from 'react';
import { motion } from 'framer-motion';

import { cn } from '@/lib/utils';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  animated?: boolean;
  hoverEffect?: 'lift' | 'scale' | 'glow' | 'none';
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, animated = false, hoverEffect = 'scale', ...props }, ref) => {
    // Animation properties
    const springTransition = {
      type: 'spring',
      damping:
          18,
      stiffness: 300
    };
    
    // Hover animations
    const hoverAnimations = {
      lift: {
        whileHover: { 
          y: -4, 
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)"
        },
        whileTap: { y: -2, boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)" }
      },
      scale: {
        whileHover: { 
          scale: 1.02, 
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)"
        },
        whileTap: { scale: 0.99 }
      },
      glow: {
        whileHover: { 
          boxShadow: "0 0 15px 5px hsl(var(--primary) / 0.2)", 
          filter: "brightness(1.03)" 
        },
        whileTap: { boxShadow: "0 0 8px 2px hsl(var(--primary) / 0.15)" }
      },
      none: {}
    };
    
    const animationProps = animated && hoverEffect !== 'none'
      ? {
          transition: springTransition,
          ...hoverAnimations[hoverEffect]
        }
      : {};
    
    const Component = animated ? motion.div : 'div';
    
    return (
      <Component
        ref={ref}
        className={cn(
          'rounded-lg border bg-card text-card-foreground shadow-sm',
          animated && 'transition-all duration-300',
          className,
        )}
        {...animationProps}
        {...props}
      />
    );
  }
);
Card.displayName = 'Card';

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex flex-col space-y-1.5 p-6', className)}
    {...props}
  />
));
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'text-2xl font-semibold leading-none tracking-tight',
      className,
    )}
    {...props}
  />
));
CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
));
CardDescription.displayName = 'CardDescription';

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
));
CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex items-center p-6 pt-0', className)}
    {...props}
  />
));
CardFooter.displayName = 'CardFooter';

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
};
