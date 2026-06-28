import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { getBasePath } from './src/lib/base-path';

export const githubPagesBase = getBasePath(process.env);

export default defineConfig({
  base: githubPagesBase,
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    css: true,
    exclude: ['node_modules/**', 'dist/**', 'tests/e2e/**'],
  },
});
