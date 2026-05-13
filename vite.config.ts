/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  // App vive em colopediatria.com.br/ritmo · raiz fica livre pro site
  // do consultório (Colo Pediatria) que vai ser montado depois.
  base: '/ritmo/',
  // Expõe VERCEL_GIT_COMMIT_SHA pro client (usado como release no Sentry).
  envPrefix: ['VITE_', 'VERCEL_'],
  build: {
    outDir: 'dist/ritmo',
    emptyOutDir: true,
    // Source maps públicos · Sentry consegue desminificar stack traces
    // sem precisar de auth token. App não tem segredos no client.
    sourcemap: true,
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
