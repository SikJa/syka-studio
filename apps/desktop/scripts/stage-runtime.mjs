/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Stages the main process's external dependencies into apps/desktop/runtime
// so electron-forge can ship them as an app resource (Contents/Resources/
// runtime). A packaged app has no node_modules of its own: everything else
// is bundled into dist/main.js, but esbuild (native binary) and the babel
// toolchain stay external and are loaded from here at run time (see `load`
// in src/projects.ts). The staged layout:
//   runtime/package.json   the externals, pinned to the workspace's versions
//   runtime/node_modules   a fresh `npm install --omit=dev` of them
//
// The list of externals is read from both host build scripts so it cannot
// drift from what the bundle actually leaves unresolved.

import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, openSync, readdirSync, readFileSync, readSync, closeSync, rmSync, writeFileSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { npm } from "../../../scripts/lib/npm.mjs";
import { assertStagingDirectory } from "../../../scripts/lib/staging-path.mjs";
import { windowsTools } from '../../../scripts/lib/toolchain.mjs';

const desktopDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const stageDir = join(desktopDir, "runtime");
assertStagingDirectory(desktopDir, stageDir, 'runtime');
const require = createRequire(join(desktopDir, "package.json"));

const pkg = JSON.parse(readFileSync(join(desktopDir, "package.json"), "utf8"));
const externals = [...new Set(["build:main", "build:agent-host"].flatMap((script) =>
  [...pkg.scripts[script].matchAll(/--external:(\S+)/g)].map((match) => match[1]),
))]
  // Electron is provided by the host binary, not installed.
  .filter((name) => name !== "electron");

// Pin what the workspace has installed (and was tested against), not the
// ranges in package.json.
const dependencies = Object.fromEntries(
  externals.map((name) => [name, require(`${name}/package.json`).version]),
);
// The recorte worker runs out of process, so these are explicit runtime
// dependencies rather than esbuild externals. Native binaries match the build OS.
dependencies.hyperframes = '0.8.140';
dependencies['onnxruntime-node'] = '1.21.1';
const lockPath = join(desktopDir, 'scripts', `runtime-lock.${process.platform}-${process.arch}.json`);
const useLock = existsSync(lockPath) && !process.argv.includes('--update-lock');
const canonical = value => JSON.stringify(Object.fromEntries(Object.entries(value ?? {}).sort(([a], [b]) => a.localeCompare(b))));
if (useLock && canonical(JSON.parse(readFileSync(lockPath, 'utf8')).packages?.['']?.dependencies) !== canonical(dependencies)) {
  throw Error('Runtime dependencies changed. Run stage-runtime.mjs --update-lock and review the lockfile before releasing.');
}

// Check inputs before replacing a previous usable stage. Media tools are
// verified upstream downloads on first launch; the native recorder is bundled.
if (process.platform === 'win32') {
  for (const name of ['syka-screen-recorder.exe', 'LICENSE-Whispera']) {
    if (!existsSync(join(desktopDir, 'dist', name))) throw Error(`stage-runtime: missing dist/${name}. Run build:native first. The previous stage was preserved.`);
  }
}

rmSync(stageDir, { recursive: true, force: true });
mkdirSync(stageDir, { recursive: true });

writeFileSync(
  join(stageDir, "package.json"),
  JSON.stringify({ name: "desktop-runtime", private: true, dependencies }, null, 2),
);

if (useLock) {
  copyFileSync(lockPath, join(stageDir, 'package-lock.json'));
  npm(['ci', '--omit=dev', '--no-audit', '--no-fund'], { cwd: stageDir });
} else {
  npm(['install', '--omit=dev', '--no-audit', '--no-fund'], { cwd: stageDir });
  copyFileSync(join(stageDir, 'package-lock.json'), lockPath);
}
copyFileSync(join(desktopDir, '../../scripts/background-removal-runner.mjs'), join(stageDir, 'background-removal-runner.mjs'));

// The Windows recorder is standalone: consumers need neither Rust nor Whispera.
if (process.platform === 'win32') {
  const bin = join(stageDir, 'bin'); mkdirSync(bin, { recursive: true });
  for (const name of ['syka-screen-recorder.exe', 'LICENSE-Whispera']) copyFileSync(join(desktopDir, 'dist', name), join(bin, name));
  writeFileSync(join(stageDir, 'toolchain.json'), JSON.stringify({ platform: 'win32', arch: 'x64', mode: 'verified-upstream-download', tools: windowsTools }, null, 2));
  writeFileSync(join(bin, 'TOOLS-NOTICE.txt'), 'Node.js, FFmpeg/FFprobe and yt-dlp are configured automatically when missing. Downloads go directly from upstream to the user device. Versions, SHA256 checksums, URLs and licenses are recorded in ../toolchain.json and in each managed tool receipt. Syka does not bundle FFmpeg or yt-dlp binaries in this installer. Internet is required for initial tool setup. See https://ffmpeg.org/legal.html and https://github.com/yt-dlp/yt-dlp#licensing.\n');
}

// Mach-O files inside Resources are not reached by the app-bundle signing
// pass, and notarization rejects unsigned executables; sign them here.
// esbuild's postinstall hard-links the native binary over its bin/esbuild
// shim, so the same executable can sit in two places.
const MACHO_MAGIC = new Set([0xfeedface, 0xfeedfacf, 0xcefaedfe, 0xcffaedfe, 0xcafebabe]);
function isMachO(path) {
  const fd = openSync(path, "r");
  try {
    const header = Buffer.alloc(4);
    return readSync(fd, header, 0, 4, 0) === 4 && MACHO_MAGIC.has(header.readUInt32BE(0));
  } finally {
    closeSync(fd);
  }
}

const esbuildDir = join(stageDir, "node_modules", "@esbuild");
const binaries = [
  join(stageDir, "node_modules", "esbuild", "bin", "esbuild"),
  ...(existsSync(esbuildDir) ? readdirSync(esbuildDir).map((name) => join(esbuildDir, name, "bin", "esbuild")) : []),
].filter((path) => existsSync(path) && isMachO(path));

if (process.platform === "darwin" && !process.env.SKIP_SIGN) {
  const identities = execFileSync("security", ["find-identity", "-v", "-p", "codesigning"], { encoding: "utf8" });
  const identity = identities.match(/"(Developer ID Application: [^"]+)"/)?.[1];
  if (identity) {
    for (const bin of binaries) {
      execFileSync("codesign", ["--force", "--options", "runtime", "--timestamp", "--sign", identity, bin], {
        stdio: "inherit",
      });
    }
  } else {
    console.warn("stage-runtime: no Developer ID identity found, leaving esbuild binaries unsigned");
  }
}

console.log(`stage-runtime: staged ${externals.join(", ")} at ${stageDir}`);
