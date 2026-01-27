'use client';

import React, { memo, useState, useEffect, useRef, useCallback, forwardRef } from 'react';

interface ControlledInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  /** External value (from parent state) */
  value: string;
  /** Called when value changes */
  onChange: (value: string) => void;
  /** Delay before syncing external value changes (default: 150ms) */
  syncDelay?: number;
}

/**
 * Focus-safe controlled input component.
 * 
 * Uses local state to prevent focus loss when parent re-renders.
 * External value changes are only synced when the user is not actively typing.
 */
export const ControlledInput = memo(forwardRef<HTMLInputElement, ControlledInputProps>(
  function ControlledInput({ value: externalValue, onChange, syncDelay = 150, ...props }, ref) {
    const [localValue, setLocalValue] = useState(externalValue);
    const isTypingRef = useRef(false);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Sync from external value only when not typing
    useEffect(() => {
      if (!isTypingRef.current && externalValue !== localValue) {
        setLocalValue(externalValue);
      }
    }, [externalValue, localValue]);

    // Cleanup timeout on unmount
    useEffect(() => {
      return () => {
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
      };
    }, []);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      
      // Mark as typing
      isTypingRef.current = true;
      
      // Clear previous timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Update local state immediately
      setLocalValue(newValue);
      
      // Notify parent
      onChange(newValue);
      
      // Reset typing flag after delay
      typingTimeoutRef.current = setTimeout(() => {
        isTypingRef.current = false;
      }, syncDelay);
    }, [onChange, syncDelay]);

    return <input ref={ref} value={localValue} onChange={handleChange} {...props} />;
  }
));

interface ControlledTextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
  /** External value (from parent state) */
  value: string;
  /** Called when value changes */
  onChange: (value: string) => void;
  /** Delay before syncing external value changes (default: 150ms) */
  syncDelay?: number;
}

/**
 * Focus-safe controlled textarea component.
 */
export const ControlledTextarea = memo(forwardRef<HTMLTextAreaElement, ControlledTextareaProps>(
  function ControlledTextarea({ value: externalValue, onChange, syncDelay = 150, ...props }, ref) {
    const [localValue, setLocalValue] = useState(externalValue);
    const isTypingRef = useRef(false);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
      if (!isTypingRef.current && externalValue !== localValue) {
        setLocalValue(externalValue);
      }
    }, [externalValue, localValue]);

    useEffect(() => {
      return () => {
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
      };
    }, []);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      
      isTypingRef.current = true;
      
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      setLocalValue(newValue);
      onChange(newValue);
      
      typingTimeoutRef.current = setTimeout(() => {
        isTypingRef.current = false;
      }, syncDelay);
    }, [onChange, syncDelay]);

    return <textarea ref={ref} value={localValue} onChange={handleChange} {...props} />;
  }
));

interface ControlledFieldProps<T> {
  /** External value (from parent state) */
  value: T;
  /** Called when value changes */
  onChange: (value: T) => void;
  /** Render function for the input */
  children: (props: {
    value: T;
    onChange: (value: T) => void;
  }) => React.ReactNode;
  /** Delay before syncing external value changes (default: 150ms) */
  syncDelay?: number;
}

/**
 * Generic controlled field wrapper for custom inputs.
 * Provides focus-safe behavior for any input type.
 */
export function ControlledField<T>({
  value: externalValue,
  onChange,
  children,
  syncDelay = 150,
}: ControlledFieldProps<T>) {
  const [localValue, setLocalValue] = useState(externalValue);
  const isTypingRef = useRef(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isTypingRef.current) {
      setLocalValue(externalValue);
    }
  }, [externalValue]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  const handleChange = useCallback((newValue: T) => {
    isTypingRef.current = true;
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    setLocalValue(newValue);
    onChange(newValue);
    
    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
    }, syncDelay);
  }, [onChange, syncDelay]);

  return <>{children({ value: localValue, onChange: handleChange })}</>;
}
