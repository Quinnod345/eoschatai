'use client';

import * as React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';

import { cn } from '@/lib/utils';
import GlassSurface from '@/components/GlassSurface';

// Animation variants for select content
const selectContentVariants = {
  closed: {
    opacity: 0,
    scale: 0.95,
    y: -8,
    transition: {
      duration: 0.15,
      ease: [0.4, 0, 0.2, 1],
    },
  },
  open: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: 0.2,
      ease: [0, 0, 0.2, 1],
    },
  },
};

// Animation variants for individual items
const itemVariants = {
  closed: { opacity: 0, x: -4 },
  open: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.15,
      ease: [0, 0, 0.2, 1],
    },
  },
};

const Select = SelectPrimitive.Root;

const SelectGroup = SelectPrimitive.Group;

const SelectValue = SelectPrimitive.Value;

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => {
  const [isHovered, setIsHovered] = React.useState(false);
  const [isFocused, setIsFocused] = React.useState(false);

  return (
    <SelectPrimitive.Trigger
      ref={ref}
      className={cn(
        'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background',
        'placeholder:text-muted-foreground',
        'transition-all duration-200 ease-out',
        'hover:border-primary/50 hover:shadow-sm hover:bg-accent/5',
        'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:border-primary',
        'disabled:cursor-not-allowed disabled:opacity-50',
        '[&>span]:line-clamp-1',
        className,
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <motion.div
          animate={{
            rotate: isFocused ? 180 : 0,
            scale: isHovered ? 1.1 : 1,
          }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          <ChevronDown className="h-4 w-4 opacity-50" />
        </motion.div>
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
});
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

const SelectScrollUpButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollUpButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(({ className, ...props }, ref) => {
  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <SelectPrimitive.ScrollUpButton
      ref={ref}
      className={cn(
        'flex cursor-default items-center justify-center py-1',
        'transition-all duration-200',
        'hover:bg-accent',
        className,
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      {...props}
    >
      <motion.div
        animate={{ y: isHovered ? -2 : 0 }}
        transition={{ duration: 0.2 }}
      >
        <ChevronUp className="h-4 w-4" />
      </motion.div>
    </SelectPrimitive.ScrollUpButton>
  );
});
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName;

const SelectScrollDownButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollDownButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(({ className, ...props }, ref) => {
  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <SelectPrimitive.ScrollDownButton
      ref={ref}
      className={cn(
        'flex cursor-default items-center justify-center py-1',
        'transition-all duration-200',
        'hover:bg-accent',
        className,
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      {...props}
    >
      <motion.div
        animate={{ y: isHovered ? 2 : 0 }}
        transition={{ duration: 0.2 }}
      >
        <ChevronDown className="h-4 w-4" />
      </motion.div>
    </SelectPrimitive.ScrollDownButton>
  );
});
SelectScrollDownButton.displayName =
  SelectPrimitive.ScrollDownButton.displayName;

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = 'popper', ...props }, ref) => (
  <SelectPrimitive.Portal>
    <AnimatePresence>
      <SelectPrimitive.Content
        ref={ref}
        className={cn(
          'relative z-select max-h-[400px] min-w-[8rem] overflow-hidden rounded-lg text-popover-foreground',
          position === 'popper' &&
            'data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1',
          className,
        )}
        style={{
          boxShadow:
            '0 20px 60px rgba(0, 0, 0, 0.3), 0 8px 24px rgba(0, 0, 0, 0.2)',
        }}
        position={position}
        sideOffset={5}
        {...props}
      >
        <GlassSurface
          width="100%"
          height="100%"
          borderRadius={8}
          displace={2}
          backgroundOpacity={0.2}
          blur={10}
          insetShadowIntensity={0.4}
          isBackdrop={true}
        />
        <motion.div
          initial="closed"
          animate="open"
          exit="closed"
          variants={selectContentVariants}
          className="flex flex-col max-h-[400px] relative z-10"
        >
          <SelectScrollUpButton />
          <SelectPrimitive.Viewport
            className={cn(
              'p-1 flex-1 overflow-y-auto',
              position === 'popper' &&
                'w-full min-w-[var(--radix-select-trigger-width)]',
            )}
          >
            {children}
          </SelectPrimitive.Viewport>
          <SelectScrollDownButton />
        </motion.div>
      </SelectPrimitive.Content>
    </AnimatePresence>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = SelectPrimitive.Content.displayName;

const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn('py-1.5 pl-8 pr-2 text-sm font-semibold', className)}
    {...props}
  />
));
SelectLabel.displayName = SelectPrimitive.Label.displayName;

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => {
  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <motion.div variants={itemVariants}>
      <SelectPrimitive.Item
        ref={ref}
        className={cn(
          'relative flex w-full cursor-default select-none items-center rounded-md py-1.5 pl-8 pr-2 text-sm outline-none',
          'transition-all duration-200 ease-out',
          'hover:bg-accent hover:text-accent-foreground hover:pl-9 hover:shadow-sm hover:scale-[1.01]',
          'focus:bg-accent focus:text-accent-foreground focus:pl-9 focus:shadow-sm',
          'active:scale-[0.98]',
          'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
          className,
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        {...props}
      >
        <motion.span
          className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center"
          animate={{ scale: isHovered ? 1.1 : 1 }}
          transition={{ duration: 0.2 }}
        >
          <SelectPrimitive.ItemIndicator>
            <motion.div
              initial={{ scale: 0, rotate: -90 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            >
              <Check className="h-4 w-4" />
            </motion.div>
          </SelectPrimitive.ItemIndicator>
        </motion.span>

        <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      </SelectPrimitive.Item>
    </motion.div>
  );
});
SelectItem.displayName = SelectPrimitive.Item.displayName;

const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn('-mx-1 my-1 h-px bg-muted', className)}
    {...props}
  />
));
SelectSeparator.displayName = SelectPrimitive.Separator.displayName;

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
};
