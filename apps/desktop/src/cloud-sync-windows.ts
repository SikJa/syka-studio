/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Where the sync services keep their folders on Windows. macOS marks a synced
// folder with a File Provider attribute that can simply be asked for; Windows
// has nothing like it, so each service is found the way it announces itself:
// OneDrive through its environment variables, Dropbox through the info.json
// it writes for exactly this purpose, Google Drive through the streaming
// drive it mounts, iCloud through its fixed folder.

import { access, readFile } from "node:fs/promises";
import { win32 } from "node:path";

/** A folder a service syncs, and the service's name as the warning spells it. */
export type SyncRoot = [dir: string, label: string];

const exists = (path: string): Promise<boolean> => access(path).then(() => true, () => false);

/** Whether `path` is `root` or inside it, the way Windows compares paths: without case. */
export function isUnder(path: string, root: string): boolean {
  const child = win32.resolve(path).toLowerCase();
  const parent = win32.resolve(root).toLowerCase().replace(/\\+$/, "");
  return child === parent || child.startsWith(parent + "\\");
}

/** The folders named in Dropbox's info.json: one per linked account, personal and business. */
export function dropboxRoots(infoJson: string): string[] {
  try {
    const info: unknown = JSON.parse(infoJson);
    if (typeof info !== "object" || info === null) return [];
    return Object.values(info)
      .map((account) => (account as { path?: unknown } | null)?.path)
      .filter((path): path is string => typeof path === "string" && path !== "");
  } catch {
    return [];
  }
}

/** Every sync root that can be named without looking at the path in question. */
export async function windowsSyncRoots(home: string, env: NodeJS.ProcessEnv = process.env): Promise<SyncRoot[]> {
  const roots: SyncRoot[] = [[win32.join(home, "iCloudDrive"), "iCloud Drive"]];

  for (const key of ["OneDrive", "OneDriveConsumer", "OneDriveCommercial"]) {
    const dir = env[key];
    if (dir) roots.push([dir, "OneDrive"]);
  }

  const dropbox: string[] = [];
  for (const base of [env.LOCALAPPDATA, env.APPDATA]) {
    if (!base) continue;
    const text = await readFile(win32.join(base, "Dropbox", "info.json"), "utf8").catch(() => null);
    if (text) dropbox.push(...dropboxRoots(text));
  }
  // No info.json (an old or half-installed client): the default location.
  if (dropbox.length === 0) dropbox.push(win32.join(home, "Dropbox"));
  for (const dir of dropbox) roots.push([dir, "Dropbox"]);

  // Google Drive in mirror mode keeps a real folder, by default in the home.
  if (await driveFsInstalled(env)) {
    roots.push([win32.join(home, "My Drive"), "Google Drive"], [win32.join(home, "Google Drive"), "Google Drive"]);
  }

  return roots;
}

function driveFsInstalled(env: NodeJS.ProcessEnv): Promise<boolean> {
  return env.LOCALAPPDATA ? exists(win32.join(env.LOCALAPPDATA, "Google", "DriveFS")) : Promise.resolve(false);
}

/**
 * Whether `path` is on Google Drive's streaming drive: a drive letter of its
 * own (G: unless the user moved it) whose root holds `My Drive`. The letter is
 * only in the client's database, so the drive is recognised by that shape,
 * and only on a machine that has the client.
 */
export async function onGoogleDriveStream(path: string, env: NodeJS.ProcessEnv = process.env): Promise<boolean> {
  const root = win32.parse(win32.resolve(path)).root;
  if (!/^[a-z]:\\$/i.test(root)) return false;
  return (await driveFsInstalled(env)) && (await exists(win32.join(root, "My Drive")));
}

/** The service syncing `path` on Windows, or null. */
export async function windowsCloudSyncKind(path: string, home: string, env: NodeJS.ProcessEnv = process.env): Promise<string | null> {
  for (const [dir, label] of await windowsSyncRoots(home, env)) {
    if (isUnder(path, dir)) return label;
  }
  return (await onGoogleDriveStream(path, env)) ? "Google Drive" : null;
}
