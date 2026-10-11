import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const web = fileURLToPath(new URL('./apps/web/src', import.meta.url));
const desktop = fileURLToPath(new URL('./apps/desktop/src', import.meta.url));

// Only authored source. Staged bundles, Graphify copies and documentation have
// their own checks and must never be discovered as duplicate application tests.
export default defineConfig({
  test: {
    maxWorkers: 2,
    projects: [
      './apps/desktop/vitest.config.ts',
      {
        resolve: { alias: { '@': web, '@desktop': desktop } },
        test: { name: 'source', include: ['packages/**/*.test.ts', 'apps/web/src/**/*.test.ts'] },
      },
    ],
  },
});
