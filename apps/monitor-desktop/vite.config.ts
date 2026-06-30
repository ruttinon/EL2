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
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Heavy 3D / physics libraries → lazy vendor chunks
          if (id.includes('@splinetool') || id.includes('react-spline')) {
            return 'vendor-spline';
          }
          if (id.includes('@dimforge') || id.includes('rapier') || id.includes('physics')) {
            return 'vendor-physics';
          }
          if (id.includes('three') || id.includes('@react-three')) {
            return 'vendor-three';
          }
          if (id.includes('navmesh') || id.includes('gaussian-splat')) {
            return 'vendor-3d-misc';
          }
          // Howler (audio) → separate chunk
          if (id.includes('howler')) {
            return 'vendor-howler';
          }
          // Core React/UI vendor chunk
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/scheduler')) {
            return 'vendor-react';
          }
          // opentype → separate chunk
          if (id.includes('opentype')) {
            return 'vendor-opentype';
          }
        },
      },
    },
  },
});
