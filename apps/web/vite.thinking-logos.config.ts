import {defineConfig,mergeConfig} from 'vite';
import {resolve} from 'node:path';
import editorConfig from './vite.config';

/** Build the actual app plus the logo gallery into a separate review directory. */
export default defineConfig(env=>mergeConfig(editorConfig(env),{
  base:'./',
  build:{outDir:'../../output/thinking-logos/build',emptyOutDir:false,rollupOptions:{input:{
    thinkingLogos:resolve(__dirname,'thinking-logos.html'),
  }}},
}));
