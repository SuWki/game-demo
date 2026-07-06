import { defineConfig } from 'vite';

export default defineConfig({
  base: '/game-demo/',
  server: {
    host: '0.0.0.0',
    port: 4187,
  },
  build: {
    chunkSizeWarningLimit: 600,
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/phaser')) {
            return 'phaser';
          }
        },
      },
    },
  },
});
