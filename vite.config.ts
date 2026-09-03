import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import cesium from 'vite-plugin-cesium';

// TomTom key for the traffic overlay: read from API.txt (project root,
// gitignored, format TOMTOM_API_KEY=value) and exposed as
// VITE_TOMTOM_API_KEY. This project has no other secret plumbing — .env is
// empty and nothing else reads import.meta.env — so this file is the single
// documented place keys enter the client. API.txt is never committed.
function loadLocalApiKeys(): void {
  try {
    const lines = fs.readFileSync(path.resolve(__dirname, 'API.txt'), 'utf8').split('\n');
    for (const line of lines) {
      const match = line.match(/^\s*TOMTOM_API_KEY\s*=\s*(\S+)\s*$/);
      if (match && !process.env.VITE_TOMTOM_API_KEY) {
        process.env.VITE_TOMTOM_API_KEY = match[1];
      }
    }
  } catch {
    // No API.txt (e.g. fresh clone) — traffic features report themselves
    // unavailable instead of failing the build.
  }
}
loadLocalApiKeys();

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
