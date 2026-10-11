/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Stages the dapi CLI into apps/desktop/cli so electron-forge can ship it as
// an app resource (Contents/Resources/cli). The staged layout:
//   cli/dapi.js        bundled CLI (built by apps/cli), self-contained
//   cli/bin/dapi       macOS shell wrapper: what Claude Desktop runs as
//                      `dapi mcp` (registered by mcp-install.ts) and the file
//                      that gets linked into PATH
//   cli/bin/dapi.cmd   Windows wrapper, relative to the install folder. PATH
//                      and the agents get a shim outside the install folder
//                      instead (src/cli-windows.ts), since Squirrel moves the
//                      app on every update; this one is for running the CLI
//                      straight out of an install.
// Each host stages its own wrapper; `--all` stages both, so a macOS host can
// produce a Windows tree for inspection.

import { chmodSync, cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assertStagingDirectory } from "../../../scripts/lib/staging-path.mjs";

const desktopDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const cliDir = join(desktopDir, "..", "cli");
const stageDir = resolve(desktopDir, 'cli');
assertStagingDirectory(desktopDir, stageDir, 'cli');
const sourceBundle = join(cliDir, 'dist', 'index.js');
if (!existsSync(sourceBundle)) throw Error('stage-cli: build apps/cli first. The previous stage was preserved.');

rmSync(stageDir, { recursive: true, force: true });
mkdirSync(join(stageDir, "bin"), { recursive: true });

cpSync(sourceBundle, join(stageDir, "dapi.js"));

// The wrapper runs the CLI bundle on the app's own Electron binary in Node
// mode, so users need no separate Node install. It resolves symlinks first
// because both Homebrew and the in-app installer link it into PATH.
const all = process.argv.includes("--all");

const wrapper = `#!/bin/sh
SELF="$0"
while [ -L "$SELF" ]; do
  LINK="$(readlink "$SELF")"
  case "$LINK" in
    /*) SELF="$LINK" ;;
    *) SELF="$(dirname "$SELF")/$LINK" ;;
  esac
done
DIR="$(cd "$(dirname "$SELF")" && pwd)"
export DIFFUSION_APP_PATH="$(cd "$DIR/../../../.." && pwd)"
ELECTRON_RUN_AS_NODE=1 exec "$DIR/../../../MacOS/Syka Studio" "$DIR/../dapi.js" "$@"
`;

if (all || process.platform !== "win32") {
  writeFileSync(join(stageDir, "bin", "dapi"), wrapper);
  chmodSync(join(stageDir, "bin", "dapi"), 0o755);
}

// Staged at <install>\resources\cli\bin, three folders below the executable.
const cmdWrapper = [
  "@echo off",
  "setlocal",
  'set "ELECTRON_RUN_AS_NODE=1"',
  '"%~dp0..\\..\\..\\Syka Studio.exe" "%~dp0..\\dapi.js" %*',
  "",
].join("\r\n");

if (all || process.platform === "win32") {
  writeFileSync(join(stageDir, "bin", "dapi.cmd"), cmdWrapper);
}

console.log(`stage-cli: staged dapi at ${stageDir}`);
