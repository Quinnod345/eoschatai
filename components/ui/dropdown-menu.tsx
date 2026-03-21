'use client';

import * as React from 'react';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronRight, Circle } from 'lucide-react';

import { cn } from '@/lib/utils';


// Animation variants for dropdown content
const dropdownContentVariants = {
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
      staggerChildren: 0.02,
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

const DropdownMenu = DropdownMenuPrimitive.Root;

const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;

const DropdownMenuGroup = DropdownMenuPrimitive.Group;

const DropdownMenuPortal = DropdownMenuPrimitive.Portal;

const DropdownMenuSub = DropdownMenuPrimitive.Sub;

const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

const DropdownMenuSubTrigger = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubTrigger>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubTrigger> & {
    inset?: boolean;
  }
>(({ className, inset, children, ...props }, ref) => {
  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <DropdownMenuPrimitive.SubTrigger
      ref={ref}
      className={cn(
        'flex cursor-default gap-2 select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-all duration-200 ease-out',
        'text-foreground',
        'hover:bg-zinc-900/10 dark:hover:bg-white/10 hover:text-foreground hover:pl-3 hover:shadow-sm',
        'focus:bg-zinc-900/10 dark:focus:bg-white/10 data-[state=open]:bg-zinc-900/10 dark:data-[state=open]:bg-white/10 data-[state=open]:pl-3 data-[state=open]:shadow-sm',
        '[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
        inset && 'pl-8',
        className,
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      {...props}
    >
      {children}
      <motion.div
        animate={{ x: isHovered ? 2 : 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="ml-auto"
      >
        <ChevronRight />
      </motion.div>
    </DropdownMenuPrimitive.SubTrigger>
  );
});
DropdownMenuSubTrigger.displayName =
  DropdownMenuPrimitive.SubTrigger.displayName;

const DropdownMenuSubContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubContent>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubContent>
>(({ className, children, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.SubContent
      ref={ref}
      className={cn(
        'relative z-dropdown min-w-[8rem] overflow-hidden rounded-xl text-popover-foreground bg-popover p-1 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
        className,
      )}
      style={{
        boxShadow:
          '0 20px 60px rgba(0, 0, 0, 0.3), 0 8px 24px rgba(0, 0, 0, 0.2)',
      }}
      {...props}
    >
      <div className="relative z-10">{children}</div>
    </DropdownMenuPrimitive.SubContent>
  </DropdownMenuPrimitive.Portal>
));
DropdownMenuSubContent.displayName =
  DropdownMenuPrimitive.SubContent.displayName;

const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 4, children, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <AnimatePresence>
      <DropdownMenuPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        collisionPadding={16}
        className={cn(
          'relative z-dropdown min-w-[8rem] max-h-[calc(100vh-2rem)] overflow-y-auto rounded-xl text-popover-foreground bg-popover p-1',
          className,
        )}
        style={{
          boxShadow:
            '0 20px 60px rgba(0, 0, 0, 0.3), 0 8px 24px rgba(0, 0, 0, 0.2)',
        }}
        {...props}
      >
        <motion.div
          initial="closed"
          animate="open"
          exit="closed"
          variants={dropdownContentVariants}
          className="relative z-10"
        >
          {children}
        </motion.div>
      </DropdownMenuPrimitive.Content>
    </AnimatePresence>
  </DropdownMenuPrimitive.Portal>
));
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName;

const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & {
    inset?: boolean;
  }
>(({ className, inset, ...props }, ref) => {
  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <motion.div variants={itemVariants}>
      <DropdownMenuPrimitive.Item
        ref={ref}
        className={cn(
          'relative flex cursor-default select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none',
          'transition-all duration-200 ease-out',
          'text-foreground',
          'hover:bg-zinc-900/10 dark:hover:bg-white/10 hover:text-foreground hover:pl-3 hover:shadow-sm hover:scale-[1.01]',
          'focus:bg-zinc-900/10 dark:focus:bg-white/10 focus:text-foreground focus:pl-3 focus:shadow-sm',
          'active:scale-[0.98]',
          'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
          '[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:transition-transform [&_svg]:duration-200',
          isHovered && '[&_svg]:scale-110',
          inset && 'pl-8',
          className,
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        {...props}
      />
    </motion.div>
  );
});
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName;

const DropdownMenuCheckboxItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem>
>(({ className, children, checked, ...props }, ref) => {
  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <motion.div variants={itemVariants}>
      <DropdownMenuPrimitive.CheckboxItem
        ref={ref}
        className={cn(
          'relative flex cursor-default select-none items-center rounded-md py-1.5 pl-8 pr-2 text-sm outline-none',
          'transition-all duration-200 ease-out',
          'text-foreground',
          'hover:bg-zinc-900/10 dark:hover:bg-white/10 hover:text-foreground hover:pl-9 hover:shadow-sm hover:scale-[1.01]',
          'focus:bg-zinc-900/10 dark:focus:bg-white/10 focus:text-foreground focus:pl-9 focus:shadow-sm',
          'active:scale-[0.98]',
          'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
          className,
        )}
        checked={checked}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        {...props}
      >
        <motion.span
          className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center"
          animate={{ scale: isHovered ? 1.1 : 1 }}
          transition={{ duration: 0.2 }}
        >
          <DropdownMenuPrimitive.ItemIndicator>
            <motion.div
              initial={{ scale: 0, rotate: -90 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            >
              <Check className="h-4 w-4" />
            </motion.div>
          </DropdownMenuPrimitive.ItemIndicator>
        </motion.span>
        {children}
      </DropdownMenuPrimitive.CheckboxItem>
    </motion.div>
  );
});
DropdownMenuCheckboxItem.displayName =
  DropdownMenuPrimitive.CheckboxItem.displayName;

const DropdownMenuRadioItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.RadioItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem>
>(({ className, children, ...props }, ref) => {
  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <motion.div variants={itemVariants}>
      <DropdownMenuPrimitive.RadioItem
        ref={ref}
        className={cn(
          'relative flex cursor-default select-none items-center rounded-md py-1.5 pl-8 pr-2 text-sm outline-none',
          'transition-all duration-200 ease-out',
          'text-foreground',
          'hover:bg-zinc-900/10 dark:hover:bg-white/10 hover:text-foreground hover:pl-9 hover:shadow-sm hover:scale-[1.01]',
          'focus:bg-zinc-900/10 dark:focus:bg-white/10 focus:text-foreground focus:pl-9 focus:shadow-sm',
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
          <DropdownMenuPrimitive.ItemIndicator>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            >
              <Circle className="h-2 w-2 fill-current" />
            </motion.div>
          </DropdownMenuPrimitive.ItemIndicator>
        </motion.span>
        {children}
      </DropdownMenuPrimitive.RadioItem>
    </motion.div>
  );
});
DropdownMenuRadioItem.displayName = DropdownMenuPrimitive.RadioItem.displayName;

const DropdownMenuLabel = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label> & {
    inset?: boolean;
  }
>(({ className, inset, ...props }, ref) => (
  <DropdownMenuPrimitive.Label
    ref={ref}
    className={cn(
      'px-2 py-1.5 text-sm font-semibold',
      inset && 'pl-8',
      className,
    )}
    {...props}
  />
));
DropdownMenuLabel.displayName = DropdownMenuPrimitive.Label.displayName;

const DropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator
    ref={ref}
    className={cn('-mx-1 my-1 h-px bg-muted', className)}
    {...props}
  />
));
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName;

const DropdownMenuShortcut = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) => {
  return (
    <span
      className={cn('ml-auto text-xs tracking-widest opacity-60', className)}
      {...props}
    />
  );
};
DropdownMenuShortcut.displayName = 'DropdownMenuShortcut';

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
};
