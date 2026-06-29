import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@energylink/shared-ui': path.resolve(rootDir, '../../packages/shared-ui/src/index.ts'),
      '@energylink/shared-types': path.resolve(rootDir, '../../packages/shared-types/src/index.ts'),
      '@energylink/graphics-runtime': path.resolve(rootDir, '../../packages/graphics-runtime/src/index.ts'),
    },
  },
  server: { port: 5174 },
  build: { outDir: 'dist' },
});
