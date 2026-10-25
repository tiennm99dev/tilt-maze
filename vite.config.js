import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

/**
 * Rapier's wasm-bindgen entry imports its .wasm as an ES module, which Vite
 * compiles to a top-level await: one failed download would leave that
 * module, and every retry, errored for good. This swaps the entry for its
 * plain JS glue; src/physics/world.js fetches and links the .wasm itself.
 * The dev server keeps Rapier out of dependency pre-bundling, which skips
 * project plugins, and the filter allows its `?v=` query, so the swap
 * applies in dev as well as in the build and Vitest.
 * @returns {import('vite').Plugin}
 */
export function rapierManualWasm() {
  return {
    name: 'rapier-manual-wasm',
    enforce: 'pre',
    load: {
      filter: { id: /[\\/]@dimforge[\\/]rapier3d[\\/]rapier_wasm3d\.js(\?.*)?$/ },
      handler: () => "export * from './rapier_wasm3d_bg.js';",
    },
  };
}

export default defineConfig(({ mode }) => ({
  // Relative asset URLs: the game is served from the GitHub Pages project
  // subpath (/tilt-maze/) and from proxied dev paths, so an absolute base
  // would break one of them.
  base: './',
  // Self-signed HTTPS only for `npm run dev:lan`: phones need a secure
  // context for motion sensors, while localhost already is one.
  plugins: [rapierManualWasm(), ...(mode === 'lan' ? [basicSsl()] : [])],
  optimizeDeps: { exclude: ['@dimforge/rapier3d'] },
  server: { port: 5188, strictPort: true },
  preview: { port: 4188, strictPort: true },
  // The Three.js game chunk is the largest, at about 555 kB.
  build: { target: 'es2022', chunkSizeWarningLimit: 600 },
}));
