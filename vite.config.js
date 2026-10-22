import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig(({ mode }) => ({
  // Relative asset URLs: the game is served from the GitHub Pages project
  // subpath (/tilt-maze/) and from proxied dev paths, so an absolute base
  // would break one of them.
  base: './',
  // Self-signed HTTPS only for `npm run dev:lan`: phones need a secure
  // context for motion sensors, while localhost already is one.
  plugins: mode === 'lan' ? [basicSsl()] : [],
  server: { port: 5188, strictPort: true },
  preview: { port: 4188, strictPort: true },
  build: { target: 'es2022', chunkSizeWarningLimit: 5000 },
}));
