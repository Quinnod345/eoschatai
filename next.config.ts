import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-icons',
      'react-markdown',
      'codemirror',
      '@codemirror/lang-javascript',
      '@codemirror/lang-python',
      'prosemirror-*',
      'chart.js',
      'react-data-grid',
      'framer-motion',
      'motion',
      '@iconify/react',
      'xlsx',
      'jszip',
      'three',
      '@react-three/fiber',
      'gsap',
      'natural',
      'marked',
      'diff-match-patch',
    ],
  },
  images: {
    remotePatterns: [
      {
        hostname: 'avatar.vercel.sh',
      },
      {
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com',
      },
      {
        protocol: 'https',
        hostname: 'www.google.com',
      },
    ],
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  compiler: {
    removeConsole:
      process.env.NODE_ENV === 'production'
        ? { exclude: ['error', 'warn'] }
        : false,
  },
  productionBrowserSourceMaps: false,
  webpack: (config, { isServer }) => {
    // Bundle size optimizations
    if (!isServer) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          ...config.optimization.splitChunks,
          chunks: 'all',
          cacheGroups: {
            ...config.optimization.splitChunks.cacheGroups,
            // Separate heavy animation libraries
            animations: {
              test: /[\\/]node_modules[\\/](motion|gsap|lottie-react|three|@react-three)[\\/]/,
              name: 'animations',
              chunks: 'all',
              priority: 10,
            },
            // Separate document processing libraries  
            documents: {
              test: /[\\/]node_modules[\\/](xlsx|jszip|mammoth|pdf-parse|prosemirror-)[\\/]/,
              name: 'documents',
              chunks: 'all',
              priority: 10,
            },
            // Separate charting libraries
            charts: {
              test: /[\\/]node_modules[\\/](chart\.js|react-data-grid)[\\/]/,
              name: 'charts',
              chunks: 'all', 
              priority: 10,
            },
            // AI/ML libraries
            ai: {
              test: /[\\/]node_modules[\\/](openai|@anthropic-ai|natural|tiktoken)[\\/]/,
              name: 'ai',
              chunks: 'all',
              priority: 10,
            },
          },
        },
      };
    }
    
    return config;
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
        ],
      },
      {
        source: '/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
};

// Wrap with Sentry configuration
export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://github.com/getsentry/sentry-webpack-plugin#options

  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  tunnelRoute: '/monitoring',

  // Source maps configuration
  sourcemaps: {
    // Don't upload source maps to Sentry in development
    deleteSourcemapsAfterUpload: true,
  },

  // Webpack configuration - new recommended format to replace deprecated options
  webpack: {
    // Automatically tree-shake Sentry logger statements to reduce bundle size
    treeshake: {
      removeDebugLogging: true,
    },
    // Automatically annotate React components to show their full name in breadcrumbs and session replay
    reactComponentAnnotation: {
      enabled: true,
    },
    // Enables automatic instrumentation of Vercel Cron Monitors
    automaticVercelMonitors: true,
  },
});
