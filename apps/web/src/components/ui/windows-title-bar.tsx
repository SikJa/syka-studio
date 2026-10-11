/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { Show, type JSX } from "solid-js";

import { cx } from "@/lib/cva";
import { isWindowsDesktop } from "@/projects";

type WindowsTitleBarProps = {
  /** Width of the left cell, so its border continues the sidebar divider below. */
  leftWidth: number;
  /** Width of the cell the native window controls sit in. */
  controlsWidth: number;
  left: JSX.Element;
  /** Classes for the middle cell, which sits over the page's main column. */
  class?: string;
  children?: JSX.Element;
};

/**
 * The title bar of the Windows desktop build: a fixed row under the native
 * minimize/maximize/close overlay. The whole row drags the window, so anything
 * interactive inside it has to opt out with `-webkit-app-region: no-drag`.
 * Its bottom border runs the full width, so the first row of the left sidebar
 * drops its own top border on Windows.
 * Renders nothing on other platforms; the editor clears it with
 * `--titlebar-height`. The dashboard has no such row: its sidebar header and
 * view headers line up with the controls instead.
 */
export function WindowsTitleBar(props: WindowsTitleBarProps) {
  return (
    <Show when={isWindowsDesktop()}>
      <div
        class="fixed inset-x-0 top-0 z-20 flex h-(--titlebar-height) border-b border-border bg-sidebar"
        style="-webkit-app-region: drag;"
      >
        <div
          class="flex h-full shrink-0 items-center gap-2 border-r border-border-strong pl-3 pr-4 transition-[width] duration-200 ease-out motion-reduce:transition-none"
          style={{ width: `${props.leftWidth}px` }}
        >
          {props.left}
        </div>
        {/* Not positioned on purpose: absolute children center on the whole bar. */}
        <div class={cx("h-full min-w-0 flex-1", props.class)}>{props.children}</div>
        <div
          class="h-full min-w-(--titlebar-controls-width) shrink-0 border-l border-border-strong"
          style={{ width: `${props.controlsWidth}px` }}
        />
      </div>
    </Show>
  );
}
