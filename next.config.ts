import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  experimental: {
    ppr: true,
  },
  images: {
    remotePatterns: [
      {
        hostname: 'avatar.vercel.sh',
      },
    ],
  },
  webpack: (config, { isServer, dev }) => {
    if (!dev) {
      if (!config.externals) {
        config.externals = [];
      }

      config.module = {
        ...config.module,
        rules: [
          ...(config.module?.rules || []),
          {
            test: /\.test\.(tsx|ts|js|jsx|mjs)$/,
            use: 'null-loader',
          },
        ],
      };

      // Replace test files with empty modules
      config.resolve.alias = {
        ...config.resolve.alias,
        // Exclude test files from import
        '.+\\.test\\.(tsx|ts|js|jsx|mjs)$': path.resolve(
          __dirname,
          './empty-module.js',
        ),
      };
    }

    return config;
  },
};

export default nextConfig;
