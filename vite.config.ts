import path from 'node:path';
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
      // prismarine-nbt requires Node's zlib at module top; the browser never
      // touches that path (see src/shims/zlib.ts), so resolve it to the stub.
      // Vitest also uses this config and only exercises zlib-free paths.
      zlib: path.resolve(__dirname, 'src/shims/zlib.ts'),
    },
  },
});
