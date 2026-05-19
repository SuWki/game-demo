import { defineConfig } from 'vite';

export default defineConfig({
  base: '/game-demo/',
  server: {
    host: '0.0.0.0',
    port: 5174,
  },
});
