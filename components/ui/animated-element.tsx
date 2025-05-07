import React from 'react';
import { motion, HTMLMotionProps, Variants } from 'framer-motion';
import { cn } from '@/lib/utils';

// Animation presets using spring physics
export const ANIMATION_PRESETS = {
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { 
      type: 'spring', 
      damping: 20, 
      stiffness: 300 
    }
  },
  slideUp: {
    initial: { y: 20, opacity: 0 },
    animate: { y: 0, opacity: 1 },
    exit: { y: -20, opacity: 0 },
    transition: { 
      type: 'spring', 
      damping: 25, 
      stiffness: 350 
    }
  },
  slideDown: {
    initial: { y: -20, opacity: 0 },
    animate: { y: 0, opacity: 1 },
    exit: { y: 20, opacity: 0 },
    transition: { 
      type: 'spring', 
      damping: 25, 
      stiffness: 350 
    }
  },
  scaleUp: {
    initial: { scale: 0.95, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    exit: { scale: 0.95, opacity: 0 },
    transition: { 
      type: 'spring', 
      damping: 20, 
      stiffness: 300 
    }
  },
  popIn: {
    initial: { scale: 0.85, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    exit: { scale: 0.85, opacity: 0 },
    transition: { 
      type: 'spring', 
      damping: 12, 
      stiffness: 300, 
      mass: 0.8 
    }
  },
  bounce: {
    initial: { y: -10, opacity: 0 },
    animate: { y: 0, opacity: 1 },
    exit: { y: 10, opacity: 0 },
    transition: { 
      type: 'spring', 
      damping: 8, 
      stiffness: 200, 
      mass: 1 
    }
  }
};

// Hover animations
export const HOVER_EFFECTS = {
  lift: {
    whileHover: { 
      y: -3, 
      boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)"
    },
    whileTap: { 
      y: 0, 
      scale: 0.98 
    }
  },
  scale: {
    whileHover: { 
      scale: 1.03,
      boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)" 
    },
    whileTap: { 
      scale: 0.98 
    }
  },
  glow: {
    whileHover: { 
      boxShadow: "0 0 15px 2px rgba(255, 149, 0, 0.4)", 
      filter: "brightness(1.05)" 
    },
    whileTap: { 
      boxShadow: "0 0 8px 1px rgba(255, 149, 0, 0.4)", 
      filter: "brightness(1)" 
    }
  }
};

export interface AnimatedElementProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
  className?: string;
  preset?: keyof typeof ANIMATION_PRESETS;
  hoverEffect?: keyof typeof HOVER_EFFECTS;
  delay?: number;
  duration?: number;
  as?: React.ElementType;
  staggerChildren?: boolean;
  staggerDelay?: number;
}

export const AnimatedElement: React.FC<AnimatedElementProps> = ({
  children,
  className,
  preset = "fadeIn",
  hoverEffect,
  delay = 0,
  duration,
  as = "div",
  staggerChildren = false,
  staggerDelay = 0.05,
  ...props
}) => {
  const Component = motion[as as keyof typeof motion] || motion.div;
  
  const animation = ANIMATION_PRESETS[preset];
  const hover = hoverEffect ? HOVER_EFFECTS[hoverEffect] : undefined;
  
  // Apply custom duration if specified
  const customTransition = duration 
    ? { ...animation.transition, duration } 
    : animation.transition;
  
  // Apply delay if specified
  const finalTransition = delay 
    ? { ...customTransition, delay } 
    : customTransition;
  
  // Set up children staggering if enabled
  const staggerVariants: Variants = staggerChildren 
    ? {
        animate: {
          transition: {
            staggerChildren: staggerDelay,
            delayChildren: delay,
          },
        },
      }
    : {};
  
  return (
    <Component
      initial={animation.initial}
      animate={animation.animate}
      exit={animation.exit}
      transition={finalTransition}
      whileHover={hover?.whileHover}
      whileTap={hover?.whileTap}
      className={cn(className)}
      variants={staggerVariants}
      {...props}
    >
      {children}
    </Component>
  );
};

// Animated elements with predefined settings
export const FadeIn = (props: Omit<AnimatedElementProps, "preset">) => (
  <AnimatedElement preset="fadeIn" {...props} />
);

export const SlideUp = (props: Omit<AnimatedElementProps, "preset">) => (
  <AnimatedElement preset="slideUp" {...props} />
);

export const SlideDown = (props: Omit<AnimatedElementProps, "preset">) => (
  <AnimatedElement preset="slideDown" {...props} />
);

export const ScaleUp = (props: Omit<AnimatedElementProps, "preset">) => (
  <AnimatedElement preset="scaleUp" {...props} />
);

export const PopIn = (props: Omit<AnimatedElementProps, "preset">) => (
  <AnimatedElement preset="popIn" {...props} />
);

export const Bounce = (props: Omit<AnimatedElementProps, "preset">) => (
  <AnimatedElement preset="bounce" {...props} />
);

export default AnimatedElement; 