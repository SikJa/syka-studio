/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { Assets } from "./assets";
import { ChatPanel, sidebarTab } from "@/agent-chat";
import { useLayout } from "@/context/layout";
import { useEditorApi } from "@/dapi";
import { createSignal, Show } from "solid-js";
import { Portal } from 'solid-js/web';
import { fullscreenChatMount, floatingChatMount, chatFloating } from '@/agent-chat/chat-presentation';
import { FloatingChat } from '@/agent-chat/floating-chat';
import { toast } from "somoto";
import { Button } from "../ui/button";
import { Icon } from "../ui/icon";
import { ProjectMenu } from "./project-menu";
import { useProject } from "@/context/project";
import { cx } from "@/lib/cva";
import { isWindowsDesktop } from "@/projects";
import { WindowsTitleBar } from "../ui/windows-title-bar";
import { EditorExportButton } from './editor-export-button';
import { EditorShortcuts } from '../canvas/editor-shortcuts';

export function SidebarLeft() {
  let chatMount!: HTMLDivElement;
  return (
    <div class="flex flex-col h-full overflow-hidden">
      {/* On Windows the title bar carries the menu, the toggles and the name. */}
      <Show when={!isWindowsDesktop()}>
        <ElectronHeader />
        <ProjectHeader />
      </Show>
      <div classList={{ contents: sidebarTab() === "assets" || chatFloating(), hidden: sidebarTab() === "chat" && !chatFloating() }}>
        <Assets />
      </div>
      <div ref={chatMount} class="flex min-h-0 flex-1 flex-col" classList={{hidden: sidebarTab() !== 'chat'}} />
      <FloatingChat/>
      <Show when={sidebarTab() === "chat" || chatFloating() || fullscreenChatMount()}>
        <Portal mount={fullscreenChatMount() ?? (chatFloating()?floatingChatMount():null) ?? chatMount} ref={node => { node.style.display = 'contents'; }}><ChatPanel /></Portal>
      </Show>
    </div>
  );
}

function LayoutToggles() {
  const { toggleTimeline, toggleUI } = useLayout();

  return (
    <div class="flex items-center gap-1 relative z-30" style="-webkit-app-region: no-drag;">
      <Button variant="ghost" size="icon" class="text-muted-foreground" onClick={toggleTimeline}>
        <Icon name="sidebar-timeline" />
      </Button>
      <Button variant="ghost" size="icon" class="text-muted-foreground" onClick={toggleUI}>
        <Icon name="sidebar" />
      </Button>
    </div>
  )
}

export function ElectronHeader() {
  const { isDesktop, isFullscreen } = useEditorApi();

  return (
    <Show when={isDesktop}>
      <div class="h-10 border-b border-border shrink-0 pr-4 pl-1.5 gap-1 relative flex items-center">
        <div class="flex-1 h-full data-[fullscreen=true]:flex-none transition-all duration-100 ease-out" data-fullscreen={isFullscreen()} />
        <LayoutToggles />
      </div>
    </Show>
  )
}

type EditorTitleBarProps = {
  leftWidth: number;
  controlsWidth: number;
}

/** The editor's Windows title bar: project menu and layout toggles, the project name centered. */
export function EditorTitleBar(props: EditorTitleBarProps) {
  return (
    <>
    <WindowsTitleBar
      leftWidth={props.leftWidth}
      controlsWidth={props.controlsWidth}
      class="bg-background"
      left={
        <>
          <div class="flex shrink-0 items-center" style="-webkit-app-region: no-drag;">
            <ProjectMenu />
          </div>
          <span class="min-w-0 flex-1 truncate text-xs text-muted-foreground font-450">Syka Studio</span>
          <LayoutToggles />
        </>
      }
    >
      <div class="syka-editor-header-content">
        <div class="syka-editor-header-name"><ProjectNameInput class="ml-0 w-auto min-w-8 max-w-full field-sizing-content text-center" /></div>
        <EditorShortcuts />
        <EditorExportButton />
      </div>
    </WindowsTitleBar>
    <Show when={!isWindowsDesktop()}><div class="syka-editor-export-platform flex items-center gap-1"><EditorShortcuts /><EditorExportButton /></div></Show>
    </>
  )
}

type ProjectNameInputProps = {
  class?: string;
}

/** The project name, renamed in place: Enter commits, Escape or blur reverts. */
function ProjectNameInput(props: ProjectNameInputProps) {
  const project = useProject();
  const [projectNameDraft, setProjectNameDraft] = createSignal<string | null>(null);

  const handleProjectNameInput = (event: InputEvent & { currentTarget: HTMLInputElement }) => {
    setProjectNameDraft(event.currentTarget.value);
  };

  const handleFocusNameInput = (event: FocusEvent & { currentTarget: HTMLInputElement }) => {
    setProjectNameDraft(project.name());
    event.currentTarget.select();
  };

  const handleBlurNameInput = () => {
    setProjectNameDraft(null);
  };

  const handleKeyDownNameInput = async (event: KeyboardEvent & { currentTarget: HTMLInputElement }) => {
    if (event.key === "Enter") {
      const input = event.currentTarget;
      const trimmedName = projectNameDraft()?.trim() ?? "";

      // The rename the folder follows: the project keeps its id, so the URL
      // and the open editor are untouched by the move.
      if (trimmedName.length > 0 && trimmedName !== project.name()) {
        try {
          await project.rename(trimmedName);
        } catch (e) {
          toast.error("Failed to rename project", { description: (e as Error).message });
        }
      }

      setProjectNameDraft(null);
      input.blur();
    }

    if (event.key === "Escape") {
      event.currentTarget.blur();
      setProjectNameDraft(null);
    }
  };

  return (
    <input
      type="text"
      value={projectNameDraft() ?? project.name()}
      onInput={handleProjectNameInput}
      onFocus={handleFocusNameInput}
      onBlur={handleBlurNameInput}
      onKeyDown={handleKeyDownNameInput}
      placeholder="Project name"
      class={cx("w-full bg-transparent focus-ring px-1 h-5 ml-1 rounded text-xs text-muted-foreground font-450 outline-none", props.class)}
    />
  )
}

type ProjectHeaderProps = {
  class?: string;
}

export function ProjectHeader(props: ProjectHeaderProps) {
  return (
    <div class={cx("h-12 shrink-0 flex items-center gap-1 pr-4 pl-2.5", props.class)}>
      <ProjectMenu />
      <div class="flex items-center w-full">
        <ProjectNameInput />
      </div>
    </div>
  )
}

export function FloatingProjectHeader() {
  const { isDesktop } = useEditorApi();
  const { toggleUI } = useLayout();

  return (
    <div data-desktop={isDesktop} class="h-10 rounded-lg border border-border shrink-0 flex items-center px-2 gap-1 fixed top-4 data-[desktop=true]:top-10 left-4 z-30 bg-background shadow-lg">
      <ProjectMenu />
      <span class="text-xs text-muted-foreground font-450">Syka Studio</span>
      <Button variant="ghost" size="icon" class="text-muted-foreground ml-2" onClick={toggleUI}>
        <Icon name="sidebar" />
      </Button>
    </div>
  )
}
