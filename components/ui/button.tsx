import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { motion } from 'framer-motion';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline:
          'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /**
   * Animation options for the button
   */
  animate?: boolean;
  /**
   * Animation style - lift: raises button on hover, scale: grows button on hover, none: no hover animation
   */
  hoverEffect?: 'lift' | 'scale' | 'glow' | 'none';
}

const MotionButton = motion.button;
const MotionSlot = motion(Slot);

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ 
    className, 
    variant, 
    size, 
    asChild = false, 
    animate = true,
    hoverEffect = 'lift',
    ...props 
  }, ref) => {
    const Comp = asChild ? MotionSlot : MotionButton;
    
    // Animation properties
    const springTransition = {
      type: 'spring',
      damping: 15,
      stiffness: 300
    };
    
    // Hover animations
    const hoverAnimations = {
      lift: {
        whileHover: { y: -3, boxShadow: "0 10px 15px -5px rgba(0, 0, 0, 0.1), 0 4px 10px -6px rgba(0, 0, 0, 0.1)" },
        whileTap: { y: 0, scale: 0.97 },
      },
      scale: {
        whileHover: { scale: 1.03 },
        whileTap: { scale: 0.97 },
      },
      glow: {
        whileHover: { 
          boxShadow: variant === 'default' 
            ? "0 0 10px 2px hsl(var(--primary) / 0.5)" 
            : "0 0 10px 2px rgba(0, 0, 0, 0.1)",
          filter: "brightness(1.05)",
        },
        whileTap: { 
          boxShadow: "none", 
          filter: "brightness(1)", 
          scale: 0.97 
        },
      },
      none: {},
    };
    
    const animationProps = animate && hoverEffect !== 'none' 
      ? {
          transition: springTransition,
          ...hoverAnimations[hoverEffect]
        }
      : {};
    
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...animationProps}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
