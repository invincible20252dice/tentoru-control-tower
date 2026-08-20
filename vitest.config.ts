import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/setupTests.ts'],
    testTimeout: 15000,
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    coverage: {
      provider: 'v8',
      include: ['src/lib/**', 'src/components/**', 'src/app/page.tsx'],
      exclude: [
        'src/__tests__/**',
        'src/setupTests.ts',
        '**/*.module.css',
        '**/*.css',
        'src/app/layout.tsx',
        'src/app/favicon.ico',
        'src/app/api/**'
      ],
      thresholds: {
        statements: 85,
        branches: 75,
        functions: 90,
        lines: 85
      }
    }
  },
});
