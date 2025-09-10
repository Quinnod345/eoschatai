'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface AnimatedModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export function AnimatedModal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
}: AnimatedModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 z-[9998]"
            style={{
              backdropFilter: 'none',
              WebkitBackdropFilter: 'none',
            }}
            onClick={onClose}
          />

          {/* Modal */}
          <div className="fixed inset-0 flex items-center justify-center p-4 z-[9999]">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{
                type: 'spring',
                duration: 0.3,
                bounce: 0.3,
              }}
              className={`rounded-2xl shadow-2xl w-full ${sizeClasses[size]} max-h-[90vh] flex flex-col border-2 border-gray-200 dark:border-gray-700 isolate`}
              style={{
                backgroundColor: document.documentElement.classList.contains(
                  'dark',
                )
                  ? 'rgb(17, 24, 39)'
                  : '#ffffff',
                backdropFilter: 'none',
                WebkitBackdropFilter: 'none',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div
                className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700"
                style={{
                  backgroundColor: document.documentElement.classList.contains(
                    'dark',
                  )
                    ? 'rgb(31, 41, 55)'
                    : '#f9fafb',
                  borderBottomWidth: '2px',
                }}
              >
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  {title}
                </h2>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* Content */}
              <div
                className="flex-1 overflow-y-auto px-6 py-4 rounded-b-2xl"
                style={{
                  backgroundColor: document.documentElement.classList.contains(
                    'dark',
                  )
                    ? 'rgb(17, 24, 39)'
                    : '#ffffff',
                  backdropFilter: 'none',
                  WebkitBackdropFilter: 'none',
                }}
              >
                {children}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
