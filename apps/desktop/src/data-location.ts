/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/**
 * The first launch of an installed Syka asks where its data goes (chats,
 * voice models, accounts: several GB), since Squirrel's installer has no
 * screens. The answer goes to the same `launch-roots.json` the launcher uses,
 * so every later launch, a notification or the shortcut, opens that folder.
 * Nothing is asked when a folder is already known.
 */
import { existsSync, mkdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";

export type DataChoiceDialog = {
  ask(defaultFolder: string): Promise<"default" | "choose" | "cancel">;
  pick(): Promise<string | null>;
};

/** Whether this launch should ask: an installed first run, with no folder chosen before or given by a launcher. */
export function shouldAskForData(options: { packaged: boolean; firstRun: boolean; pointer: string; envRoot?: string }): boolean {
  return options.packaged && options.firstRun && !options.envRoot && !existsSync(options.pointer);
}

/** Asks and remembers. Returns the folder to relaunch with, or null to stay in the default one. */
export async function chooseDataFolder(options: { pointer: string; defaultFolder: string; dialog: DataChoiceDialog }): Promise<string | null> {
  const answer = await options.dialog.ask(options.defaultFolder);
  let folder: string | null = null;
  if (answer === "choose") {
    const picked = await options.dialog.pick();
    if (picked && isAbsolute(picked)) folder = join(picked, "Syka Studio");
  }
  // The default is remembered too, so the question is never asked again.
  const runtimeRoot = folder ?? options.defaultFolder;
  mkdirSync(runtimeRoot, { recursive: true });
  mkdirSync(dirname(options.pointer), { recursive: true });
  const temporary = `${options.pointer}.${process.pid}.tmp`;
  writeFileSync(temporary, JSON.stringify({ runtimeRoot }, null, 2));
  renameSync(temporary, options.pointer);
  return folder;
}
