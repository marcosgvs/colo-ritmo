/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  // App vive em colopediatria.com.br/ritmo · raiz fica livre pro site
  // do consultório (Colo Pediatria) que vai ser montado depois.
  base: '/ritmo/',
  build: {
    outDir: 'dist/ritmo',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts', 'src/**/*.{test,spec}.tsx'],
    exclude: ['**/._*', '**/node_modules/**'],
    globals: false,
    coverage: {
      reporter: ['text', 'html'],
    },
  },
});
