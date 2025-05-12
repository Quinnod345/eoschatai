'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import type { ThemeProviderProps } from 'next-themes/dist/types';
import { useEffect, useState } from 'react';

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  const [mounted, setMounted] = useState(false);

  // Only render the theme provider and its children after client-side hydration
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Return a simple div with no children to prevent hydration mismatch
    return <div style={{ visibility: 'hidden' }}>{children}</div>;
  }

  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
