/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// The `diffusion` (and `dapi` alias) commands on Windows. Squirrel installs
// every version into its own `app-<version>` folder, so nothing durable may
// point at the wrapper the app ships in its resources. What goes on PATH
// (and, for `dapi.cmd`, into the agents' MCP configs) is a pair of shims in a
// folder that never moves:
//   <SYKA_RUNTIME_ROOT>\bin\dapi-syka.cmd
//   <SYKA_RUNTIME_ROOT>\bin\syka.cmd
// The app rewrites both on every packaged launch and from Squirrel's update
// hook, so they always name the current executable. Installing the CLI is
// then only a matter of putting that folder on the user's PATH, which needs
// no administrator.
//
// Nothing here imports electron, so the Squirrel hooks can use it before the
// app is ready and the tests can run it anywhere.

import { execFile } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { win32 } from "node:path";

import { writeFileAtomic } from "./atomic";

/** The folder that holds the shim: the one entry we add to PATH. */
export function shimDir(env: NodeJS.ProcessEnv = process.env): string {
  const runtime = env.SYKA_RUNTIME_ROOT || win32.join(win32.dirname(process.execPath), ".runtime", "diffusion");
  return win32.join(runtime, "bin");
}

export function shimPath(env: NodeJS.ProcessEnv = process.env): string {
  return win32.join(shimDir(env), "dapi-syka.cmd");
}

// `dapi.cmd` is the one `mcp-install.ts` registers with agents, so its name
// and behavior above stay fixed. `diffusion.cmd` rides beside it purely so
// the name on PATH matches the one in the docs; both run the same script.
export function shimPaths(env: NodeJS.ProcessEnv = process.env): string[] {
  return ["dapi-syka.cmd", "syka.cmd"].map((name) => win32.join(shimDir(env), name));
}

/** `dapi.js` as the packaged app stages it, next to `execPath`'s resources. */
export function stagedScript(execPath: string): string {
  return win32.join(win32.dirname(execPath), "resources", "cli", "dapi.js");
}

// A literal `%` would start a variable expansion inside a batch file.
const batch = (path: string): string => path.replaceAll("%", "%%");

/**
 * The shim's text: the CLI bundle on the app's own Electron binary in Node
 * mode, like the macOS wrapper, but with both paths spelled out because the
 * shim does not live beside them.
 */
export function shimContent(execPath: string, script: string = stagedScript(execPath)): string {
  return [
    "@echo off",
    "setlocal",
    'set "ELECTRON_RUN_AS_NODE=1"',
    `"${batch(execPath)}" "${batch(script)}" %*`,
    "",
  ].join("\r\n");
}

/** Points the shim at `execPath`. Safe to repeat; the write lands whole. */
export async function writeShim(execPath: string = process.execPath, script?: string): Promise<void> {
  await mkdir(shimDir(), { recursive: true });
  const content = shimContent(execPath, script);
  await Promise.all(shimPaths().map((path) => writeFileAtomic(path, content)));
}

export async function removeShim(): Promise<void> {
  await rm(shimDir(), { recursive: true, force: true });
}

// PATH entries compare without case and without a trailing separator.
const normalize = (entry: string): string => entry.trim().replace(/[\\/]+$/, "").toLowerCase();

const entries = (path: string): string[] => path.split(";").filter((entry) => entry.trim() !== "");

export function pathHas(path: string, dir: string): boolean {
  return entries(path).some((entry) => normalize(entry) === normalize(dir));
}

/** `path` with `dir` appended, or unchanged when it is already there. */
export function pathWith(path: string, dir: string): string {
  return pathHas(path, dir) ? path : [...entries(path), dir].join(";");
}

/** `path` without any spelling of `dir`. */
export function pathWithout(path: string, dir: string): string {
  return entries(path)
    .filter((entry) => normalize(entry) !== normalize(dir))
    .join(";");
}

// The user PATH lives in HKCU\Environment. It is read and written through the
// registry rather than [Environment]::Get/SetEnvironmentVariable, which would
// expand every %VARIABLE% in the entries that are already there and store the
// result as a plain string. `setx` is out too: it truncates at 1024
// characters. Removing a variable that does not exist is the cheap way to
// make .NET broadcast WM_SETTINGCHANGE, so new terminals see the change.
// The value travels through the environment so nothing needs quoting.
const READ_PATH = `
$key = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey('Environment')
[Console]::Out.Write($key.GetValue('Path', '', 'DoNotExpandEnvironmentNames'))
`;

const WRITE_PATH = `
$key = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey('Environment', $true)
$kind = if ($key.GetValueNames() -contains 'Path') { $key.GetValueKind('Path') } else { 'ExpandString' }
$value = if ($env:DAPI_USER_PATH) { $env:DAPI_USER_PATH } else { '' }
$key.SetValue('Path', $value, $kind)
[Environment]::SetEnvironmentVariable('DAPI_PATH_BROADCAST', $null, 'User')
`;

function powershell(script: string, env: NodeJS.ProcessEnv = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script],
      { env: { ...process.env, ...env }, windowsHide: true },
      (err, stdout) => (err ? reject(err) : resolve(stdout)),
    );
  });
}

export const readUserPath = (): Promise<string> => powershell(READ_PATH);

export async function writeUserPath(path: string): Promise<void> {
  await powershell(WRITE_PATH, { DAPI_USER_PATH: path });
}

/** Whether the shim folder is on the user's PATH. */
export async function shimOnPath(): Promise<boolean> {
  return pathHas(await readUserPath(), shimDir());
}

export async function addShimToPath(): Promise<void> {
  const path = await readUserPath();
  const next = pathWith(path, shimDir());
  if (next !== path) await writeUserPath(next);
}

export async function removeShimFromPath(): Promise<void> {
  const path = await readUserPath();
  const next = pathWithout(path, shimDir());
  if (next !== path) await writeUserPath(next);
}
