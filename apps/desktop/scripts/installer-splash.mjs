/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Builds syka-assets/install-loading.gif, the splash Squirrel shows while it
// installs: a rounded card with the breathing orb, the name and a shimmering
// «Instalando». The corners are transparent so the window reads as rounded.
//
// Each frame is rendered at a fixed point of the loop (no live animation), so
// the GIF is reproducible and closes without a jump: the orb and the shimmer
// share the same 2 s loop. Needs ffmpeg and a Playwright Chromium.
//
//   node apps/desktop/scripts/installer-splash.mjs [orb.gif]

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const desktop = join(dirname(fileURLToPath(import.meta.url)), '..');
const repo = join(desktop, '..', '..');
const out = join(desktop, 'syka-assets', 'install-loading.gif');
const orb = process.argv[2] ?? join(repo, '.runtime', 'installer-splash', 'orb.gif');
const work = join(repo, '.runtime', 'installer-splash', 'frames');
const font = pathToFileURL(join(repo, 'apps/web/src/assets/fonts/Inter-VariableFont_opsz,wght.ttf')).href;

const SIZE = 360, RADIUS = 24, FRAMES = 48, FPS = 24;
// Where the orb sits in the source GIF (360×360 on #111) and where it goes on the card.
const ORB = { x: 100, y: 98, w: 160, h: 160, to: { x: 100, y: 56 } };

if (!existsSync(orb)) throw Error(`No encuentro el orbe de origen: ${orb}`);
rmSync(work, { recursive: true, force: true });
mkdirSync(work, { recursive: true });

const page = (progress) => `<!doctype html><meta charset="utf-8"><style>
@font-face { font-family: Inter; src: url("${font}"); font-weight: 100 900; }
html, body { margin: 0; background: transparent; }
.card { box-sizing: border-box; width: ${SIZE}px; height: ${SIZE}px; border-radius: ${RADIUS}px;
  background: #111; box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.08);
  font-family: Inter, sans-serif; text-align: center; position: relative; }
.name { position: absolute; left: 0; right: 0; top: 240px; color: #ededed; font-size: 17px; font-weight: 500; letter-spacing: 0; }
/* transitions.dev · shimmer text, on dark: muted base, light band. */
.state { position: absolute; left: 0; right: 0; top: 268px; }
.t-shimmer { position: relative; display: inline-block; color: #6e6e6e; font-size: 13px; font-weight: 400; }
.t-shimmer::before { content: attr(data-text); position: absolute; inset: 0;
  background-image: linear-gradient(90deg, transparent 0%, transparent 40%, #f2f2f2 50%, transparent 60%, transparent 100%);
  background-size: 400% 100%; background-repeat: no-repeat;
  background-position: ${100 - progress * 100}% 0;
  -webkit-background-clip: text; background-clip: text; color: transparent; -webkit-text-fill-color: transparent; }
</style><div class="card"><div class="name">Syka Studio</div>
<div class="state"><span class="t-shimmer" data-text="Instalando">Instalando</span></div></div>`;

const browser = await chromium.launch();
const tab = await browser.newPage({ viewport: { width: SIZE, height: SIZE }, deviceScaleFactor: 1 });
for (let frame = 0; frame < FRAMES; frame++) {
  await tab.setContent(page(frame / FRAMES));
  await tab.evaluate(() => document.fonts.ready);
  await tab.screenshot({ path: join(work, `card-${String(frame).padStart(3, '0')}.png`), omitBackground: true });
}
await browser.close();

// Orb frames on top of the cards, then a palette that keeps the transparent corners.
const { x, y, w, h, to } = ORB;
const graph = [
  `[1:v]crop=${w}:${h}:${x}:${y},fps=${FPS}[orb]`,
  `[0:v][orb]overlay=${to.x}:${to.y}:shortest=1,split[a][b]`,
  `[a]palettegen=reserve_transparent=1:stats_mode=full[p]`,
  `[b][p]paletteuse=alpha_threshold=128:dither=none`,
].join(';');
execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', String(FPS), '-i', join(work, 'card-%03d.png'),
  '-ignore_loop', '1', '-i', orb, '-filter_complex', graph, '-frames:v', String(FRAMES), '-loop', '0', out], { stdio: 'inherit' });
console.log(`installer-splash: ${readdirSync(work).length} cuadros → ${out}`);
