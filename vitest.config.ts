import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/setupTests.ts'],
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    coverage: {
      provider: 'v8',
      include: ['src/lib/**', 'src/components/**', 'src/app/**'],
      exclude: [
        'src/__tests__/**',
        'src/setupTests.ts',
        '**/*.module.css',
        '**/*.css',
        'src/app/layout.tsx', // Next.jsのメタデータのみのファイル等
        'src/app/favicon.ico'
      ],
      thresholds: {
        statements: 95,
        branches: 95,
        functions: 95,
        lines: 95
      }
    }
  },
});
