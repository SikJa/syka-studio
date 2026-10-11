import { defineConfig, mergeConfig } from 'vite';
import { resolve } from 'node:path';
import editorConfig from './vite.config';

// Keep the running development server's config unchanged. Both pages ship in builds.
export default defineConfig(env => mergeConfig(editorConfig(env), {
  build: { rollupOptions: { input: {
    preview: resolve(__dirname, 'preview-worker.html'),
  } } },
}));
