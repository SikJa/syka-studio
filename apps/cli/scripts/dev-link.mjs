/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Puts `diffusion` (and a `dapi` alias) on the PATH, running this workspace's
// build, for developing against the CLI. `npm run dev:desktop` rebuilds the
// CLI on every start, so the link keeps running the latest code. `dapi` is
// where a dev build of the desktop app looks for the binary it registers
// with agents and reports in the settings CLI card (apps/desktop/src/cli-install.ts
// and mcp-install.ts), so that name and path are load-bearing; `diffusion` is
// added alongside it purely for typing at a shell.
//
//   macOS    symlinks in Homebrew's bin, `/opt/homebrew/bin/{dapi,diffusion}`,
//            which is user-writable, so no admin prompt. The packaged app uses
//            `/usr/local/bin` instead and the two never collide.
//   Windows  `%LOCALAPPDATA%\DiffusionStudio\bin\{dapi,diffusion}.cmd`, the same
//            file the packaged app keeps its own shim in (apps/desktop/src/cli-windows.ts).
//            A packaged app rewrites the `dapi` one on launch, so run this again
//            after using one. The folder is added to the user PATH the way the
//            packaged app's "Install CLI" does it; `--remove` leaves that
//            entry, since a packaged install may still use it.
//
//   node scripts/dev-link.mjs            create the link
//   node scripts/dev-link.mjs --remove   delete it

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, win32 } from "node:path";
import { fileURLToPath } from "node:url";

const script = join(dirname(fileURLToPath(import.meta.url)), "..", "dist", "index.js");
const remove = process.argv.includes("--remove");

const NAMES = ["dapi", "diffusion"];

if (process.platform === "win32") {
  const local = process.env.LOCALAPPDATA || join(homedir(), "AppData", "Local");
  const dir = join(local, "DiffusionStudio", "bin");
  const shims = NAMES.map((name) => join(dir, `${name}.cmd`));

  if (remove) {
    for (const shim of shims) {
      rmSync(shim, { force: true });
      console.log(`dev-link: removed ${shim}`);
    }
    process.exit(0);
  }

  const batch = (path) => path.replaceAll("%", "%%");
  mkdirSync(dir, { recursive: true });
  for (const shim of shims) {
    writeFileSync(shim, ["@echo off", "setlocal", `node "${batch(script)}" %*`, ""].join("\r\n"));
    console.log(`dev-link: ${shim} -> ${script}`);
  }

  if (addToUserPath(dir)) {
    console.log(`dev-link: added ${dir} to your PATH; open a new terminal to run \`diffusion\`.`);
  }
} else if (process.platform === "darwin") {
  const dir = "/opt/homebrew/bin";
  const links = NAMES.map((name) => join(dir, name));

  if (remove) {
    for (const link of links) {
      rmSync(link, { force: true });
      console.log(`dev-link: removed ${link}`);
    }
    process.exit(0);
  }

  if (!existsSync(dir)) {
    console.error(`dev-link: ${dir} does not exist (Homebrew is not installed, or is an Intel install); ` +
      `the dev build of the app only recognises a link there.`);
    process.exit(1);
  }

  for (const link of links) {
    rmSync(link, { force: true });
    symlinkSync(script, link);
    console.log(`dev-link: ${link} -> ${script}`);
  }
} else {
  console.error(`dev-link: no link location for ${process.platform}; put ${script} on your PATH yourself.`);
  process.exit(1);
}

// The user PATH in HKCU\Environment, edited the same way as
// apps/desktop/src/cli-windows.ts: through the registry, so the %VARIABLE%
// entries already there stay unexpanded, with a throwaway variable deletion
// to make .NET broadcast the change to new terminals. Returns whether the
// entry was added.
function addToUserPath(dir) {
  const normalize = (entry) => win32.normalize(entry).replace(/[\\/]+$/, "").toLowerCase();
  const powershell = (script, env) =>
    execFileSync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script],
      { env: { ...process.env, ...env }, windowsHide: true, encoding: "utf8" },
    );

  const current = powershell(`
$key = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey('Environment')
[Console]::Out.Write($key.GetValue('Path', '', 'DoNotExpandEnvironmentNames'))
`);
  const entries = current.split(";").filter((entry) => entry.trim() !== "");
  if (entries.some((entry) => normalize(entry) === normalize(dir))) return false;

  powershell(
    `
$key = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey('Environment', $true)
$kind = if ($key.GetValueNames() -contains 'Path') { $key.GetValueKind('Path') } else { 'ExpandString' }
$key.SetValue('Path', $env:DAPI_USER_PATH, $kind)
[Environment]::SetEnvironmentVariable('DAPI_PATH_BROADCAST', $null, 'User')
`,
    { DAPI_USER_PATH: [...entries, dir].join(";") },
  );
  return true;
}
