import React from 'react';
import { vi, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Mock framer-motion to avoid animations in tests
vi.mock('framer-motion', async () => {
  const actual = await vi.importActual('framer-motion');
  return {
    ...actual,
    motion: {
      div: ({ children, ...props }: any) => React.createElement('div', props, children),
      span: ({ children, ...props }: any) => React.createElement('span', props, children),
      button: ({ children, ...props }: any) => React.createElement('button', props, children),
    },
    AnimatePresence: ({ children }: any) => children,
  };
});

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Check: () => React.createElement('span', { 'data-testid': 'check-icon' }, '✓'),
  X: () => React.createElement('span', { 'data-testid': 'x-icon' }, '✕'),
  Loader2: () => React.createElement('span', { 'data-testid': 'loader-icon' }, '⟳'),
  ChevronDown: () => React.createElement('span', { 'data-testid': 'chevron-down-icon' }, '▼'),
  ChevronUp: () => React.createElement('span', { 'data-testid': 'chevron-up-icon' }, '▲'),
  Search: () => React.createElement('span', { 'data-testid': 'search-icon' }, '🔍'),
}));

// Cleanup after each test
afterEach(() => {
  cleanup();
});
