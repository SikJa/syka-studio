/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Builds syka-asr (native/syka-asr, Parakeet through transcribe.cpp) for this
// platform and stages it in apps/desktop/syka-asr, which Forge ships as
// Resources/syka-asr. Windows and Linux carry the loadable ggml backends
// (CPU variants + Vulkan) next to the executable; macOS links Metal in.
//
// Needs Rust and CMake, plus the Vulkan SDK on Windows/Linux (VULKAN_SDK).
// Without them it warns and skips, and the app shows Parakeet as unavailable;
// with SYKA_REQUIRE_ASR=1 (release builds) a missing toolchain fails.

import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const desktop = join(dirname(fileURLToPath(import.meta.url)), '..');
const repo = join(desktop, '..', '..');
const crate = join(repo, 'native', 'syka-asr');
// Its own target folder: CI points CARGO_TARGET_DIR at the screen recorder's.
const target = process.env.SYKA_ASR_TARGET_DIR || join(repo, '.runtime', 'syka-asr-target');
const out = join(desktop, 'syka-asr');
const required = process.env.SYKA_REQUIRE_ASR === '1';

function skip(reason) {
  if (required) { console.error(`stage-asr: ${reason}`); process.exit(1); }
  console.warn(`stage-asr: se omite Parakeet (${reason}). La app lo mostrará como no disponible.`);
  rmSync(out, { recursive: true, force: true });
  process.exit(0);
}

try { execFileSync('cargo', ['--version'], { stdio: 'ignore', windowsHide: true }); } catch { skip('falta Rust (cargo)'); }
// Windows needs the SDK's import library; Linux takes the system's (libvulkan-dev, glslc).
if (process.platform === 'win32' && !process.env.VULKAN_SDK) skip('falta el Vulkan SDK (VULKAN_SDK)');

execFileSync('cargo', ['build', '--release', '--locked', '--manifest-path', join(crate, 'Cargo.toml')], {
  stdio: 'inherit', windowsHide: true, env: { ...process.env, CARGO_TARGET_DIR: target },
});

const release = join(target, 'release');
const exe = process.platform === 'win32' ? 'syka-asr.exe' : 'syka-asr';
if (!existsSync(join(release, exe))) skip(`no se generó ${exe}`);
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(join(release, exe), join(out, exe));
// The shared runtime: transcribe + ggml and every loadable backend module.
const shared = process.platform === 'win32' ? /\.dll$/i : process.platform === 'darwin' ? /\.dylib$/i : /\.so(\.\d+)*$/i;
const libs = readdirSync(release).filter(name => shared.test(name));
for (const name of libs) cpSync(join(release, name), join(out, name));
console.log(`stage-asr: ${exe} y ${libs.length} bibliotecas en ${out}`);
