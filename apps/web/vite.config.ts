/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'
import solidSvg from 'vite-plugin-solid-svg'
import tailwindcss from '@tailwindcss/vite'
import typegpu from 'unplugin-typegpu/vite'
import { resolve } from 'path'
import pkg from '../../package.json'
import { uiI18nPlugin } from '../../scripts/lib/ui-i18n.mjs'

export default defineConfig(() => {
  // Syka runs locally and deliberately has no Diffusion account configuration.

  return {
    esbuild: { jsx: 'automatic' as const, jsxImportSource: 'react' },
    publicDir: './syka-public',
    build: { emptyOutDir: true, rollupOptions: { input: { index: resolve(__dirname, 'index.html'), notifications: resolve(__dirname, 'notifications.html') } } },
    plugins: [
      uiI18nPlugin(),
      solid({ exclude: /mirel-chat|boardui-react/ }),
      tailwindcss(),
      solidSvg({ defaultAsComponent: true }),
      typegpu(),
    ],
    define: {
      APP_VERSION: JSON.stringify(pkg.version),
    },
    server: {
      port: Number(process.env.SYKA_DEV_PORT || 5188),
      strictPort: true,
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'credentialless',
      },
    },
    resolve: {
      alias: {
        "@": resolve(__dirname, "./src"),
        "@desktop": resolve(__dirname, "../desktop/src"),
      }
    }
  }
})
