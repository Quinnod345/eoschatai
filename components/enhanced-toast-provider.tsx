'use client';

import { Toaster } from 'sonner';
import { useTheme } from 'next-themes';

export function ToastProvider() {
  const { theme } = useTheme();

  return (
    <Toaster
      theme={(theme as 'light' | 'dark' | 'system') || 'system'}
      position="top-center"
      offset={24}
      gap={10}
      expand={true}
      visibleToasts={4}
      closeButton={false}
      pauseWhenPageIsHidden={true}
      toastOptions={{
        className: 'eos-toast',
        descriptionClassName: 'text-sm',
        duration: 4000,
        style: {
          animation: undefined,
        },
      }}
    />
  );
}
