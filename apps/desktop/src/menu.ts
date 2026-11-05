/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { app, Menu } from "electron";
import type { MenuItemConstructorOptions } from "electron";

export function setupAppMenu(stepScale: (direction: -1 | 0 | 1) => void) {
  // The app submenu is a macOS convention. Elsewhere the same role menus sit
  // behind Alt (the window hides the bar) and exist for their accelerators:
  // reload, devtools, zoom, quit.
  const template: MenuItemConstructorOptions[] = []

  if (process.platform === "darwin") {
    template.push({
      label: app.name,
      submenu: [
        { role: "about" },
        { type: "separator" },
        { role: "services" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" },
      ],
    });
  }

  template.push(
    { role: "fileMenu" },
    { role: "editMenu" },
    // The View menu with its zoom going through the saved interface scale.
    { label: "View", submenu: [
      { role: "reload" },
      { role: "forceReload" },
      { role: "toggleDevTools" },
      { type: "separator" },
      { label: "Actual Size", accelerator: "CommandOrControl+0", click: () => stepScale(0) },
      { label: "Zoom In", accelerator: "CommandOrControl+Plus", click: () => stepScale(1) },
      { label: "Zoom In", accelerator: "CommandOrControl+=", visible: false, acceleratorWorksWhenHidden: true, click: () => stepScale(1) },
      { label: "Zoom Out", accelerator: "CommandOrControl+-", click: () => stepScale(-1) },
      { type: "separator" },
      { role: "togglefullscreen" },
    ] },
    { role: "windowMenu" },
  );

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
