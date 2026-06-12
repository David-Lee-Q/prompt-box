import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  publicDir: false,
  build: {
    outDir: 'dist-ext',
    emptyOutDir: false,  // don't wipe extension files
    rollupOptions: {
      input: {
        'content-scripts/insert': path.resolve(__dirname, 'content-scripts/insert.ts'),
      },
      output: {
        format: 'iife',
        entryFileNames: '[name].js',
      },
      external: [/^node:/],
    },
    minify: true,
  },
});
