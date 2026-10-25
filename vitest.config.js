import { defineConfig } from 'vitest/config';
import { rapierManualWasm } from './vite.config.js';

export default defineConfig({
  // Same Rapier entry as the build, so Node does not also load the package's own .wasm import.
  plugins: [rapierManualWasm()],
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.js'],
  },
});
