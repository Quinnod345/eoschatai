'use client';

import dynamic from 'next/dynamic';
import { Component, type ReactNode } from 'react';

// Loading placeholder for heavy components
const LoadingPlaceholder = ({ height = 400 }: { height?: number }) => (
  <div 
    className="animate-pulse bg-gradient-to-r from-zinc-800/50 to-zinc-700/50 rounded-xl"
    style={{ height }}
  />
);

// Error boundary for R3F components - prevents crashes from WebGL/rendering issues
interface R3FErrorBoundaryState {
  hasError: boolean;
}

class R3FErrorBoundary extends Component<{ children: ReactNode; fallbackHeight?: number }, R3FErrorBoundaryState> {
  constructor(props: { children: ReactNode; fallbackHeight?: number }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): R3FErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log to console in development, silently fail in production
    if (process.env.NODE_ENV === 'development') {
      console.warn('[R3F Error Boundary] Caught error:', error.message);
    }
  }

  render() {
    if (this.state.hasError) {
      // Render a subtle fallback instead of crashing
      return (
        <div 
          className="bg-gradient-to-br from-zinc-900/80 to-zinc-800/80 rounded-xl"
          style={{ height: this.props.fallbackHeight || 600 }}
        />
      );
    }

    return this.props.children;
  }
}

// Lazy load Three.js components (very heavy - ~500KB)
// Wrapped in error boundary to prevent R3F crashes from affecting the page
const LazyDitherInner = dynamic(
  () => import('@/components/Dither').then(mod => ({ default: mod.default })),
  {
    loading: () => <LoadingPlaceholder height={600} />,
    ssr: false, // Three.js doesn't work server-side
  }
);

// Export with error boundary wrapper
export const LazyDither = (props: React.ComponentProps<typeof LazyDitherInner>) => (
  <R3FErrorBoundary fallbackHeight={600}>
    <LazyDitherInner {...props} />
  </R3FErrorBoundary>
);

// Lazy load heavy animation components
export const LazyMagicBento = dynamic(
  () => import('@/components/MagicBento').then(mod => ({ default: mod.default })),
  {
    loading: () => <LoadingPlaceholder height={500} />,
    ssr: false,
  }
);

export const LazyGradientBlinds = dynamic(
  () => import('@/components/GradientBlinds').then(mod => ({ default: mod.default })),
  {
    loading: () => <LoadingPlaceholder height={300} />,
    ssr: false,
  }
);

export const LazyDotGrid = dynamic(
  () => import('@/components/DotGrid').then(mod => ({ default: mod.default })),
  {
    loading: () => <LoadingPlaceholder height={400} />,
    ssr: false,
  }
);

export const LazyRotatingText = dynamic(
  () => import('@/components/RotatingText').then(mod => ({ default: mod.default })),
  {
    loading: () => <span className="inline-block animate-pulse bg-zinc-700/50 rounded w-32 h-8" />,
    ssr: false,
  }
);

export const LazyScrollFloat = dynamic(
  () => import('@/components/ScrollFloat').then(mod => ({ default: mod.default })),
  {
    loading: () => <div className="animate-pulse" />,
    ssr: false,
  }
);

export const LazyCircularText = dynamic(
  () => import('@/components/CircularText').then(mod => ({ default: mod.default })),
  {
    loading: () => <div className="w-32 h-32 animate-pulse bg-zinc-700/50 rounded-full" />,
    ssr: false,
  }
);

// Voice mode components (heavy with audio processing)
export const LazyVoiceMode = dynamic(
  () => import('@/components/voice-mode'),
  {
    loading: () => <LoadingPlaceholder height={200} />,
    ssr: false,
  }
);

export const LazyRecordingModal = dynamic(
  () => import('@/components/recording-modal'),
  {
    loading: () => null,
    ssr: false,
  }
);

// Composer dashboard (heavy with many features)
export const LazyComposerDashboard = dynamic(
  () => import('@/components/composer-dashboard').then(mod => ({ default: mod.ComposerDashboard })),
  {
    loading: () => <LoadingPlaceholder height={400} />,
    ssr: false,
  }
);

// Organization modals (not needed on initial load)
export const LazyOrganizationModal = dynamic(
  () => import('@/components/organization-modal').then(mod => ({ default: mod.OrganizationModal })),
  {
    loading: () => null,
    ssr: false,
  }
);

export const LazyOrganizationSettings = dynamic(
  () => import('@/components/organization-settings').then(mod => ({ default: mod.OrganizationSettings })),
  {
    loading: () => null,
    ssr: false,
  }
);

// Premium features modal
export const LazyPremiumFeaturesModal = dynamic(
  () => import('@/components/premium-features-modal').then(mod => ({ default: mod.PremiumFeaturesModal })),
  {
    loading: () => null,
    ssr: false,
  }
);

// Personas dropdown (moderately heavy)
export const LazyPersonasDropdown = dynamic(
  () => import('@/components/personas-dropdown').then(mod => ({ default: mod.PersonasDropdown })),
  {
    loading: () => <div className="w-full h-10 animate-pulse bg-zinc-700/50 rounded" />,
    ssr: false,
  }
);
