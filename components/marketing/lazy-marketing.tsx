'use client';

import dynamic from 'next/dynamic';

// Loading placeholder for heavy components
const LoadingPlaceholder = ({ height = 400 }: { height?: number }) => (
  <div 
    className="animate-pulse bg-gradient-to-r from-zinc-800/50 to-zinc-700/50 rounded-xl"
    style={{ height }}
  />
);

// Lazy load Three.js components (very heavy - ~500KB)
export const LazyDither = dynamic(
  () => import('@/components/Dither').then(mod => ({ default: mod.default })),
  {
    loading: () => <LoadingPlaceholder height={600} />,
    ssr: false, // Three.js doesn't work server-side
  }
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
