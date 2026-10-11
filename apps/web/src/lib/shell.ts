/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Renderer-side wrappers for OS shell actions, which only the desktop main
// process can perform. Off the desktop build there is no shell to talk to, so
// these are no-ops rather than errors.

import { MAIN_CHANNELS } from "@desktop/main-channels";
import { mainBridge } from "@/lib/ipc";

/**
 * Reveals a file or folder in the OS file manager — Finder on macOS, Explorer
 * on Windows — selecting it inside its parent folder.
 */
export async function revealPath(path: string): Promise<void> {
  if (!window.desktop || !path) return;
  await mainBridge.call(MAIN_CHANNELS.APP_SHOW_IN_FOLDER, { path });
}
