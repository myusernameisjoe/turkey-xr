import { defineConfig } from 'vite';

export default defineConfig({
  // Relative paths so the build works under https://<user>.github.io/turkey-xr/
  base: './',
  // The emulator UI (only loaded with ?emulate) is large; that's expected.
  build: { target: 'es2022', chunkSizeWarningLimit: 4000 },
  server: { host: true },
  test: { include: ['tests/**/*.test.js'] },
});
