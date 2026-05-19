import { defineConfig } from 'vite';

export default defineConfig({
  base: '/game-demo/config-editor/',
  server: {
    port: 3000,
  },
  build: {
    outDir: 'dist',
  },
});
