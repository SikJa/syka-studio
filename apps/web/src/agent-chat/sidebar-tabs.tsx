/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { For } from "solid-js";

import { setSidebarTab, sidebarTab, type SidebarTab } from "./store";
import { chatFloating } from './chat-presentation';

const TABS: { id: SidebarTab; label: string }[] = [
  { id: "assets", label: "Assets" },
  { id: "chat", label: "Chat" },
];

/** "Assets  Chat" as plain text labels, the unselected one muted. The choice persists. */
export function SidebarTabs() {
  return (
    <div class="syka-sidebar-tabs relative z-30 flex items-center gap-4" style="-webkit-app-region: no-drag;" role="tablist">
      <For each={TABS}>
        {(tab) => (
          <button
            type="button"
            role="tab"
            data-tour-target={`left-tab-${tab.id}`}
            aria-selected={sidebarTab() === tab.id}
            class="text-[12px] font-450 transition-colors focus-ring rounded-sm"
            classList={{
              "text-foreground": sidebarTab() === tab.id,
              "text-muted-foreground hover:text-foreground": sidebarTab() !== tab.id,
            }}
            onClick={() => {if(tab.id==='chat'&&chatFloating()){document.querySelector<HTMLTextAreaElement>('.syka-floating-chat textarea')?.focus();return;}setSidebarTab(tab.id);}}
          >
            {tab.label}
          </button>
        )}
      </For>
    </div>
  );
}
