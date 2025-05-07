import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface AnimatedLayoutProps {
  children: React.ReactNode;
  className?: string;
  /**
   * Animation type to use for the layout
   */
  animation?: 'fadeIn' | 'slideUp' | 'slideDown' | 'staggered' | 'none';
  /**
   * Stagger children animations (only applies when the animation is 'staggered')
   */
  staggerChildren?: boolean;
  /**
   * Delay between staggered children in seconds
   */
  staggerDelay?: number;
  /**
   * Key for the AnimatePresence component
   */
  presenceKey?: string;
  /**
   * Whether to use layout animations for children moving positions
   */
  useLayoutAnimations?: boolean;
}

const variants = {
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { type: 'spring', damping: 20, stiffness: 300 }
  },
  slideUp: {
    initial: { y: 20, opacity: 0 },
    animate: { y: 0, opacity: 1 },
    exit: { y: -20, opacity: 0 },
    transition: { type: 'spring', damping: 25, stiffness: 350 }
  },
  slideDown: {
    initial: { y: -20, opacity: 0 },
    animate: { y: 0, opacity: 1 },
    exit: { y: 20, opacity: 0 },
    transition: { type: 'spring', damping: 25, stiffness: 350 }
  },
  staggered: {
    initial: { opacity: 0 },
    animate: { 
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    },
    exit: { opacity: 0 },
    transition: { type: 'spring', damping: 20, stiffness: 300 }
  },
  none: {
    initial: {},
    animate: {},
    exit: {},
    transition: {}
  }
};

// Staggered child variants
const childVariants = {
  initial: { y: 20, opacity: 0 },
  animate: { y: 0, opacity: 1, transition: { type: 'spring', damping: 20, stiffness: 300 } },
  exit: { y: 20, opacity: 0 }
};

export const AnimatedLayout: React.FC<AnimatedLayoutProps> = ({
  children,
  className,
  animation = 'fadeIn',
  staggerChildren = false,
  staggerDelay = 0.1,
  presenceKey,
  useLayoutAnimations = false,
}) => {
  // Choose appropriate variant based on animation type
  const variant = variants[animation];

  // Configure staggering if requested
  const staggerVariants = staggerChildren && animation === 'staggered'
    ? {
        animate: {
          ...variant.animate,
          transition: {
            ...variant.transition,
            staggerChildren: staggerDelay,
          }
        }
      }
    : {};

  // Combine variants with any stagger options
  const combinedVariants = {
    ...variant,
    ...staggerVariants
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={presenceKey}
        className={cn(className)}
        initial={combinedVariants.initial}
        animate={combinedVariants.animate}
        exit={combinedVariants.exit}
        transition={combinedVariants.transition}
        layout={useLayoutAnimations}
      >
        {staggerChildren && animation === 'staggered'
          ? // If using staggered layout, wrap each child to animate individually
            React.Children.map(children, (child, i) => (
              <motion.div
                key={i}
                variants={childVariants}
                layout={useLayoutAnimations}
              >
                {child}
              </motion.div>
            ))
          : children}
      </motion.div>
    </AnimatePresence>
  );
};

export default AnimatedLayout; 