import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    chunkSizeWarningLimit: 2400,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('@dimforge/rapier3d')) return 'physics';
          if (id.includes('node_modules/three')) return 'three';
        }
      }
    }
  }
});
