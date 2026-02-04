import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['tests/setup.ts'],
    include: ['tests/**/*.vitest.ts', 'tests/**/*.vitest.tsx'],
    // Exclude tests that require ai/react which has module resolution issues
    exclude: ['tests/integration/chat-flow.vitest.tsx'],
    coverage: {
      reporter: ['text', 'html'],
      reportsDirectory: 'coverage/unit',
    },
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
