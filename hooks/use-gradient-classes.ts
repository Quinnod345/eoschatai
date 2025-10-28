'use client';

import { useUserSettings } from '@/components/user-settings-provider';
import { useMemo } from 'react';

/**
 * Hook to conditionally apply EOS gradient classes based on user settings
 * Returns empty string if gradients are disabled, otherwise returns the class name
 */
export function useGradientClass(gradientClassName: string): string {
  const { settings, loading } = useUserSettings();
  const isGradientDisabled = settings?.disableEosGradient ?? false;

  return useMemo(() => {
    // While loading, show the gradient by default to avoid flash
    if (loading) return gradientClassName;
    return isGradientDisabled ? '' : gradientClassName;
  }, [isGradientDisabled, gradientClassName, loading]);
}

/**
 * Hook to get a function that conditionally applies gradient classes
 * Useful for dynamic class names
 */
export function useGradientClassFn() {
  const { settings, loading } = useUserSettings();
  const isGradientDisabled = settings?.disableEosGradient ?? false;

  return useMemo(() => {
    return (gradientClassName: string) => {
      // While loading, show the gradient by default to avoid flash
      if (loading) return gradientClassName;
      return isGradientDisabled ? '' : gradientClassName;
    };
  }, [isGradientDisabled, loading]);
}

