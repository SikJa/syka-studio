/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { Show, batch, createSignal } from "solid-js";
import { toast } from "somoto";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuPortal,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { TextField, TextFieldInput } from "@/components/ui/text-field";
import { track } from "@/lib/analytics";
import { duplicateProject, renameProject, type ProjectRecord } from "@/projects";

import { DashboardCardButton, DashboardCardPreview, DashboardProjectThumbnail } from "./shared";
import { formatEditedAt } from "./utils";
import { ProjectTokenUsageLabel } from './project-token-usage';

type DashboardProjectCardProps = {
  project: ProjectRecord;
  /** Whether the card is the selected one in its grid. */
  active: boolean;
  /** A single click, or a right-click, landed on the card. */
  onSelect: () => void;
  /** Escape was pressed on the card. */
  onDeselect: () => void;
  /** The card was double-clicked, or Open chosen from the menu. */
  onOpen: () => void;
  /** Delete was pressed on the card, or chosen from the menu. */
  onDelete: () => void;
  /**
   * A rename or duplicate changed the projects on disk; the owner refetches
   * its list. Called after a rename regardless of outcome, since the folder
   * moves with the name and the list is stale either way.
   */
  onChanged: () => void;
};

/**
 * A project in a dashboard grid: thumbnail, name, and last-edited time, with
 * the context menu that opens, renames, duplicates, and deletes it. Rename
 * happens inline, in place of the name, and lives here so every grid that
 * shows projects gets the same menu.
 */
export function DashboardProjectCard(props: DashboardProjectCardProps) {
  const [renaming, setRenaming] = createSignal(false);
  const [renameDraft, setRenameDraft] = createSignal("");

  const startRenaming = () => {
    batch(() => {
      setRenameDraft(props.project.displayName);
      setRenaming(true);
    });
  };

  const stopRenaming = () => {
    batch(() => {
      setRenaming(false);
      setRenameDraft("");
    });
  };

  const handleOpen = () => {
    if (renaming()) return;
    props.onOpen();
  };

  const handleDuplicate = async () => {
    try {
      await duplicateProject(props.project.dir);
      track("project_duplicated");
      props.onChanged();
    } catch (e) {
      toast.error("Failed to duplicate project", { description: (e as Error).message });
    }
  };

  const handleRenameInput = (event: InputEvent & { currentTarget: HTMLInputElement }) => {
    setRenameDraft(event.currentTarget.value);
  };

  // The input mounts from a context-menu selection, which restores focus to
  // the trigger on close — so the input must claim focus itself, after that.
  const handleRenameInputRef = (el: HTMLInputElement) => {
    queueMicrotask(() => {
      el.focus();
      el.select();
    });
  };

  const handleBlurRenameInput = () => {
    stopRenaming();
    props.onChanged();
  };

  const handleKeyDownRenameInput = async (event: KeyboardEvent) => {
    const input = event.currentTarget as HTMLInputElement;
    const trimmedName = renameDraft().trim();

    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();

      stopRenaming();
      props.onChanged();
      input.blur();
    }

    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();

      // The folder moves with the name, so the list is refetched rather than
      // patched: every path in it has just changed.
      if (trimmedName.length > 0 && renaming()) {
        try {
          await renameProject(props.project.dir, trimmedName);
        } catch (e) {
          toast.error("Failed to rename project", { description: (e as Error).message });
        }
      }

      stopRenaming();
      props.onChanged();
      input.blur();
    }
  };

  return (
    <ContextMenu
      modal={false}
      onOpenChange={(open) => {
        if (open) props.onSelect();
      }}
    >
      <ContextMenuTrigger as="div" class="contents">
        <DashboardCardButton
          active={props.active}
          onClick={props.onSelect}
          onDoubleClick={handleOpen}
          onEscape={props.onDeselect}
          onDelete={props.onDelete}
        >
          <DashboardCardPreview>
            <DashboardProjectThumbnail cover={props.project.cover} />
          </DashboardCardPreview>
          <div class="flex flex-col gap-1 px-2">
            <div class="relative h-4 w-full">
              <Show
                when={renaming()}
                fallback={
                  <p class="min-w-0 truncate text-xs text-foreground">
                    {props.project.displayName}
                  </p>
                }
              >
                <TextField class="contents">
                  <TextFieldInput
                    uiSize="compact"
                    type="text"
                    ref={handleRenameInputRef}
                    value={renameDraft()}
                    onInput={handleRenameInput}
                    onBlur={handleBlurRenameInput}
                    onKeyDown={handleKeyDownRenameInput}
                    placeholder="Project name"
                    aria-label="Project name"
                    class="absolute inset-x-0 top-1/2 h-5 w-full -translate-y-1/2 border border-ring bg-input px-1 py-0 ring-1 ring-inset ring-ring"
                  />
                </TextField>
              </Show>
            </div>
            <div class="flex min-w-0 items-center justify-between gap-2">
              <p class="min-w-0 truncate text-xs text-muted-foreground">{formatEditedAt(props.project.modifiedAt)}</p>
              <ProjectTokenUsageLabel projectId={props.project.id} />
            </div>
          </div>
        </DashboardCardButton>
      </ContextMenuTrigger>
      <ContextMenuPortal>
        <ContextMenuContent class="w-45 gap-0">
          <ContextMenuItem onSelect={handleOpen}>Open</ContextMenuItem>
          <ContextMenuSeparator class="my-2" />
          <ContextMenuItem onSelect={startRenaming}>Rename</ContextMenuItem>
          <ContextMenuItem onSelect={handleDuplicate}>Duplicate</ContextMenuItem>
          <ContextMenuSeparator class="my-2" />
          <ContextMenuItem onSelect={props.onDelete}>Delete</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenuPortal>
    </ContextMenu>
  );
}
