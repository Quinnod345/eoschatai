'use client';

import React, { useEffect, useRef, useState, type ReactNode } from 'react';
import { toast as sonnerToast } from 'sonner';
import { motion } from 'framer-motion';
import { CheckCircleFillIcon, WarningIcon } from './icons';
import { cn } from '@/lib/utils';

const iconsByType: Record<'success' | 'error', ReactNode> = {
  success: <CheckCircleFillIcon />,
  error: <WarningIcon />,
};

export function toast(props: Omit<ToastProps, 'id'>) {
  return sonnerToast.custom((id) => (
    <Toast id={id} type={props.type} description={props.description} />
  ));
}

// Toast animation variants
const toastVariants = {
  initial: { opacity: 0, y: 20, scale: 0.95 },
  animate: { 
    opacity: 1, 
    y: 0, 
    scale: 1,
    transition: { 
      type: 'spring',
      damping: 20,
      stiffness: 300
    }
  },
  exit: { 
    opacity: 0, 
    y: -20, 
    scale: 0.95,
    transition: { 
      type: 'spring',
      damping: 20,
      stiffness: 300
    }
  }
};

// Icon animation variants
const iconVariants = {
  initial: { scale: 0.8, opacity: 0 },
  animate: { 
    scale: 1, 
    opacity: 1,
    transition: { 
      type: 'spring',
      damping: 10,
      stiffness: 300,
      delay: 0.1
    }
  }
};

// Text animation variants
const textVariants = {
  initial: { opacity: 0, x: -5 },
  animate: { 
    opacity: 1, 
    x: 0,
    transition: { 
      type: 'spring',
      damping: 20,
      stiffness: 300,
      delay: 0.15
    }
  }
};

function Toast(props: ToastProps) {
  const { id, type, description } = props;

  const descriptionRef = useRef<HTMLDivElement>(null);
  const [multiLine, setMultiLine] = useState(false);

  useEffect(() => {
    const el = descriptionRef.current;
    if (!el) return;

    const update = () => {
      const lineHeight = Number.parseFloat(getComputedStyle(el).lineHeight);
      const lines = Math.round(el.scrollHeight / lineHeight);
      setMultiLine(lines > 1);
    };

    update(); // initial check
    const ro = new ResizeObserver(update); // re-check on width changes
    ro.observe(el);

    return () => ro.disconnect();
  }, [description]);

  return (
    <div className="flex w-full toast-mobile:w-[356px] justify-center">
      <motion.div
        data-testid="toast"
        key={id}
        className={cn(
          'bg-zinc-100 p-3 rounded-lg w-full toast-mobile:w-fit flex flex-row gap-3',
          multiLine ? 'items-start' : 'items-center',
        )}
        variants={toastVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        whileHover={{ scale: 1.02 }}
        layout
      >
        <motion.div
          data-type={type}
          className={cn(
            'data-[type=error]:text-red-600 data-[type=success]:text-green-600',
            { 'pt-1': multiLine },
          )}
          variants={iconVariants}
        >
          {iconsByType[type]}
        </motion.div>
        <motion.div 
          ref={descriptionRef} 
          className="text-zinc-950 text-sm"
          variants={textVariants}
        >
          {description}
        </motion.div>
      </motion.div>
    </div>
  );
}

interface ToastProps {
  id: string | number;
  type: 'success' | 'error';
  description: string;
}
