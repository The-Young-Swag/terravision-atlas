import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import cesium from 'vite-plugin-cesium';

// TerraVision: Atlas — Vite configuration
// - React Fast Refresh
// - CesiumJS asset handling (workers, WASM, static assets)
// - Dev server bound to 0.0.0.0:4900 for devcontainer host visibility
export default defineConfig({
  plugins: [react(), cesium()],
  server: {
    host: '0.0.0.0',
    port: 4900,
    strictPort: false,
  },
  preview: {
    host: '0.0.0.0',
    port: 4900,
  },
  build: {
    target: 'esnext',
    sourcemap: true,
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});
