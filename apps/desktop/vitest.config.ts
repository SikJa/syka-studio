/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  root: __dirname,
  resolve: { alias: { "@": resolve(__dirname, "../web/src"), "@desktop": resolve(__dirname, "src") } },
  test: { name: 'desktop', include: ['src/**/*.test.ts', 'test/**/*.test.ts'], maxWorkers: 2 },
  // Renderer import regression tests use the same aliases as the web app.
});
