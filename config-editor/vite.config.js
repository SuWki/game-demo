import { defineConfig } from 'vite';

export default defineConfig({
  base: '/auto-shooter-demo/config-editor/',
  server: {
    port: 3000,
  },
  build: {
    outDir: 'dist',
  },
});
