import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
if (process.platform !== 'win32') process.exit(0);
const desktop = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const target = resolve(desktop, '../../.runtime/screen-recorder-target');
// Embed the C runtime so another Windows machine needs no VC++ redistributable.
const env = { ...process.env, RUSTFLAGS: [process.env.RUSTFLAGS, '-C target-feature=+crt-static'].filter(Boolean).join(' ') };
execFileSync('cargo', ['build', '--release', '--locked', '--manifest-path', join(desktop, 'native/screen-recorder/Cargo.toml'), '--target-dir', target], { stdio: 'inherit', windowsHide: true, env });
mkdirSync(join(desktop, 'dist'), { recursive: true });
copyFileSync(join(target, 'release/syka-screen-recorder.exe'), join(desktop, 'dist/syka-screen-recorder.exe'));
copyFileSync(join(desktop, 'native/screen-recorder/LICENSE-Whispera'), join(desktop, 'dist/LICENSE-Whispera'));
