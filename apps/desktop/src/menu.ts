/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { app, Menu } from "electron";
import type { MenuItemConstructorOptions } from "electron";

export function setupAppMenu() {
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
    { role: "viewMenu" },
    { role: "windowMenu" },
  );

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
