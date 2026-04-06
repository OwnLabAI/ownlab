import { resolve } from 'node:path';
import { defineConfig } from 'electron-vite';

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    build: {
      rollupOptions: {
        input: {
          splash: resolve(__dirname, 'src/renderer/index.html'),
        },
      },
    },
  },
});
