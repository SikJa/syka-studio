/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/**
 * Which Syka this is. The daily one is the official installation, updated
 * from releases. «Pruebas» (SYKA_INSTANCE=pruebas) is a build from source
 * with its own data folder: it runs beside the daily one, groups apart in the
 * taskbar, shows a badge, and never downloads an installer (it is updated by
 * rebuilding it).
 */
export type SykaInstance = "main" | "pruebas";

export function sykaInstance(env: NodeJS.ProcessEnv = process.env): SykaInstance {
  return env.SYKA_INSTANCE === "pruebas" ? "pruebas" : "main";
}

export function instanceIdentity(instance: SykaInstance): { name: string; appId: string; title: string } {
  return instance === "pruebas"
    ? { name: "Syka Studio Pruebas", appId: "syka.studio.pruebas", title: "Syka Studio · Pruebas" }
    : { name: "Syka Studio", appId: "syka.studio.editor", title: "Syka Studio" };
}
