import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = typeof __dirname === 'string' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['tests/setup.ts'],
    include: ['tests/**/*.vitest.ts'],
    coverage: {
      reporter: ['text', 'html'],
      reportsDirectory: 'coverage/unit',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(dirname, '.'),
    },
  },
});
