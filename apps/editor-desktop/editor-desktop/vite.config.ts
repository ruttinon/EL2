import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: '@energylink/unified-viewport/src/unified-viewport.css',
        replacement: path.resolve(rootDir, '../../../packages/unified-viewport/src/unified-viewport.css'),
      },
      {
        find: '@energylink/unified-viewport',
        replacement: path.resolve(rootDir, '../../../packages/unified-viewport/src/index.ts'),
      },
      {
        find: '@energylink/shared-ui',
        replacement: path.resolve(rootDir, '../../../packages/shared-ui/src/index.ts'),
      },
      {
        find: '@energylink/shared-types',
        replacement: path.resolve(rootDir, '../../../packages/shared-types/src/index.ts'),
      },
      {
        find: '@energylink/graphics-runtime',
        replacement: path.resolve(rootDir, '../../../packages/graphics-runtime/src/index.ts'),
      },
    ],
  },
  server: { port: 5173 },
  build: { outDir: 'dist' }
});
