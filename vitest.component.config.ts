import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = typeof __dirname === 'string' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['tests/component-setup.ts'],
    include: ['tests/unit/components/**/*.vitest.ts', 'tests/unit/components/**/*.vitest.tsx'],
    globals: true,
    coverage: {
      reporter: ['text', 'html'],
      reportsDirectory: 'coverage/components',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(dirname, '.'),
    },
  },
});
